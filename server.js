require('dotenv').config();

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const helmet = require('helmet');
const morgan = require('morgan');
const basicAuth = require('express-basic-auth');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
  console.error('Missing ADMIN_USER / ADMIN_PASS. Copy .env.example to .env and set them.');
  process.exit(1);
}

// --- Database setup ---------------------------------------------------
const db = new Database(path.join(__dirname, 'data', 'content.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    youtube_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    referrer TEXT,
    viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Helpers ------------------------------------------------------------
function extractYouTubeId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

const ALLOWED_CATEGORIES = ['article', 'ebook', 'video', 'webinar'];
const ALLOWED_TOPICS = ['ai', 'cs', 'energy', 'health', 'innovation', 'leadership'];

// --- Global middleware ----------------------------------------------------
// Controlled by HTTPS_ENABLED in .env. Leave it "false" while running on
// plain HTTP (no domain/TLS yet) — with upgradeInsecureRequests on, browsers
// silently rewrite http:// asset requests to https:// and they fail with
// nothing listening on 443 (symptom: CSS/JS silently don't load, no visible
// error). Once Caddy/TLS is set up with a real domain, set HTTPS_ENABLED=true
// in .env and restart the service — no code change needed.
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      upgradeInsecureRequests: httpsEnabled ? undefined : null,
      "img-src": ["'self'", "data:", "https://picsum.photos", "https://*.picsum.photos"]
    }
  }
}));
app.use(morgan('combined'));
app.use(express.json());

// Rate limit the whole API: 100 requests / 15 min per IP. Generous for
// normal browsing, tight enough to blunt scraping or brute-force attempts.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Auth guard for anything that writes data, or the admin page itself.
const requireAuth = basicAuth({
  users: { [process.env.ADMIN_USER]: process.env.ADMIN_PASS },
  challenge: true,
  realm: 'content-library-admin'
});

// --- Lightweight, cookie-free pageview logging ----------------------------
// No IP address, no cookies, no third-party script — just a path + referrer
// + timestamp row. Enough to answer "is anyone visiting" and "what's popular"
// without touching anything privacy-sensitive.
function logPageView(req, res, next) {
  try {
    db.prepare('INSERT INTO page_views (path, referrer) VALUES (?, ?)')
      .run(req.path, req.get('referrer') || null);
  } catch (err) {
    console.error('Failed to log page view:', err.message);
  }
  next();
}
app.get(['/', '/index.html'], logPageView);

// --- Static files ---------------------------------------------------------
// admin.html is gated behind basic auth before the static handler ever
// serves it.
app.get('/admin.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

// --- API: list content, with optional filters ---------------------------
app.get('/api/content', (req, res) => {
  const { category, topic } = req.query;
  let query = 'SELECT * FROM content';
  const clauses = [];
  const params = [];

  if (category && category !== 'all') {
    clauses.push('category = ?');
    params.push(category);
  }
  if (topic && topic !== 'all') {
    clauses.push('topic = ?');
    params.push(topic);
  }
  if (clauses.length) {
    query += ' WHERE ' + clauses.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// --- API: add a new content entry (auth required) -------------------------
app.post('/api/content', requireAuth, (req, res) => {
  const { title, description, category, topic, youtube_url } = req.body;

  if (!title || !description || !category || !topic || !youtube_url) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category.' });
  }
  if (!ALLOWED_TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic.' });
  }

  const youtubeId = extractYouTubeId(youtube_url);
  if (!youtubeId) {
    return res.status(400).json({ error: 'Could not read a YouTube video ID from that URL.' });
  }

  const stmt = db.prepare(`
    INSERT INTO content (title, description, category, topic, youtube_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(title, description, category, topic, youtubeId);
  const created = db.prepare('SELECT * FROM content WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// --- API: delete a content entry (auth required) ---------------------------
app.delete('/api/content/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM content WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(204).end();
});

// --- API: analytics summary (auth required) --------------------------------
app.get('/api/stats', requireAuth, (req, res) => {
  const totalViews = db.prepare('SELECT COUNT(*) AS n FROM page_views').get().n;
  const viewsByDay = db.prepare(`
    SELECT date(viewed_at) AS day, COUNT(*) AS n
    FROM page_views
    GROUP BY day
    ORDER BY day DESC
    LIMIT 30
  `).all();
  const topReferrers = db.prepare(`
    SELECT COALESCE(referrer, '(direct)') AS referrer, COUNT(*) AS n
    FROM page_views
    GROUP BY referrer
    ORDER BY n DESC
    LIMIT 10
  `).all();
  const totalContent = db.prepare('SELECT COUNT(*) AS n FROM content').get().n;

  res.json({ totalViews, totalContent, viewsByDay, topReferrers });
});

// --- Health check (for uptime monitors / load balancers) -------------------
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- robots.txt --------------------------------------------------------
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /admin.html\nDisallow: /api/\n');
});

// --- 404 + error handling ------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Content library running at http://localhost:${PORT}`);
});
