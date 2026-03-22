#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const userMessage = process.argv.slice(2).join(' ').trim();
const today = new Date().toISOString().slice(0, 10);
const message = userMessage || `leetcode: daily update ${today}`;

function run(cmd) {
  return execSync(cmd, { cwd: rootDir, stdio: 'pipe' }).toString('utf8').trim();
}

function runInherit(cmd) {
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

try {
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
  console.log('🚀 Daily update pushed. Keep the streak alive!');
} catch (error) {
  const messageText = error && error.message ? error.message : String(error);
  console.error(`❌ Daily push failed: ${messageText}`);
  process.exit(1);
}
