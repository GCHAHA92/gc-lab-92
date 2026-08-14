import { getDatabase, handleOptions, setCors } from './_db.mjs';

const POSITIVE_TTL = 1000 * 60 * 60 * 24 * 30;
const NEGATIVE_TTL = 1000 * 60 * 60 * 24;
const CACHE_VERSION = 2;

const MANUAL_PHOTOS = {
  '347052149':'https://img1.kakaocdn.net/cthumb/local/C544x408.q50/?fname=http%3A%2F%2Ft1.kakaocdn.net%2Fmystore%2F5A5DA4034B4C456196C346248693915B',
};

function normalizeUrl(value) {
  if (typeof value !== 'string') return '';
  let url = value.replaceAll('\\/', '/').replaceAll('&amp;', '&').trim();
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`;
  return /^https:\/\/(?:[^/]+\.)?(?:kakaocdn\.net|daumcdn\.net)\//i.test(url) ? url : '';
}

function isPhotoUrl(url) {
  return /kakaomapPhoto\/review\//i.test(url)
    || /\/mystore\//i.test(url)
    || /\/cthumb\/local\/[^?]+\?[^#]*fname=/i.test(url)
    || /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(url);
}

function collectPhotoUrls(value, output = []) {
  if (typeof value === 'string') {
    const normalized = normalizeUrl(value);
    if (normalized && isPhotoUrl(normalized)) output.push(normalized);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectPhotoUrls(item, output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectPhotoUrls(item, output));
  }
  return output;
}

async function discoverPhoto(placeId) {
  const urls = [
    `https://place.map.kakao.com/main/v/${placeId}`,
    `https://place.map.kakao.com/${placeId}`,
  ];

  for (const url of urls) {
    const response = await fetch(url, {
      headers:{
        'User-Agent':'Mozilla/5.0 (compatible; GeumcheonLunch/1.0)',
        'Accept':'application/json,text/html;q=0.9,*/*;q=0.8',
        'Referer':`https://place.map.kakao.com/${placeId}`,
      },
      redirect:'follow',
    });
    if (!response.ok) continue;
    const text = await response.text();
    let candidates = [];
    try {
      candidates = collectPhotoUrls(JSON.parse(text));
    } catch {
      const matches = text.match(/https?:\\?\/\\?\/[^"'<>\\s]+/g) || [];
      candidates = matches.map(normalizeUrl).filter(candidate => candidate && isPhotoUrl(candidate));
    }
    const best = candidates.find(candidate => /(?:review|mystore|kakaomapPhoto)/i.test(candidate)) || candidates[0];
    if (best) return best;
  }
  return '';
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(req, res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const placeId = String(req.query.id || '').replace(/\D/g, '').slice(0, 30);
  if (!placeId) {
    res.status(400).json({ error: 'A valid place id is required.' });
    return;
  }

  try {
    const db = await getDatabase();
    const photos = db.collection('placePhotos');
    const manualUrl = normalizeUrl(MANUAL_PHOTOS[placeId] || '');
    if (manualUrl && isPhotoUrl(manualUrl)) {
      const existing = await photos.findOne({ placeId });
      const alreadySaved = existing?.url === manualUrl && existing?.source === 'manual';
      if (!alreadySaved) {
        await photos.updateOne(
          { placeId },
          { $set: { placeId, url:manualUrl, source:'manual', version:CACHE_VERSION, updatedAt:new Date() } },
          { upsert:true },
        );
      }
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json({ url:manualUrl, cached:alreadySaved, source:'manual' });
      return;
    }

    const cached = await photos.findOne({ placeId });
    const cachedUrl = normalizeUrl(cached?.url || '');
    const ttl = cachedUrl ? POSITIVE_TTL : NEGATIVE_TTL;
    if (cached?.version === CACHE_VERSION && Date.now() - new Date(cached.updatedAt).getTime() < ttl) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json({ url: cachedUrl, cached:true });
      return;
    }

    const url = await discoverPhoto(placeId);
    await photos.updateOne(
      { placeId },
      { $set: { placeId, url, version:CACHE_VERSION, updatedAt:new Date() } },
      { upsert:true },
    );
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ url, cached:false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Photo service is unavailable.' });
  }
}
