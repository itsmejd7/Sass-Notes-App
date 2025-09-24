const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();

// Permissive CORS to satisfy production frontend
const corsOptions = {
  origin: (origin, callback) => callback(null, true), // reflect any origin
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

// Handle malformed JSON bodies early to avoid 500s
app.use((err, req, res, next) => {
  if (err && err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  next();
});

// Reuse Prisma client across serverless invocations
const prisma = globalThis.__prisma || new PrismaClient();
if (!globalThis.__prisma) {
  globalThis.__prisma = prisma;
}
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// ================= Signup Endpoint =================
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);

    // Create a tenant for this signup (FREE plan by default)
    const baseSlug = (name || email.split('@')[0] || 'tenant').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    const tenant = await prisma.tenant.create({
      data: {
        name: name || baseSlug,
        slug,
        plan: 'FREE',
      },
    });

    await prisma.user.create({
      data: {
        email,
        password: hashed,
        role: 'ADMIN',
        tenant: { connect: { id: tenant.id } },
      },
    });

    return res.json({ message: 'User created' });
  } catch (err) {
    console.error('POST /signup failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ================= Health Endpoint =================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Optional root route to avoid "Cannot GET /" on service root
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

      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// ================= Login Endpoint =================
app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    let tenantInfo = { slug: null, plan: null };
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { plan: true } });
      if (tenant) tenantInfo = { slug: null, plan: tenant.plan ?? null };
    } catch (e) {
      // Swallow tenant read issues to avoid blocking login
    }

    res.json({ token, tenant: tenantInfo });
  } catch (err) {
    console.error('POST /login failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================= Notes CRUD =================

// Create note
app.post('/notes', authMiddleware(), async (req, res) => {
  const { title, content } = req.body;

  try {
    if (!req.user?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { plan: true } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.plan === 'FREE') {
      const count = await prisma.note.count({ where: { tenantId: req.user.tenantId } });
      if (count >= 3) {
        return res.status(403).json({ error: 'Free plan limit reached. Upgrade to Pro.' });
      }
    }

    const note = await prisma.note.create({
      data: {
        title,
        content,
        tenant: { connect: { id: req.user.tenantId } }, // connect tenant relation
      },
    });

    res.json(note);
  } catch (err) {
    console.error('POST /notes failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all notes
app.get('/notes', authMiddleware(), async (req, res) => {
  try {
    const notes = await prisma.note.findMany({ where: { tenantId: req.user.tenantId } });
    res.json(notes);
  } catch (err) {
    console.error('GET /notes failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific note
app.get('/notes/:id', authMiddleware(), async (req, res) => {
  const { id } = req.params;

  try {
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    console.error('GET /notes/:id failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update note
app.put('/notes/:id', authMiddleware(), async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Note not found' });

    const updated = await prisma.note.update({ where: { id }, data: { title, content } });
    res.json(updated);
  } catch (err) {
    console.error('PUT /notes/:id failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete note
app.delete('/notes/:id', authMiddleware(), async (req, res) => {
  const { id } = req.params;

  try {
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Note not found' });

    await prisma.note.delete({ where: { id } });
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
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.id !== req.user.tenantId) return res.status(403).json({ error: 'Forbidden' });

    if (tenant.plan === 'PRO') return res.json({ message: 'Already on Pro' });

    await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: 'PRO' } });
    res.json({ message: 'Upgraded to Pro. Note limits lifted.' });
  } catch (err) {
    console.error('POST /tenants/:slug/upgrade failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = app;


