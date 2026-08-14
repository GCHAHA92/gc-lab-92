import { MongoClient } from 'mongodb';

let clientPromise;

export async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');

  if (!clientPromise) {
    const client = new MongoClient(uri, { maxPoolSize: 5 });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || 'geumcheonLunch');
}

export function setCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', allowed === '*' ? '*' : (origin === allowed ? origin : allowed));
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false;
  setCors(req, res);
  res.status(204).end();
  return true;
}
