#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4321);
const allowWrites = process.env.LCQ_ALLOW_WRITE === '1';
const maxBodyBytes = 64 * 1024;
const dsaStatePath = path.join(rootDir, 'progress', 'dsa-state.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', () => reject(new Error('Request stream error')));
  });
}

function isValidDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sanitizeDsaQuestionState(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const status = String(payload.status || 'not-started');
  const allowedStatuses = new Set(['not-started', 'in-progress', 'solved', 'review', 'mastered']);
  if (!allowedStatuses.has(status)) return null;

  const cleanDate = (value) => {
    const date = String(value || '');
    return isValidDateKey(date) ? date : '';
  };

  return {
    status,
    notes: String(payload.notes || '').slice(0, 2000),
    patternNote: String(payload.patternNote || '').slice(0, 240),
    mistakeNote: String(payload.mistakeNote || '').slice(0, 240),
    lastTouched: cleanDate(payload.lastTouched),
    nextReviewAt: cleanDate(payload.nextReviewAt),
    attempts: Math.max(0, Math.min(999, Math.round(Number(payload.attempts) || 0))),
    confidence: Math.max(0, Math.min(5, Math.round(Number(payload.confidence) || 0))),
    expanded: Boolean(payload.expanded),
  };
}

function sanitizeDsaState(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const result = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === '__meta') continue;
    if (!/^[a-z0-9-]{1,120}$/i.test(key)) continue;
    const sanitized = sanitizeDsaQuestionState(value);
    if (!sanitized) continue;
    result[key] = sanitized;
  }

  const session = payload.__meta?.session || {};
  result.__meta = {
    session: {
      active: Boolean(session.active),
      queue: Array.isArray(session.queue) ? session.queue.map((item) => String(item).slice(0, 120)).filter(Boolean).slice(0, 12) : [],
      currentIndex: Math.max(0, Math.min(12, Math.round(Number(session.currentIndex) || 0))),
      stepIndex: Math.max(0, Math.min(8, Math.round(Number(session.stepIndex) || 0))),
      startedAt: typeof session.startedAt === 'string' ? session.startedAt.slice(0, 40) : '',
    },
  };

  return result;
}

function resolvePath(urlPath) {
  if (urlPath === '/') return path.join(rootDir, 'web', 'index.html');
  const normalized = path.normalize(urlPath).replace(/^\/+/, '');
  return path.join(rootDir, normalized);
}

const server = http.createServer((req, res) => {
  const requestUrl = req.url.split('?')[0];

  if (requestUrl === '/api/state' && req.method === 'GET') {
    sendJson(res, 200, { allowWrites });
    return;
  }

  if (requestUrl === '/api/dsa-state' && req.method === 'GET') {
    const dsaState = readJson(dsaStatePath, {});
    sendJson(res, 200, { ok: true, state: dsaState, allowWrites });
    return;
  }

  if (requestUrl === '/api/dsa-state' && req.method === 'POST') {
    if (!allowWrites) {
      sendJson(res, 403, { error: 'Write API disabled. Start with LCQ_ALLOW_WRITE=1.' });
      return;
    }

    parseBody(req)
      .then((payload) => {
        const dsaState = sanitizeDsaState(payload.state);
        if (!dsaState) {
          sendJson(res, 400, { error: 'Invalid DSA state payload.' });
          return;
        }

        writeJson(dsaStatePath, dsaState);
        sendJson(res, 200, { ok: true, state: dsaState });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  const filePath = resolvePath(requestUrl);

  if (!filePath.startsWith(rootDir)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        send(res, 404, 'Not found');
      } else {
        send(res, 500, 'Server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || 'application/octet-stream');
  });
});

server.listen(port, () => {
  console.log(`🎮 LeetCode Game Dashboard running at http://localhost:${port}`);
  console.log('Tip: Open /web/index.html if you want the explicit path.');
  console.log(`Write API: ${allowWrites ? 'enabled' : 'disabled'} (set LCQ_ALLOW_WRITE=1 to enable)`);
});
