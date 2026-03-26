const fs = require('fs');
const path = require('path');
const util = require('util');
const vm = require('vm');
const http = require('http');
const { URL } = require('url');

const rootDir = path.resolve(__dirname, '..');
const QUESTIONS_PATH = path.join(rootDir, 'questions.json');
const SUBMISSIONS_PATH = path.join(rootDir, 'progress', 'question-submissions.json');

function ensureJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
  }
}

function readJson(filePath, fallback) {
  ensureJsonFile(filePath, fallback);
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function loadQuestions() {
  const parsed = readJson(QUESTIONS_PATH, []);
  return Array.isArray(parsed) ? parsed : [];
}

function loadQuestionSubmissions() {
  const parsed = readJson(SUBMISSIONS_PATH, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveQuestionSubmissions(submissions) {
  writeJson(SUBMISSIONS_PATH, submissions);
}

function findQuestion(idOrSlug) {
  const needle = String(idOrSlug || '').trim();
  return loadQuestions().find((question) => String(question.id) === needle || question.slug === needle) || null;
}

function filterQuestions({ difficulty, tag } = {}) {
  let questions = loadQuestions();
  if (difficulty) {
    questions = questions.filter((question) => String(question.difficulty || '').toLowerCase() === String(difficulty).toLowerCase());
  }
  if (tag) {
    questions = questions.filter((question) => Array.isArray(question.tags) && question.tags.includes(String(tag).toLowerCase()));
  }
  return questions;
}

function sanitizeSubmissionCode(code) {
  return String(code || '').replace(/\r\n/g, '\n').trimEnd();
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeComparable(value) {
  if (typeof value === 'undefined') return '__undefined__';
  return JSON.parse(JSON.stringify(value));
}

function buildJavaScriptRunner(question, code) {
  const functionName = String(question.functionName || '').trim();
  if (!functionName) {
    throw new Error('Question is missing functionName metadata.');
  }

  const wrapped = `
    "use strict";
    ${code}
    const candidate =
      typeof ${functionName} === 'function' ? ${functionName}
      : typeof solution === 'function' ? solution
      : typeof module.exports === 'function' ? module.exports
      : module.exports && typeof module.exports.${functionName} === 'function' ? module.exports.${functionName}
      : module.exports && typeof module.exports.solution === 'function' ? module.exports.solution
      : null;
    if (!candidate) {
      throw new Error("Expected a function named ${functionName} or module.exports");
    }
    module.exports = candidate;
  `;

  const context = {
    module: { exports: {} },
    exports: {},
    console: { log: () => {} },
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    Date,
    RegExp,
    parseInt,
    parseFloat,
    Infinity,
    NaN,
  };

  vm.createContext(context);
  const script = new vm.Script(wrapped, { filename: `${question.slug || 'submission'}.js` });
  script.runInContext(context, { timeout: 1000 });

  if (typeof context.module.exports !== 'function') {
    throw new Error('Submission did not export a callable function.');
  }

  return context.module.exports;
}

function runQuestionTests(question, { code, language = 'js' }) {
  const normalizedLanguage = String(language || 'js').toLowerCase();
  if (normalizedLanguage !== 'js') {
    throw new Error('Only JavaScript submissions are supported right now.');
  }

  const cleanCode = sanitizeSubmissionCode(code);
  if (!cleanCode) {
    throw new Error('Submission code is empty.');
  }

  const runner = buildJavaScriptRunner(question, cleanCode);
  const tests = Array.isArray(question.testCases) ? question.testCases : [];
  const startedAt = Date.now();
  const results = tests.map((testCase, index) => {
    const args = Array.isArray(testCase.args) ? cloneJsonSafe(testCase.args) : [];
    const expected = cloneJsonSafe(testCase.expected);
    const label = testCase.label || `Test ${index + 1}`;

    try {
      const actual = runner(...args);
      const passed = util.isDeepStrictEqual(normalizeComparable(actual), normalizeComparable(expected));
      return {
        label,
        passed,
        args,
        expected,
        actual,
        error: passed ? '' : 'Output mismatch',
      };
    } catch (error) {
      return {
        label,
        passed: false,
        args,
        expected,
        actual: null,
        error: error.message,
      };
    }
  });

  const passedCount = results.filter((result) => result.passed).length;
  return {
    questionSlug: question.slug,
    language: normalizedLanguage,
    passedAll: passedCount === results.length && results.length > 0,
    passedCount,
    totalTests: results.length,
    durationMs: Date.now() - startedAt,
    code: cleanCode,
    results,
  };
}

function summarizeSubmissions(submissions) {
  const safe = Array.isArray(submissions) ? submissions : [];
  const totalAttempts = safe.length;
  const passedAttempts = safe.filter((item) => item.passedAll).length;
  const latestAttemptAt = safe[0]?.createdAt || '';
  const byQuestion = {};

  safe.forEach((submission) => {
    const slug = String(submission.questionSlug || '');
    if (!slug) return;
    if (!byQuestion[slug]) {
      byQuestion[slug] = {
        attempts: 0,
        solvedCount: 0,
        latestResult: null,
      };
    }
    byQuestion[slug].attempts += 1;
    if (submission.passedAll) byQuestion[slug].solvedCount += 1;
    if (!byQuestion[slug].latestResult) byQuestion[slug].latestResult = submission;
  });

  return {
    totalAttempts,
    passedAttempts,
    passRate: totalAttempts ? Math.round((passedAttempts / totalAttempts) * 100) : 0,
    latestAttemptAt,
    byQuestion,
  };
}

function persistSubmission(result) {
  const submissions = loadQuestionSubmissions();
  submissions.unshift({
    questionSlug: result.questionSlug,
    language: result.language,
    passedAll: result.passedAll,
    passedCount: result.passedCount,
    totalTests: result.totalTests,
    durationMs: result.durationMs,
    createdAt: new Date().toISOString(),
    code: result.code,
    results: result.results,
  });
  saveQuestionSubmissions(submissions.slice(0, 200));
  return submissions[0];
}

function parseRequestBody(req, maxBodyBytes = 64 * 1024) {
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

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function createQuestionApiServer(port = Number(process.env.PORT || 5050)) {
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    if (pathname === '/api/questions' && req.method === 'GET') {
      sendJson(res, 200, filterQuestions({
        difficulty: reqUrl.searchParams.get('difficulty'),
        tag: reqUrl.searchParams.get('tag'),
      }));
      return;
    }

    if (pathname === '/api/question-submissions' && req.method === 'GET') {
      const submissions = loadQuestionSubmissions();
      sendJson(res, 200, {
        submissions,
        summary: summarizeSubmissions(submissions),
      });
      return;
    }

    const questionMatch = pathname.match(/^\/api\/questions\/([^/]+)$/);
    if (questionMatch && req.method === 'GET') {
      const question = findQuestion(decodeURIComponent(questionMatch[1]));
      if (!question) {
        sendJson(res, 404, { error: 'Question not found' });
        return;
      }
      sendJson(res, 200, question);
      return;
    }

    const submitMatch = pathname.match(/^\/api\/questions\/([^/]+)\/submit$/);
    if (submitMatch && req.method === 'POST') {
      const question = findQuestion(decodeURIComponent(submitMatch[1]));
      if (!question) {
        sendJson(res, 404, { error: 'Question not found' });
        return;
      }

      try {
        const payload = await parseRequestBody(req);
        const result = runQuestionTests(question, payload);
        const saved = payload.persist === false ? null : persistSubmission(result);
        sendJson(res, 200, { ...result, savedAttempt: saved });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  server.listen(port, () => {
    console.log(`Questions API running on http://localhost:${port}`);
  });

  return server;
}

if (require.main === module) {
  createQuestionApiServer();
}

module.exports = {
  QUESTIONS_PATH,
  SUBMISSIONS_PATH,
  loadQuestions,
  loadQuestionSubmissions,
  saveQuestionSubmissions,
  filterQuestions,
  findQuestion,
  runQuestionTests,
  summarizeSubmissions,
  persistSubmission,
  createQuestionApiServer,
};
