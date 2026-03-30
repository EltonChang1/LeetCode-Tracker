const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const vm = require('vm');
const http = require('http');
const { spawnSync } = require('child_process');
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

function normalizeLanguage(value) {
  const language = String(value || 'js').toLowerCase();
  if (language === 'python') return 'py';
  if (language === 'c++') return 'cpp';
  return ['js', 'py', 'cpp'].includes(language) ? language : 'js';
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

function runPythonQuestionTests(question, cleanCode, tests) {
  const functionName = String(question.functionName || '').trim();
  if (!functionName) {
    throw new Error('Question is missing functionName metadata.');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcq-py-'));
  const scriptPath = path.join(tempDir, `${question.slug || 'submission'}.py`);
  const testsPayload = Buffer.from(JSON.stringify(tests)).toString('base64');

  const script = `
import base64
import copy
import json

${cleanCode}

tests = json.loads(base64.b64decode("${testsPayload}").decode("utf-8"))
candidate = globals().get("${functionName}") or globals().get("solution")
if not callable(candidate):
    raise Exception("Expected a function named ${functionName} or solution")

results = []
for index, test in enumerate(tests):
    args = copy.deepcopy(test.get("args", []))
    expected = test.get("expected")
    label = test.get("label") or f"Test {index + 1}"
    try:
        actual = candidate(*args)
        passed = actual == expected
        results.append({
            "label": label,
            "passed": passed,
            "args": args,
            "expected": expected,
            "actual": actual,
            "error": "" if passed else "Output mismatch",
        })
    except Exception as error:
        results.append({
            "label": label,
            "passed": False,
            "args": args,
            "expected": expected,
            "actual": None,
            "error": str(error),
        })

print(json.dumps({"results": results}, ensure_ascii=False))
`.trimStart();

  fs.writeFileSync(scriptPath, script, 'utf8');
  const startedAt = Date.now();
  const execution = spawnSync('python3', [scriptPath], {
    encoding: 'utf8',
    timeout: 4000,
  });
  fs.rmSync(tempDir, { recursive: true, force: true });

  if (execution.error) {
    throw new Error(execution.error.message);
  }
  if (execution.status !== 0) {
    throw new Error((execution.stderr || execution.stdout || 'Python execution failed').trim());
  }

  const payload = JSON.parse((execution.stdout || '').trim() || '{}');
  const results = Array.isArray(payload.results) ? payload.results : [];
  return {
    results,
    durationMs: Date.now() - startedAt,
  };
}

function inferCppType(value) {
  if (Array.isArray(value)) {
    const sample = value.find((item) => typeof item !== 'undefined');
    return `std::vector<${inferCppType(typeof sample === 'undefined' ? 0 : sample)}>`;
  }
  if (typeof value === 'string') return 'std::string';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double';
  if (value === null) return 'std::nullptr_t';
  throw new Error(`Unsupported C++ test value type: ${typeof value}`);
}

function escapeCppString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function cppLiteral(value) {
  if (Array.isArray(value)) {
    return `{${value.map((item) => cppLiteral(item)).join(', ')}}`;
  }
  if (typeof value === 'string') return `"${escapeCppString(value)}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (value === null) return 'nullptr';
  throw new Error(`Unsupported C++ literal type: ${typeof value}`);
}

function cppSerializeExpression(expression, sampleValue) {
  if (Array.isArray(sampleValue)) {
    const childSample = sampleValue.find((item) => typeof item !== 'undefined');
    const childExpr = cppSerializeExpression('item', typeof childSample === 'undefined' ? 0 : childSample);
    return `([&]() {
      std::ostringstream oss;
      oss << "[";
      for (size_t i = 0; i < ${expression}.size(); ++i) {
        if (i) oss << ",";
        const auto& item = ${expression}[i];
        oss << ${childExpr};
      }
      oss << "]";
      return oss.str();
    }())`;
  }
  if (typeof sampleValue === 'string') {
    return `([&]() {
      std::ostringstream oss;
      oss << "\\"";
      for (char ch : ${expression}) {
        switch (ch) {
          case '\\\\': oss << "\\\\\\\\"; break;
          case '"': oss << "\\\\\\""; break;
          case '\\n': oss << "\\\\n"; break;
          case '\\r': oss << "\\\\r"; break;
          case '\\t': oss << "\\\\t"; break;
          default: oss << ch; break;
        }
      }
      oss << "\\"";
      return oss.str();
    }())`;
  }
  if (typeof sampleValue === 'boolean') {
    return `(${expression} ? "true" : "false")`;
  }
  if (typeof sampleValue === 'number') {
    return `([&]() {
      std::ostringstream oss;
      oss << ${expression};
      return oss.str();
    }())`;
  }
  return '"null"';
}

function buildCppHarness(question, cleanCode, tests) {
  const functionName = String(question.functionName || '').trim();
  if (!functionName) {
    throw new Error('Question is missing functionName metadata.');
  }
  if (!tests.length) {
    throw new Error('Question has no test cases.');
  }

  const firstArgs = Array.isArray(tests[0].args) ? tests[0].args : [];
  const argTypes = firstArgs.map((value) => inferCppType(value));
  const argDeclarations = argTypes.map((type, index) => `${type} arg${index + 1}`).join(', ');
  const expectedType = inferCppType(tests[0].expected);
  const expectedSerializer = cppSerializeExpression('expected', tests[0].expected);
  const actualSerializer = cppSerializeExpression('actual', tests[0].expected);

  const cases = tests.map((testCase, index) => {
    const args = Array.isArray(testCase.args) ? testCase.args : [];
    const argLines = args
      .map((value, argIndex) => `    ${argTypes[argIndex]} arg${argIndex + 1} = ${cppLiteral(value)};`)
      .join('\n');
    return `
  {
    std::string label = "${escapeCppString(testCase.label || `Test ${index + 1}`)}";
${argLines}
    ${expectedType} expected = ${cppLiteral(testCase.expected)};
    try {
      auto actual = ${functionName}(${args.map((_, argIndex) => `arg${argIndex + 1}`).join(', ')});
      bool passed = (actual == expected);
      results.push_back(ResultRecord{
        label,
        passed,
        "${escapeCppString(JSON.stringify(args))}",
        ${expectedSerializer},
        ${actualSerializer},
        passed ? "" : "Output mismatch"
      });
    } catch (const std::exception& error) {
      results.push_back(ResultRecord{
        label,
        false,
        "${escapeCppString(JSON.stringify(args))}",
        ${expectedSerializer},
        "null",
        error.what()
      });
    } catch (...) {
      results.push_back(ResultRecord{
        label,
        false,
        "${escapeCppString(JSON.stringify(args))}",
        ${expectedSerializer},
        "null",
        "Unknown C++ error"
      });
    }
  }`;
  }).join('\n');

  return `
#include <cstddef>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

${cleanCode}

struct ResultRecord {
  std::string label;
  bool passed;
  std::string argsJson;
  std::string expectedJson;
  std::string actualJson;
  std::string error;
};

static std::string escapeJson(const std::string& value) {
  std::ostringstream oss;
  for (char ch : value) {
    switch (ch) {
      case '\\\\': oss << "\\\\\\\\"; break;
      case '"': oss << "\\\\\\""; break;
      case '\\n': oss << "\\\\n"; break;
      case '\\r': oss << "\\\\r"; break;
      case '\\t': oss << "\\\\t"; break;
      default: oss << ch; break;
    }
  }
  return oss.str();
}

int main() {
  std::vector<ResultRecord> results;
${cases}

  std::cout << "{\\"results\\":[";
  for (size_t i = 0; i < results.size(); ++i) {
    if (i) std::cout << ",";
    const auto& result = results[i];
    std::cout
      << "{\\"label\\":\\"" << escapeJson(result.label) << "\\""
      << ",\\"passed\\":" << (result.passed ? "true" : "false")
      << ",\\"args\\":" << result.argsJson
      << ",\\"expected\\":" << result.expectedJson
      << ",\\"actual\\":" << result.actualJson
      << ",\\"error\\":\\"" << escapeJson(result.error) << "\\"}";
  }
  std::cout << "]}";
  return 0;
}
`.trimStart();
}

function runCppQuestionTests(question, cleanCode, tests) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcq-cpp-'));
  const sourcePath = path.join(tempDir, `${question.slug || 'submission'}.cpp`);
  const binaryPath = path.join(tempDir, 'submission.out');

  fs.writeFileSync(sourcePath, buildCppHarness(question, cleanCode, tests), 'utf8');

  const compileStartedAt = Date.now();
  const compile = spawnSync('g++', ['-std=c++17', '-O2', sourcePath, '-o', binaryPath], {
    encoding: 'utf8',
    timeout: 8000,
  });
  if (compile.error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error(compile.error.message);
  }
  if (compile.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error((compile.stderr || compile.stdout || 'C++ compilation failed').trim());
  }

  const execution = spawnSync(binaryPath, [], {
    encoding: 'utf8',
    timeout: 4000,
  });
  const durationMs = Date.now() - compileStartedAt;
  fs.rmSync(tempDir, { recursive: true, force: true });

  if (execution.error) {
    throw new Error(execution.error.message);
  }
  if (execution.status !== 0) {
    throw new Error((execution.stderr || execution.stdout || 'C++ execution failed').trim());
  }

  const payload = JSON.parse((execution.stdout || '').trim() || '{}');
  const results = Array.isArray(payload.results) ? payload.results : [];
  return {
    results,
    durationMs,
  };
}

function runQuestionTests(question, { code, language = 'js' }) {
  const normalizedLanguage = normalizeLanguage(language);

  const cleanCode = sanitizeSubmissionCode(code);
  if (!cleanCode) {
    throw new Error('Submission code is empty.');
  }

  const tests = Array.isArray(question.testCases) ? question.testCases : [];
  const startedAt = Date.now();
  let results = [];
  let durationMs = Date.now() - startedAt;

  if (normalizedLanguage === 'js') {
    const runner = buildJavaScriptRunner(question, cleanCode);
    results = tests.map((testCase, index) => {
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
    durationMs = Date.now() - startedAt;
  } else if (normalizedLanguage === 'py') {
    const pythonResult = runPythonQuestionTests(question, cleanCode, tests);
    results = pythonResult.results;
    durationMs = pythonResult.durationMs;
  } else if (normalizedLanguage === 'cpp') {
    const cppResult = runCppQuestionTests(question, cleanCode, tests);
    results = cppResult.results;
    durationMs = cppResult.durationMs;
  } else {
    throw new Error('Unsupported language.');
  }

  const passedCount = results.filter((result) => result.passed).length;
  return {
    questionSlug: question.slug,
    language: normalizedLanguage,
    passedAll: passedCount === results.length && results.length > 0,
    passedCount,
    totalTests: results.length,
    durationMs,
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
