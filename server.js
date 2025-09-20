const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const app = express();
const PORT = process.env.PORT || 4300;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
const packagesDir = path.join(__dirname, 'packages');

for (const dir of [uploadsDir, packagesDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}-${safeOriginal}`);
  }
});

const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const zip = new AdmZip(req.file.path);
    const packageId = path.basename(req.file.filename, path.extname(req.file.filename));
    const dest = path.join(packagesDir, packageId);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    zip.extractAllTo(dest, true);

    const { baseRelDir, manifestRelPath } = findManifestRelative(dest) || {};
    if (!manifestRelPath) {
      console.warn(`imsmanifest.xml not found for package ${packageId}`);
      return res.status(400).json({ error: 'imsmanifest.xml not found in package' });
    }

    const publicBase = `/packages/${packageId}${baseRelDir ? '/' + baseRelDir : ''}`;
    const publicManifest = `/packages/${packageId}/${manifestRelPath}`;
    return res.json({ id: packageId, path: publicBase, manifest: publicManifest });
  } catch (e) {
    console.error('Upload error', e);
    return res.status(500).json({ error: 'Failed to process SCORM package' });
  }
});

app.get('/api/packages', (req, res) => {
  try {
    const ids = fs
      .readdirSync(packagesDir)
      .filter((d) => fs.statSync(path.join(packagesDir, d)).isDirectory())
      .map((id) => {
        const dest = path.join(packagesDir, id);
        const found = findManifestRelative(dest);
        const baseRelDir = found?.baseRelDir || '';
        const manifestRelPath = found?.manifestRelPath || '';
        return {
          id,
          path: `/packages/${id}${baseRelDir ? '/' + baseRelDir : ''}`,
          manifest: manifestRelPath ? `/packages/${id}/${manifestRelPath}` : undefined
        };
      });
    res.json(ids);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list packages' });
  }
});

app.get('/api/packages/:id', (req, res) => {
  const id = req.params.id;
  try {
    const dest = path.join(packagesDir, id);
    if (!fs.existsSync(dest) || !fs.statSync(dest).isDirectory()) {
      return res.status(404).json({ error: 'Not found' });
    }
    const found = findManifestRelative(dest);
    const baseRelDir = found?.baseRelDir || '';
    const manifestRelPath = found?.manifestRelPath || '';
    return res.json({
      id,
      path: `/packages/${id}${baseRelDir ? '/' + baseRelDir : ''}`,
      manifest: manifestRelPath ? `/packages/${id}/${manifestRelPath}` : undefined
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get package' });
  }
});

// Serve extracted packages statically
app.use('/packages', express.static(packagesDir));

// Simple file-backed tracking per package
const trackingFile = path.join(__dirname, 'tracking.json');
const visitsFile = path.join(__dirname, 'visits.json');
function readTracking() {
  try {
    const raw = fs.readFileSync(trackingFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function writeTracking(data) {
  try { fs.writeFileSync(trackingFile, JSON.stringify(data, null, 2)); } catch {}
}
function readVisits() {
  try {
    const raw = fs.readFileSync(visitsFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function writeVisits(data) {
  try { fs.writeFileSync(visitsFile, JSON.stringify(data, null, 2)); } catch {}
}

app.post('/api/track/:packageId', (req, res) => {
  try {
    const pkg = req.params.packageId;
    const all = readTracking();
    const now = Date.now();
    const entry = { packageId: pkg, timestamp: now, ...(req.body || {}) };
    if (!all[pkg]) all[pkg] = [];
    all[pkg].push(entry);
    writeTracking(all);
    res.json({ ok: true, entry });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save tracking' });
  }
});

app.get('/api/track/:packageId', (req, res) => {
  const pkg = req.params.packageId;
  const all = readTracking();
  res.json(all[pkg] || []);
});

app.get('/api/track', (req, res) => {
  res.json(readTracking());
});

// Visits API
app.post('/api/visit/:packageId', (req, res) => {
  try {
    const id = req.params.packageId;
    const all = readVisits();
    const now = Date.now();
    const visitId = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const record = all[id];
    if (!record || typeof record === 'number') {
      all[id] = { count: (typeof record === 'number' ? record : 0) + 1, visits: [{ id: visitId, startedAt: now }] };
    } else {
      record.count = (record.count || 0) + 1;
      if (!Array.isArray(record.visits)) record.visits = [];
      record.visits.push({ id: visitId, startedAt: now });
      all[id] = record;
    }
    writeVisits(all);
    res.json({ packageId: id, count: (all[id].count || 0), visitId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

app.get('/api/visit/:packageId', (req, res) => {
  const id = req.params.packageId;
  const all = readVisits();
  const record = all[id];
  if (!record) return res.json({ packageId: id, count: 0, visits: [] });
  if (typeof record === 'number') return res.json({ packageId: id, count: record, visits: [] });
  return res.json({ packageId: id, count: record.count || 0, visits: record.visits || [] });
});

app.get('/api/visit', (req, res) => {
  res.json(readVisits());
});

// Combined tracking per visit
app.get('/api/track/:packageId/combined', (req, res) => {
  const pkg = req.params.packageId;
  try {
    const all = readTracking();
    const entries = (all[pkg] || []).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    // group by visitId (or 'unknown') and merge data
    const grouped = {};
    for (const e of entries) {
      const vid = e.visitId || 'unknown';
      if (!grouped[vid]) grouped[vid] = { visitId: vid, firstTimestamp: e.timestamp, lastTimestamp: e.timestamp, version: e.version, data: {} };
      grouped[vid].lastTimestamp = e.timestamp;
      grouped[vid].version = e.version || grouped[vid].version;
      Object.assign(grouped[vid].data, e.data || {});
    }
    // include visit metadata (startedAt) if present
    const visits = readVisits()[pkg];
    const visitsArr = Array.isArray(visits?.visits) ? visits.visits : [];
    for (const g of Object.values(grouped)) {
      const meta = visitsArr.find((v) => v.id === g.visitId);
      if (meta) g.startedAt = meta.startedAt;
    }
    res.json(Object.values(grouped));
  } catch (e) {
    res.status(500).json({ error: 'Failed to combine tracking' });
  }
});

app.get('/api/track/combined', (req, res) => {
  try {
    const all = readTracking();
    const result = {};
    for (const pkg of Object.keys(all)) {
      const reqMock = { params: { packageId: pkg } };
      const entries = (all[pkg] || []).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const grouped = {};
      for (const e of entries) {
        const vid = e.visitId || 'unknown';
        if (!grouped[vid]) grouped[vid] = { visitId: vid, firstTimestamp: e.timestamp, lastTimestamp: e.timestamp, version: e.version, data: {} };
        grouped[vid].lastTimestamp = e.timestamp;
        grouped[vid].version = e.version || grouped[vid].version;
        Object.assign(grouped[vid].data, e.data || {});
      }
      result[pkg] = Object.values(grouped);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to combine tracking' });
  }
});

app.listen(PORT, () => {
  console.log(`SCORM server listening on http://localhost:${PORT}`);
});

function findManifestRelative(rootDir) {
  const maxDepth = 6;
  const queue = [{ dir: rootDir, rel: '' , depth: 0}];
  while (queue.length) {
    const { dir, rel, depth } = queue.shift();
    if (depth > maxDepth) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    // look for manifest in this dir (case-insensitive)
    for (const e of entries) {
      if (e.isFile()) {
        if (e.name.toLowerCase() === 'imsmanifest.xml') {
          const manifestRelPath = path.posix.join(rel.replace(/\\/g, '/'), e.name);
          return { baseRelDir: rel.replace(/\\/g, '/'), manifestRelPath };
        }
      }
    }
    // enqueue subdirs
    for (const e of entries) {
      if (e.isDirectory()) {
        const childRel = rel ? path.join(rel, e.name) : e.name;
        queue.push({ dir: path.join(dir, e.name), rel: childRel, depth: depth + 1 });
      }
    }
  }
  return null;
}


