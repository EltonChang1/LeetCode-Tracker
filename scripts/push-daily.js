#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const { commitAndPushSolutionsRepo, syncSolutionsRepo } = require('./solutions-repo');

const rootDir = path.resolve(__dirname, '..');
const entriesPath = path.join(rootDir, 'progress', 'entries.json');
const userMessage = process.argv.slice(2).join(' ').trim();
const today = new Date().toISOString().slice(0, 10);
const message = userMessage || `leetcode: daily update ${today}`;

function run(cmd) {
  return execSync(cmd, { cwd: rootDir, stdio: 'pipe' }).toString('utf8').trim();
}

function runInherit(cmd) {
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

function readEntries() {
  if (!require('fs').existsSync(entriesPath)) return [];
  try {
    const raw = require('fs').readFileSync(entriesPath, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

try {
  const entries = readEntries();
  syncSolutionsRepo(entries);
  runInherit('node scripts/track.js dashboard');
  runInherit('git add .');

  const hasChanges = (() => {
    try {
      run('git diff --cached --quiet');
      return false;
    } catch {
      return true;
    }
  })();

  if (!hasChanges) {
    console.log('ℹ️ No staged changes to commit.');
    process.exit(0);
  }

  runInherit(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  runInherit('git push');
  const solutionsResult = commitAndPushSolutionsRepo(message);
  if (solutionsResult.pushed) {
    console.log('🗂️ Solutions repo pushed too.');
  } else if (solutionsResult.reason) {
    console.log(`⚠️ ${solutionsResult.reason}`);
  }
  console.log('🚀 Daily update pushed. Keep the streak alive!');
} catch (error) {
  const messageText = error && error.message ? error.message : String(error);
  console.error(`❌ Daily push failed: ${messageText}`);
  process.exit(1);
}
