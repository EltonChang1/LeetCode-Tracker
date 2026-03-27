#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { syncLeetCodeEntries } = require('./leetcode-sync');
const {
  filterQuestions,
  findQuestion,
  loadQuestionSubmissions,
  persistSubmission,
  runQuestionTests,
  summarizeSubmissions,
} = require('./questions-api');

const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4321);
const allowWrites = process.env.LCQ_ALLOW_WRITE === '1';
const maxBodyBytes = 64 * 1024;

const entriesPath = path.join(rootDir, 'progress', 'entries.json');
const rewardsStatePath = path.join(rootDir, 'progress', 'rewards-state.json');
const dsaStatePath = path.join(rootDir, 'progress', 'dsa-state.json');
const trainingDbPath = path.join(rootDir, 'progress', 'training-db.json');

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
    if (!raw) return fallback;
    return JSON.parse(raw);
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

function sanitizeEntry(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const difficulty = String(payload.difficulty || '').toLowerCase();
  const language = String(payload.language || 'js').toLowerCase();
  const solvedAt = String(payload.solvedAt || '');
  const title = String(payload.title || '').trim().slice(0, 160);
  const id = String(payload.id || '').trim().slice(0, 80);

  if (!id || !title) return null;
  if (!['easy', 'medium', 'hard'].includes(difficulty)) return null;
  if (!isValidDateKey(solvedAt)) return null;

  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => String(tag).trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];

  return {
    id,
    title,
    difficulty,
    language,
    solvedAt,
    timeMinutes: Number.isFinite(Number(payload.timeMinutes)) ? Number(payload.timeMinutes) : null,
    tags,
    url: '',
    notes: String(payload.notes || '').slice(0, 400),
    createdAt: new Date().toISOString(),
  };
}

function sanitizeClaim(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const date = String(payload.date || '');
  if (!isValidDateKey(date)) return null;

  const claim = payload.claim;
  if (!claim || typeof claim !== 'object') return null;

  const rarity = String(claim.rarity || '').toLowerCase();
  if (!['common', 'rare', 'epic', 'legendary'].includes(rarity)) return null;

  const rewards = claim.rewards || {};
  const coins = Number(rewards.coins);
  const tokens = Number(rewards.tokens);
  const gems = Number(rewards.gems);
  if (![coins, tokens, gems].every((value) => Number.isFinite(value) && value >= 0 && value <= 10000)) {
    return null;
  }

  return {
    date,
    claim: {
      rarity,
      rewards: {
        coins: Math.round(coins),
        tokens: Math.round(tokens),
        gems: Math.round(gems),
      },
      eventActive: Boolean(claim.eventActive),
      claimedAt: new Date().toISOString(),
    },
  };
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

  if (requestUrl === '/api/training-db' && req.method === 'GET') {
    sendJson(res, 200, readJson(trainingDbPath, {
      owner: { name: 'Elton', mode: 'single-user', role: 'Future LeetCode Master' },
      goal: { title: 'Become a LeetCode master in DSA', focus: 'Train pattern recognition, implementation speed, and review discipline.' },
      leetcodeUsername: 'EltonChang1',
      curriculum: { currentPhase: '', topicSequence: [], questionSequence: [] },
      masteryRules: { questionMasteryConfidence: 4, topicMasteryPercent: 75, reviewUrgencyDays: 2 },
    }));
    return;
  }

  if (requestUrl === '/api/entries' && req.method === 'POST') {
    if (!allowWrites) {
      sendJson(res, 403, { error: 'Write API disabled. Start with LCQ_ALLOW_WRITE=1.' });
      return;
    }

    parseBody(req)
      .then((payload) => {
        const entry = sanitizeEntry(payload.entry);
        if (!entry) {
          sendJson(res, 400, { error: 'Invalid entry payload.' });
          return;
        }

        const entries = readJson(entriesPath, []);
        const duplicate = entries.some(
          (item) => String(item.id) === String(entry.id) && item.solvedAt === entry.solvedAt && item.language === entry.language
        );

        if (duplicate) {
          sendJson(res, 409, { error: 'Duplicate entry.' });
          return;
        }

        entries.push(entry);
        writeJson(entriesPath, entries);
        sendJson(res, 200, { ok: true, entry });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (requestUrl === '/api/rewards/claim' && req.method === 'POST') {
    if (!allowWrites) {
      sendJson(res, 403, { error: 'Write API disabled. Start with LCQ_ALLOW_WRITE=1.' });
      return;
    }

    parseBody(req)
      .then((payload) => {
        const parsed = sanitizeClaim(payload);
        if (!parsed) {
          sendJson(res, 400, { error: 'Invalid chest claim payload.' });
          return;
        }

        const rewardsState = readJson(rewardsStatePath, { wallet: { coins: 0, tokens: 0, gems: 0 }, claims: {} });
        rewardsState.wallet = rewardsState.wallet || { coins: 0, tokens: 0, gems: 0 };
        rewardsState.claims = rewardsState.claims || {};

        if (rewardsState.claims[parsed.date]) {
          sendJson(res, 409, { error: 'Chest already claimed for this date.' });
          return;
        }

        rewardsState.claims[parsed.date] = parsed.claim;
        rewardsState.wallet.coins += parsed.claim.rewards.coins;
        rewardsState.wallet.tokens += parsed.claim.rewards.tokens;
        rewardsState.wallet.gems += parsed.claim.rewards.gems;

        writeJson(rewardsStatePath, rewardsState);
        sendJson(res, 200, { ok: true, wallet: rewardsState.wallet, claim: parsed.claim });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return;
  }

  if (requestUrl === '/api/leetcode/sync' && req.method === 'POST') {
    if (!allowWrites) {
      sendJson(res, 403, { error: 'Write API disabled. Start with LCQ_ALLOW_WRITE=1.' });
      return;
    }

    parseBody(req)
      .then(async (payload) => {
        const username = String(payload.username || '').trim();
        const limit = Number(payload.limit || 20);
        const bootstrapMode = Boolean(payload.bootstrapMode);

        const entries = readJson(entriesPath, []);
        const result = await syncLeetCodeEntries({
          username,
          limit,
          existingEntries: entries,
          bootstrapMode,
        });

        if (result.imported.length) {
          entries.push(...result.imported);
          writeJson(entriesPath, entries);
        }

        sendJson(res, 200, {
          ok: true,
          username: result.username,
          fetchedAccepted: result.fetchedAccepted,
          localAccepted: result.localAccepted,
          globalAccepted: result.globalAccepted,
          localByDifficulty: result.localByDifficulty,
          globalByDifficulty: result.globalByDifficulty,
          visibilityLimited: result.visibilityLimited,
          bootstrapUsed: result.bootstrapUsed,
          bootstrapImportedCount: result.bootstrapImportedCount,
          importedCount: result.imported.length,
          imported: result.imported,
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
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

  if (requestUrl === '/api/questions' && req.method === 'GET') {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    sendJson(res, 200, filterQuestions({
      difficulty: reqUrl.searchParams.get('difficulty'),
      tag: reqUrl.searchParams.get('tag'),
    }));
    return;
  }

  if (requestUrl === '/api/question-submissions' && req.method === 'GET') {
    const submissions = loadQuestionSubmissions();
    sendJson(res, 200, {
      submissions,
      summary: summarizeSubmissions(submissions),
    });
    return;
  }

  const questionMatch = requestUrl.match(/^\/api\/questions\/([^/]+)$/);
  if (questionMatch && req.method === 'GET') {
    const question = findQuestion(decodeURIComponent(questionMatch[1]));
    if (!question) {
      sendJson(res, 404, { error: 'Question not found' });
      return;
    }
    sendJson(res, 200, question);
    return;
  }

  const submitMatch = requestUrl.match(/^\/api\/questions\/([^/]+)\/submit$/);
  if (submitMatch && req.method === 'POST') {
    const question = findQuestion(decodeURIComponent(submitMatch[1]));
    if (!question) {
      sendJson(res, 404, { error: 'Question not found' });
      return;
    }

    parseBody(req)
      .then((payload) => {
        const result = runQuestionTests(question, payload);
        const shouldPersist = allowWrites && payload.persist !== false;
        const savedAttempt = shouldPersist ? persistSubmission(result) : null;
        sendJson(res, 200, {
          ...result,
          savedAttempt,
          persisted: Boolean(savedAttempt),
        });
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
