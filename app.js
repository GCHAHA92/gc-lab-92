const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const MENU_LABELS = {
  korean: '한식',
  chinese: '중식',
  japanese: '일식',
  western: '양식',
  bunsik: '분식',
  other: '기타',
};

const MENU_SEARCH_TERMS = {
  korean: ['한식', '백반', '국밥', '칼국수'],
  chinese: ['중식', '짜장면', '짬뽕', '마라탕', '양꼬치'],
  japanese: ['일식', '초밥', '돈까스', '라멘', '우동'],
  western: ['양식', '파스타', '피자', '햄버거', '브런치'],
  bunsik: ['분식', '김밥', '떡볶이'],
};

const LUNCH_EXCLUDED_CATEGORY_TERMS = [
  '아이스크림', '빙수', '디저트', '케이크', '제과', '베이커리',
  '떡,한과', '떡/한과', '도넛', '호두과자',
  '술집', '주점', '호프', '와인바', '칵테일바',
];

const LUNCH_EXCLUDED_NAME_TERMS = [
  '무인아이스크림', '24시아이스크림', '아이스크림할인점',
  '무인과자', '세계과자할인점',
];

const WORKPLACES = [
  ['geumcheon-office','금천구청','구청','서울특별시 금천구 시흥대로73길 70'],
  ['doksan1','독산1동 주민센터','독산','서울특별시 금천구 시흥대로123길 11'],
  ['doksan1-annex','독산1동 분소','독산','서울특별시 금천구 한내로 69-15'],
  ['doksan2','독산2동 주민센터','독산','서울특별시 금천구 독산로 179'],
  ['doksan3','독산3동 주민센터','독산','서울특별시 금천구 독산로 317'],
  ['doksan4','독산4동 주민센터','독산','서울특별시 금천구 독산로 232'],
  ['siheung1','시흥1동 주민센터','시흥','서울특별시 금천구 시흥대로58길 36'],
  ['siheung2','시흥2동 주민센터','시흥','서울특별시 금천구 금하로 764'],
  ['siheung3','시흥3동 주민센터','시흥','서울특별시 금천구 시흥대로18길 40'],
  ['siheung4','시흥4동 주민센터','시흥','서울특별시 금천구 독산로36길 14'],
  ['siheung5','시흥5동 주민센터','시흥','서울특별시 금천구 금하로24길 6'],
].map(([id,label,group,address]) => ({ id,label,group,address }));


const STORAGE = {
  workplace: 'geumcheon-lunch-v2-workplace',
  menus: 'geumcheon-lunch-v2-menus',
  radius: 'geumcheon-lunch-v2-radius',
  recent: 'geumcheon-lunch-v2-recent',
};

const state = {
  workplaces: WORKPLACES,
  workplace: localStorage.getItem(STORAGE.workplace) || 'geumcheon-office',
  menus: loadMenus(),
  radius: Number(localStorage.getItem(STORAGE.radius) || 500),
  results: [],
  visible: [],
  kakaoReady: false,
  spinning: false,
};

function loadMenus() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.menus) || '["all"]');
    return Array.isArray(saved) && saved.length ? saved : ['all'];
  } catch {
    return ['all'];
  }
}

function setStatus(message = '', type = '') {
  const el = $('#status');
  el.textContent = message;
  el.className = `status${type ? ` ${type}` : ''}`;
}

function currentWorkplace() {
  return state.workplaces.find(item => item.id === state.workplace);
}

function renderWorkplaceOptions() {
  const select = $('#workplace');
  select.innerHTML = '';

  const groups = [
    ['구청', state.workplaces.filter(item => item.group === '구청')],
    ['독산', state.workplaces.filter(item => item.group === '독산')],
    ['시흥', state.workplaces.filter(item => item.group === '시흥')],
  ];

  for (const [label, items] of groups) {
    if (!items.length) continue;
    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      optgroup.append(option);
    }
    select.append(optgroup);
  }

  if (!state.workplaces.some(item => item.id === state.workplace)) {
    state.workplace = state.workplaces[0]?.id || '';
  }
  select.value = state.workplace;
  renderWorkplaceAddress();
}

function renderWorkplaceAddress() {
  const workplace = currentWorkplace();
  $('#workplaceAddress').textContent = workplace?.address || '';
}

function renderMenus() {
  $$('#menuGroup [data-menu]').forEach(button => {
    button.classList.toggle('active', state.menus.includes(button.dataset.menu));
    button.setAttribute('aria-pressed', state.menus.includes(button.dataset.menu) ? 'true' : 'false');
  });

  if (state.menus.includes('all')) {
    $('#menuSummary').textContent = '모든 음식점을 후보에 포함합니다.';
  } else {
    const labels = state.menus.map(menu => MENU_LABELS[menu]).filter(Boolean);
    $('#menuSummary').textContent = `${labels.join(' · ')}만 후보에 포함합니다.`;
  }
}

function renderDistance() {
  $$('#distanceGroup [data-radius]').forEach(button => {
    const active = Number(button.dataset.radius) === state.radius;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function toggleMenu(menu) {
  if (menu === 'all') {
    state.menus = ['all'];
  } else if (state.menus.includes('all')) {
    state.menus = [menu];
  } else if (state.menus.includes(menu)) {
    if (state.menus.length === 1) {
      setStatus('메뉴는 하나 이상 선택해주세요.', 'notice');
      return;
    }
    state.menus = state.menus.filter(item => item !== menu);
  } else {
    state.menus = [...state.menus, menu];
  }

  localStorage.setItem(STORAGE.menus, JSON.stringify(state.menus));
  renderMenus();
  setStatus('');
}

function classifyCuisine(place) {
  const hay = `${place.category_name || ''} ${place.place_name || ''}`.toLowerCase();
  const rules = [
    ['korean',['한식','백반','국밥','찌개','감자탕','설렁탕','곰탕','냉면','삼겹살','갈비','보쌈','족발','칼국수']],
    ['chinese',['중식','중국요리','짜장','짬뽕','마라탕','마라샹궈','양꼬치','딤섬']],
    ['japanese',['일식','초밥','스시','라멘','우동','소바','돈까스','돈카츠']],
    ['western',['양식','이탈리안','파스타','피자','스테이크','햄버거','브런치','샐러드']],
    ['bunsik',['분식','김밥','떡볶이','순대']],
  ];
  const matches = rules
    .filter(([, tokens]) => tokens.some(token => hay.includes(token)))
    .map(([key]) => key);
  return matches.length ? matches : ['other'];
}

function placeCuisines(place) {
  if (Array.isArray(place.cuisines) && place.cuisines.length) return place.cuisines;
  return [place.cuisine || 'other'];
}

function menuMatches(place) {
  return state.menus.includes('all')
    || placeCuisines(place).some(cuisine => state.menus.includes(cuisine));
}

function isLunchCandidate(place) {
  const category = String(place.category_name || '').replaceAll(' ', '').toLowerCase();
  const name = String(place.place_name || '').replaceAll(' ', '').toLowerCase();
  if (LUNCH_EXCLUDED_CATEGORY_TERMS.some(term => category.includes(term.replaceAll(' ', '').toLowerCase()))) {
    return false;
  }
  return !LUNCH_EXCLUDED_NAME_TERMS.some(term => name.includes(term.replaceAll(' ', '').toLowerCase()));
}

function loadKakaoSdk() {
  const key = window.GEUMCHEON_CONFIG?.kakaoJavaScriptKey || '';
  if (!key || key.includes('여기에_')) return Promise.resolve(false);
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.onload = () => window.kakao.maps.load(() => resolve(true));
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

function findWorkplacePoint(address) {
  return new Promise((resolve, reject) => {
    new kakao.maps.services.Geocoder().addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result[0]) resolve({ lat:Number(result[0].y), lng:Number(result[0].x) });
      else reject(new Error('근무지 위치를 찾지 못했습니다.'));
    });
  });
}

async function searchKakaoPlaces(point) {
  const found = new Map();
  const targetCount = 100;
  const options = {
    location:new kakao.maps.LatLng(point.lat, point.lng),
    radius:state.radius,
    sort:kakao.maps.services.SortBy.DISTANCE,
  };

  const collect = (data = []) => {
    data.forEach(item => {
      if (!isLunchCandidate(item)) return;
      const address = `${item.address_name || ''} ${item.road_address_name || ''}`;
      if (!address.includes('금천구')) return;
      const cuisines = classifyCuisine(item);
      const place = { ...item, cuisines, cuisine:cuisines[0] || 'other' };
      if (menuMatches(place)) found.set(place.id, place);
    });
  };

  const runPagedSearch = (startSearch, maxPages) => new Promise((resolve, reject) => {
    let pageCount = 0;
    const callback = (data, status, pagination) => {
      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve();
        return;
      }
      if (status !== kakao.maps.services.Status.OK) {
        reject(new Error('카카오 음식점 검색에 실패했습니다.'));
        return;
      }
      collect(data);
      pageCount += 1;
      if (pagination?.hasNextPage && pageCount < maxPages) pagination.nextPage();
      else resolve();
    };
    startSearch(callback);
  });

  const categoryPlaces = new kakao.maps.services.Places();
  await runPagedSearch(callback => categoryPlaces.categorySearch('FD6', callback, options), 5);

  const searchMenus = state.menus.includes('all')
    ? Object.keys(MENU_SEARCH_TERMS)
    : state.menus;
  const keywordLists = searchMenus.map(menu => MENU_SEARCH_TERMS[menu] || []);
  const keywords = [];
  const longestList = Math.max(0, ...keywordLists.map(list => list.length));
  for (let index = 0; index < longestList; index += 1) {
    keywordLists.forEach(list => {
      if (list[index] && !keywords.includes(list[index])) keywords.push(list[index]);
    });
  }

  const batchSize = 5;
  for (let start = 0; start < keywords.length && found.size < targetCount; start += batchSize) {
    const batch = keywords.slice(start, start + batchSize);
    await Promise.all(batch.map(async keyword => {
      const keywordPlaces = new kakao.maps.services.Places();
      try {
        await runPagedSearch(callback => keywordPlaces.keywordSearch(keyword, callback, {
          ...options,
          category_group_code:'FD6',
        }), 2);
      } catch {
        // 기본 음식점 검색 결과는 유지하고 실패한 보조 검색어만 건너뜁니다.
      }
    }));
  }

  return [...found.values()]
    .sort((a,b) => Number(a.distance) - Number(b.distance))
    .slice(0, targetCount);
}

function cuisineLabel(place) {
  const labels = placeCuisines(place).map(cuisine => MENU_LABELS[cuisine]).filter(Boolean);
  if (labels.length) return labels.join(' · ');
  const category = (place.category_name || '').split(' > ').filter(Boolean);
  return category.at(-2) || category.at(-1) || '음식점';
}

function distanceText(distance) {
  const meters = Number(distance);
  if (!Number.isFinite(meters)) return '거리 정보 없음';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${meters.toLocaleString()}m`;
}

function secureShuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickThree(items) {
  if (!items.length) return [];

  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem(STORAGE.recent) || '[]');
    if (!Array.isArray(recent)) recent = [];
  } catch {
    recent = [];
  }

  let pool = items.filter(item => !recent.includes(item.id));
  if (pool.length < Math.min(3, items.length)) pool = [...items];

  const picked = secureShuffle(pool).slice(0, 3);
  const nextRecent = [
    ...picked.map(item => item.id),
    ...recent.filter(id => !picked.some(item => item.id === id)),
  ].slice(0, 12);

  localStorage.setItem(STORAGE.recent, JSON.stringify(nextRecent));
  return picked;
}

function cuisineIconMarkup(cuisine = 'other') {
  const icons = {
    korean: `
      <path d="M10 25h28c-1.6 9-6.8 13-14 13S11.6 34 10 25Z"/>
      <path d="M13 29h22M17 19c-2-3 1-5 0-8M25 19c-2-3 1-5 0-8M33 19c-2-3 1-5 0-8"/>
    `,
    chinese: `
      <path d="M9 31c2-9 7.5-14 15-14s13 5 15 14c-4 5-9 7-15 7S13 36 9 31Z"/>
      <path d="M15 29c2-4 5-6 9-6s7 2 9 6M18 19l2.5 5M30 19l-2.5 5M24 17v6"/>
    `,
    japanese: `
      <rect x="10" y="17" width="28" height="20" rx="8"/>
      <path d="M11 24h26M15 18c5 4 13 4 18 0M17 28h14M18 33h12"/>
    `,
    western: `
      <circle cx="24" cy="25" r="13"/>
      <circle cx="24" cy="25" r="7"/>
      <path d="M24 18c5 2 5 8 0 9-4 1-5 5-1 7M8 10v8M12 10v8M16 10v8M12 18v20"/>
    `,
    bunsik: `
      <path d="M12 20h24l-2 18H14l-2-18Z"/>
      <path d="M10 20h28M17 14l4 6M31 12l-5 8"/>
      <path d="M18 27h5v6h-5zM26 25h5v6h-5z"/>
    `,
    other: `
      <path d="M12 10v11c0 4 3 6 6 6V10M15 10v28M34 10c-5 4-7 10-7 17h7v11M34 10v28"/>
    `,
  };
  return `<svg class="cuisine-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${icons[cuisine] || icons.other}</svg>`;
}

function placeAvatarMarkup(place) {
  return cuisineIconMarkup(place.cuisine || 'other');
}

const MANUAL_PHOTOS = {
  '347052149':'https://img1.kakaocdn.net/cthumb/local/C544x408.q50/?fname=http%3A%2F%2Ft1.kakaocdn.net%2Fmystore%2F5A5DA4034B4C456196C346248693915B',
};

async function loadPlacePhoto(place) {
  const url = MANUAL_PHOTOS[String(place.id)] || '';
  if (!url) return;
  const card = document.querySelector(`.place-card[data-place-id="${CSS.escape(String(place.id))}"]`);
  const avatar = card?.querySelector('.place-avatar');
  if (avatar) {
    avatar.innerHTML = `<img src="${escapeAttribute(url)}" alt="" loading="lazy" />`;
    avatar.classList.add('has-photo');
  }
}

async function hydrateRestaurantCards(items) {
  await Promise.all(items.map(loadPlacePhoto));
}

function cardMarkup(place, index, jackpot = false) {
  const mapUrl = place.place_url || 'https://map.kakao.com/';
  const address = place.road_address_name || place.address_name || '주소 정보 없음';
  return `
      <div class="card-topline">
        <span class="rank">0${index + 1}</span>
        <span class="distance">${jackpot ? '1%' : escapeHtml(distanceText(place.distance))}</span>
      </div>
      <div class="place-identity">
        <div class="place-avatar" data-cuisine="${escapeAttribute(place.cuisine || 'other')}">${jackpot ? '★' : placeAvatarMarkup(place)}</div>
        <div class="place-title">
          <h3>${escapeHtml((place.place_name || '이름 없는 음식점'))}</h3>
          <div class="cuisine-badge">${jackpot ? 'JACKPOT' : escapeHtml(cuisineLabel(place))}</div>
        </div>
      </div>
      <p class="category">${jackpot ? '오늘 점심은 자유입니다' : escapeHtml((place.category_name || '').replaceAll(' > ', ' · '))}</p>
      <p class="address">${jackpot ? '컴퓨터를 끄고 자리에서 일어나세요.' : escapeHtml(address)}</p>
      ${jackpot ? '<span class="map-link">축하합니다 ★</span>' : `<a class="map-link" href="${escapeAttribute(mapUrl)}" target="_blank" rel="noopener noreferrer">
        카카오맵에서 보기 <span aria-hidden="true">↗</span>
      </a>`}
  `;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function reelMarkup(pool, finalPlace, index, jackpot) {
  const faceCount = 8;
  const angleStep = 360 / faceCount;
  const radius = 121;
  const faces = [finalPlace];
  while (faces.length < faceCount) {
    faces.push(pool[Math.floor(Math.random() * pool.length)] || finalPlace);
  }
  return `
    <div class="reel-window" aria-hidden="true">
      <div class="reel-stage">
        ${faces.map((place, faceIndex) => {
          const name = jackpot && faceIndex === 0 ? '퇴근해' : (place.place_name || '이름 없는 음식점');
          const cuisine = jackpot && faceIndex === 0 ? 'JACKPOT' : cuisineLabel(place);
          return `<div class="reel-face" style="transform:rotateX(${faceIndex * angleStep}deg) translateZ(${radius}px)">
            <div class="place-avatar" data-cuisine="${escapeAttribute(place.cuisine || 'other')}">${jackpot && faceIndex === 0 ? '★' : placeAvatarMarkup(place)}</div>
            <div class="reel-face-copy">
              <h3>${escapeHtml(name)}</h3>
              <div class="reel-meta">${escapeHtml(cuisine)} · ${jackpot && faceIndex === 0 ? '1%' : escapeHtml(distanceText(place.distance))}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

async function spinCard(card, index, pool, finalPlace, duration, jackpot) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.className = 'place-card reel-card';
  card.innerHTML = reelMarkup(pool, finalPlace, index, jackpot);
  const stage = card.querySelector('.reel-stage');

  if (!reduceMotion) {
    const turns = 5 + index;
    const spin = stage.animate([
      { transform:'translate(-50%, -50%) rotateX(0deg)' },
      { transform:`translate(-50%, -50%) rotateX(-${turns * 360}deg)` },
    ], {
      duration,
      easing:'cubic-bezier(.12,.68,.08,1)',
      fill:'forwards',
    });
    window.setTimeout(() => card.classList.add('is-braking'), Math.max(0, duration - 700));
    await spin.finished;
  } else {
    await wait(80 + index * 70);
  }

  card.className = `place-card landed${jackpot ? ' jackpot-card' : ''}`;
  card.innerHTML = cardMarkup(finalPlace, index, jackpot);
}

function showConfetti() {
  const colors = ['#0f766e','#f2a66f','#f5c84c','#245b78','#e76f75'];
  for (let i = 0; i < 55; i += 1) {
    const bit = document.createElement('i');
    bit.className = 'confetti';
    bit.style.left = `${Math.random() * 100}vw`;
    bit.style.background = colors[Math.floor(Math.random() * colors.length)];
    bit.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
    bit.style.animationDelay = `${Math.random() * 500}ms`;
    document.body.append(bit);
    setTimeout(() => bit.remove(), 3100);
  }
}

async function renderCards(items) {
  if (state.spinning || !state.results.length) return;
  state.spinning = true;
  const jackpot = crypto.getRandomValues(new Uint32Array(1))[0] % 100 === 0;
  const finalItems = jackpot
    ? [0,1,2].map(i => ({ id:`jackpot-${i}`, place_name:'퇴근해', cuisine:'other', distance:'0' }))
    : items;
  state.visible = jackpot ? [] : items;
  $('#finalPick').className = 'final-pick hidden';
  $('#rouletteActions').classList.add('hidden');
  $('#againBtn').classList.add('hidden');
  const container = $('#results');
  container.innerHTML = '';
  const cards = finalItems.map((place, index) => {
    const card = document.createElement('article');
    card.className = 'place-card';
    card.dataset.placeId = String(place.id || '');
    card.innerHTML = cardMarkup(state.results[index % state.results.length], index);
    container.append(card);
    return card;
  });

  $('#emptyState').classList.add('hidden');
  $('#resultSummary').classList.remove('hidden');

  const workplace = currentWorkplace();
  const menuText = state.menus.includes('all')
    ? '전체 메뉴'
    : state.menus.map(menu => MENU_LABELS[menu]).filter(Boolean).join(' · ');
  $('#resultSummary').textContent = `${workplace?.label || '선택 근무지'} · ${distanceText(state.radius)} 이내 · ${menuText}`;
  await Promise.all(cards.map((card,index) => spinCard(card,index,state.results,finalItems[index],1900 + index * 620,jackpot)));
  if (jackpot) {
    $('#finalPick').textContent = '🎉 JACKPOT — 오늘의 메뉴는 퇴근입니다!';
    $('#finalPick').className = 'final-pick jackpot-banner';
    setStatus('1%의 퇴근 잭팟에 당첨되었습니다!', 'success');
    showConfetti();
  } else {
    $('#againBtn').classList.toggle('hidden', state.results.length <= 3);
    $('#rouletteActions').classList.remove('hidden');
    hydrateRestaurantCards(items);
  }
  state.spinning = false;
}

function pickFinalRestaurant() {
  if (!state.visible.length) return;
  $$('.place-card').forEach(card => card.classList.remove('final-choice'));
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const index = buf[0] % state.visible.length;
  const selected = state.visible[index];
  const cards = $$('.place-card');
  cards[index]?.classList.add('final-choice');
  const finalPick = $('#finalPick');
  finalPick.textContent = `오늘의 최종 선택은 “${(selected.place_name || '')}”입니다!`;
  finalPick.classList.remove('hidden');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function searchPlaces() {
  const button = $('#searchBtn');
  button.disabled = true;
  button.classList.add('is-spinning');
  setStatus('조건에 맞는 음식점을 찾고 있습니다…');

  try {
    if (!state.kakaoReady) {
      throw new Error('카카오 지도 API에 연결되지 않았습니다. 페이지를 새로고침해주세요.');
    }
    const point = await findWorkplacePoint(currentWorkplace().address);
    state.results = await searchKakaoPlaces(point);

    if (!state.results.length) {
      $('#results').innerHTML = '';
      $('#resultSummary').classList.add('hidden');
      $('#againBtn').classList.add('hidden');
      $('#rouletteActions').classList.add('hidden');
      $('#finalPick').classList.add('hidden');
      $('#emptyState').classList.remove('hidden');
      $('#emptyState h3').textContent = '조건에 맞는 후보가 없어요.';
      $('#emptyState p').textContent = '검색 거리를 넓히거나 메뉴 선택을 바꿔보세요.';
      setStatus('검색 결과가 없습니다.', 'notice');
      return;
    }

    await renderCards(pickThree(state.results));
    if (!$('#finalPick').classList.contains('jackpot-banner')) {
      setStatus(`${state.results.length}곳 중 후보를 골랐습니다.`, 'success');
    }
  } catch (error) {
    setStatus(error.message || '오류가 발생했습니다.', 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('is-spinning');
  }
}

async function init() {
  renderMenus();
  renderDistance();
  renderWorkplaceOptions();
  state.kakaoReady = await loadKakaoSdk();
  if (!state.kakaoReady) {
    setStatus('카카오 지도 API 연결에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
    return;
  }
  setStatus('');
}

$('#workplace').addEventListener('change', event => {
  state.workplace = event.target.value;
  localStorage.setItem(STORAGE.workplace, state.workplace);
  renderWorkplaceAddress();
  setStatus('근무지를 저장했습니다.', 'success');
});

$$('#menuGroup [data-menu]').forEach(button => {
  button.addEventListener('click', () => toggleMenu(button.dataset.menu));
});

$$('#distanceGroup [data-radius]').forEach(button => {
  button.addEventListener('click', () => {
    state.radius = Number(button.dataset.radius);
    localStorage.setItem(STORAGE.radius, String(state.radius));
    renderDistance();
    setStatus('');
  });
});

$('#searchBtn').addEventListener('click', searchPlaces);
$('#againBtn').addEventListener('click', () => renderCards(pickThree(state.results)));
$('#pickOneBtn').addEventListener('click', pickFinalRestaurant);
init();
