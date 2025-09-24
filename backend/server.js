const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

// Malformed JSON guard
app.use((err, req, res, next) => {
  if (err && err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  next();
});

// ================= MongoDB Client =================
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const DATABASE_URL = process.env.DATABASE_URL || process.env.MONGODB_URI;
const DB_NAME = (DATABASE_URL && (DATABASE_URL.split('/').pop()?.split('?')[0])) || 'saas_notes';

if (!DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('DATABASE_URL is not set. Set it to your MongoDB connection string.');
}

const mongoClient = new MongoClient(DATABASE_URL, { maxPoolSize: 10 });
let db;
let Users;
let Tenants;
let Notes;

async function ensureDb() {
  if (!db) {
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    Users = db.collection('User');
    Tenants = db.collection('Tenant');
    Notes = db.collection('Note');
    await Users.createIndex({ email: 1 }, { unique: true });
    await Tenants.createIndex({ slug: 1 }, { unique: true });
  }
}

// Helper: build base and unique slug
async function generateUniqueSlug(name, email) {
  await ensureDb();
  const baseSlug = (
    (name && name.trim()) || (email && email.split('@')[0]) || 'tenant'
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') || 'tenant';

  // Try until we find an unused candidate (collision chance is tiny)
  // Hard limit to avoid infinite loops
  for (let i = 0; i < 10; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const candidate = `${baseSlug}-${suffix}`;
    const exists = await Tenants.findOne({ slug: candidate });
    if (!exists) return candidate;
  }
  // Fallback to timestamp-based suffix
  return `${baseSlug}-${Date.now().toString(36)}`;
}

// ================= Signup =================
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    await ensureDb();
    const existing = await Users.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const slug = await generateUniqueSlug(name, email);

    const tenantInsert = await Tenants.insertOne({ name: name || baseSlug, slug, plan: 'FREE' });
    await Users.insertOne({ email, password: hashed, role: 'ADMIN', tenantId: tenantInsert.insertedId.toString() });

    return res.json({ message: 'User created' });
  } catch (err) {
    console.error('POST /signup failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ================= Health =================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ service: 'notes-api', status: 'ok' });
});

// ================= Auth Middleware =================
const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// ================= Login =================
app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    await ensureDb();
    const user = await Users.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id.toString(), tenantId: user.tenantId, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    let tenantInfo = { slug: null, plan: null };
    try {
      const tenant = await Tenants.findOne({ _id: new ObjectId(user.tenantId) });
      if (tenant) tenantInfo = { slug: tenant.slug || null, plan: tenant.plan || null };
    } catch {}

    res.json({ token, tenant: tenantInfo });
  } catch (err) {
    console.error('POST /login failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================= Notes CRUD =================
app.post('/notes', authMiddleware(), async (req, res) => {
  const { title, content } = req.body || {};
  try {
    await ensureDb();
    const tenant = await Tenants.findOne({ _id: new ObjectId(req.user.tenantId) });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    if (tenant.plan === 'FREE') {
      const count = await Notes.countDocuments({ tenantId: req.user.tenantId });
      if (count >= 3) return res.status(403).json({ error: 'Free plan limit reached. Upgrade to Pro.' });
    }

    const insert = await Notes.insertOne({ title, content, tenantId: req.user.tenantId, createdAt: new Date(), updatedAt: new Date() });
    const note = await Notes.findOne({ _id: insert.insertedId });
    res.json({ id: note._id.toString(), title: note.title, content: note.content, tenantId: note.tenantId, createdAt: note.createdAt, updatedAt: note.updatedAt });
  } catch (err) {
    console.error('POST /notes failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/notes', authMiddleware(), async (req, res) => {
  try {
    await ensureDb();
    const notes = await Notes.find({ tenantId: req.user.tenantId }).sort({ updatedAt: -1 }).toArray();
    res.json(notes.map(n => ({ id: n._id.toString(), title: n.title, content: n.content, tenantId: n.tenantId, createdAt: n.createdAt, updatedAt: n.updatedAt })));
  } catch (err) {
    console.error('GET /notes failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/notes/:id', authMiddleware(), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureDb();
    const note = await Notes.findOne({ _id: new ObjectId(id) });
    if (!note || note.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Note not found' });
    res.json({ id: note._id.toString(), title: note.title, content: note.content, tenantId: note.tenantId, createdAt: note.createdAt, updatedAt: note.updatedAt });
  } catch (err) {
    console.error('GET /notes/:id failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/notes/:id', authMiddleware(), async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body || {};
  try {
    await ensureDb();
    const note = await Notes.findOne({ _id: new ObjectId(id) });
    if (!note || note.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Note not found' });

    await Notes.updateOne({ _id: new ObjectId(id) }, { $set: { title, content, updatedAt: new Date() } });
    const updated = await Notes.findOne({ _id: new ObjectId(id) });
    res.json({ id: updated._id.toString(), title: updated.title, content: updated.content, tenantId: updated.tenantId, createdAt: updated.createdAt, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('PUT /notes/:id failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/notes/:id', authMiddleware(), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureDb();
    const note = await Notes.findOne({ _id: new ObjectId(id) });
    if (!note || note.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Note not found' });

    await Notes.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('DELETE /notes/:id failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================= Upgrade Plan =================
app.post('/tenants/:slug/upgrade', authMiddleware(['ADMIN']), async (req, res) => {
  const { slug } = req.params;
  try {
    await ensureDb();
    const tenant = await Tenants.findOne({ slug });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant._id.toString() !== req.user.tenantId) return res.status(403).json({ error: 'Forbidden' });

    if (tenant.plan === 'PRO') return res.json({ message: 'Already on Pro' });

    await Tenants.updateOne({ _id: tenant._id }, { $set: { plan: 'PRO' } });
    res.json({ message: 'Upgraded to Pro. Note limits lifted.' });
  } catch (err) {
    console.error('POST /tenants/:slug/upgrade failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


