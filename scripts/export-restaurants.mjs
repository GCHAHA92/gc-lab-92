import { MongoClient } from 'mongodb';
import { mkdir, writeFile } from 'node:fs/promises';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI secret is not configured.');

const dbName = process.env.MONGODB_DB || 'geumcheon-lunch';
const collectionName = process.env.MONGODB_COLLECTION || 'restaurants';
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
const text = value => (typeof value === 'string' ? value.trim() : '');

function publicRestaurant(document) {
  const placeId = text(document.placeId) || text(document.id) || text(document.kakaoPlaceId);
  if (!placeId) return null;

  const item = {
    placeId,
    cuisine: text(document.cuisine),
    cuisines: Array.isArray(document.cuisines) ? document.cuisines.filter(v => typeof v === 'string') : undefined,
    imageUrl: text(document.imageUrl) || text(document.photoUrl) || text(document.url),
    closedDays: Array.isArray(document.closedDays) ? document.closedDays.filter(v => typeof v === 'string') : undefined,
    businessHours: text(document.businessHours),
    excluded: typeof document.excluded === 'boolean' ? document.excluded : undefined,
  };

  return Object.fromEntries(Object.entries(item).filter(([, value]) =>
    value !== undefined && value !== '' && (!Array.isArray(value) || value.length)
  ));
}

try {
  await client.connect();
  const documents = await client.db(dbName).collection(collectionName)
    .find({}, { projection: { _id: 0, placeId: 1, id: 1, kakaoPlaceId: 1, cuisine: 1, cuisines: 1, imageUrl: 1, photoUrl: 1, url: 1, closedDays: 1, businessHours: 1, excluded: 1 } })
    .toArray();

  const restaurants = documents.map(publicRestaurant).filter(Boolean);
  const payload = {
    generatedAt: new Date().toISOString(),
    count: restaurants.length,
    restaurants,
  };

  await mkdir('data', { recursive: true });
  await writeFile('data/restaurants.json', JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Exported ${restaurants.length} public restaurant records.`);
} finally {
  await client.close();
}
