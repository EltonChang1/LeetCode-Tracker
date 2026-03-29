#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const {
  loadConfig,
  saveConfig,
  syncSolutionsRepo,
} = require('./solutions-repo');

const trackerRootDir = path.resolve(__dirname, '..');

function run(command, cwd = trackerRootDir) {
  return execSync(command, { cwd, stdio: 'pipe' }).toString('utf8').trim();
}

function runInherit(command, cwd = trackerRootDir) {
  execSync(command, { cwd, stdio: 'inherit' });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function getOriginOwner() {
  try {
    const remote = run('git remote get-url origin');
    const match = remote.match(/github\.com[:/]([^/]+)\/[^/]+(?:\.git)?$/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function ghAuthenticated() {
  try {
    run('gh auth status');
    return true;
  } catch {
    return false;
  }
}

function remoteExists(owner, repo) {
  try {
    run(`gh repo view ${owner}/${repo}`);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const owner = String(args.owner || getOriginOwner() || '').trim();
  const repoName = String(args.repo || 'LeetCode-Solutions').trim();
  const localRepoPath = args.path ? path.resolve(trackerRootDir, String(args.path)) : config.localRepoPath;

  const nextConfig = {
    ...config,
    enabled: true,
    localRepoPath,
  };

  let remoteUrl = String(args.remote || '').trim();
  const wantCreate = Boolean(args.create);

  if (!remoteUrl && owner && repoName) {
    remoteUrl = `https://github.com/${owner}/${repoName}.git`;
  }

  if (wantCreate && owner && repoName) {
    if (!ghAuthenticated()) {
      console.log('⚠️ GitHub CLI is not authenticated, so the remote repo could not be created automatically.');
      console.log('   Run `gh auth login` and then rerun this command with `--create`.');
    } else if (!remoteExists(owner, repoName)) {
      runInherit(`gh repo create ${owner}/${repoName} --public --confirm`);
    }
  }

  nextConfig.remoteUrl = remoteUrl;
  saveConfig(nextConfig);
  const syncResult = syncSolutionsRepo([]);

  console.log(`✅ Solutions repo configured at ${syncResult.config.localRepoPath}`);
  if (syncResult.config.remoteUrl) {
    console.log(`🔗 Remote target: ${syncResult.config.remoteUrl}`);
  } else {
    console.log('🔗 No remote configured yet.');
  }
}

main();
