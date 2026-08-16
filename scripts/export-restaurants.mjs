import { MongoClient } from 'mongodb';
import { mkdir, writeFile } from 'node:fs/promises';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI secret is not configured.');

const dbName = process.env.MONGODB_DB || 'geumcheon-lunch';
const collectionName = process.env.MONGODB_COLLECTION || 'restaurants';
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

const text = value => (typeof value === 'string' ? value.trim() : '');
const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const boolean = value => (typeof value === 'boolean' ? value : undefined);

function publicRestaurant(document) {
  const placeId = text(document.placeId) || text(document.id) || text(document.kakaoPlaceId);
  if (!placeId) return null;

  const item = {
    placeId,
    name: text(document.name) || text(document.place_name),
    category: text(document.category) || text(document.category_name),
    cuisine: text(document.cuisine),
    cuisines: Array.isArray(document.cuisines) ? document.cuisines.filter(v => typeof v === 'string') : undefined,
    address: text(document.address) || text(document.address_name),
    roadAddress: text(document.roadAddress) || text(document.road_address_name),
    phone: text(document.phone),
    placeUrl: text(document.placeUrl) || text(document.place_url),
    imageUrl: text(document.imageUrl) || text(document.photoUrl) || text(document.url),
    closedDays: Array.isArray(document.closedDays) ? document.closedDays.filter(v => typeof v === 'string') : undefined,
    businessHours: text(document.businessHours),
    paymentAmount: number(document.paymentAmount ?? document.amount),
    weight: number(document.weight),
    excluded: boolean(document.excluded),
  };

  return Object.fromEntries(Object.entries(item).filter(([, value]) =>
    value !== undefined && value !== '' && (!Array.isArray(value) || value.length)
  ));
}

try {
  await client.connect();
  const documents = await client.db(dbName).collection(collectionName)
    .find({}, { projection: { _id: 0 } })
    .sort({ paymentAmount: -1, amount: -1, name: 1 })
    .toArray();

  const restaurants = documents.map(publicRestaurant).filter(Boolean);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'MongoDB Atlas',
    count: restaurants.length,
    restaurants,
  };

  await mkdir('data', { recursive: true });
  await writeFile('data/restaurants.json', JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Exported ${restaurants.length} restaurants from ${dbName}.${collectionName}`);
} finally {
  await client.close();
}
