import { getDatabase, handleOptions, setCors } from './_db.mjs';

const clean = value => String(value || '').trim().slice(0, 200);

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(req, res);

  try {
    const db = await getDatabase();
    const likes = db.collection('restaurantLikes');
    await likes.createIndex({ placeId: 1, deviceId: 1 }, { unique: true });

    if (req.method === 'GET') {
      const ids = clean(req.query.ids).split(',').map(clean).filter(Boolean).slice(0, 50);
      const deviceId = clean(req.query.deviceId);
      const counts = ids.length ? await likes.aggregate([
        { $match: { placeId: { $in: ids } } },
        { $group: { _id: '$placeId', count: { $sum: 1 } } },
      ]).toArray() : [];
      const mine = deviceId && ids.length
        ? await likes.find({ placeId: { $in: ids }, deviceId }, { projection: { placeId: 1 } }).toArray()
        : [];
      const countMap = Object.fromEntries(counts.map(row => [row._id, row.count]));
      const mineSet = new Set(mine.map(row => row.placeId));
      const items = Object.fromEntries(ids.map(id => [id, { count: countMap[id] || 0, liked: mineSet.has(id) }]));
      res.status(200).json({ items });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const placeId = clean(body.placeId);
      const placeName = clean(body.placeName);
      const deviceId = clean(body.deviceId);
      if (!placeId || !deviceId) {
        res.status(400).json({ error: 'placeId and deviceId are required.' });
        return;
      }

      const key = { placeId, deviceId };
      const existing = await likes.findOne(key, { projection: { _id: 1 } });
      let liked;
      if (existing) {
        await likes.deleteOne({ _id: existing._id });
        liked = false;
      } else {
        await likes.insertOne({ placeId, placeName, deviceId, createdAt: new Date() });
        liked = true;
      }
      const count = await likes.countDocuments({ placeId });
      res.status(200).json({ count, liked });
      return;
    }

    res.setHeader('Allow', 'GET,POST,OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Recommendation service is unavailable.' });
  }
}
