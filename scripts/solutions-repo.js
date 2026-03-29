const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const trackerRootDir = path.resolve(__dirname, '..');
const configPath = path.join(trackerRootDir, 'progress', 'solutions-repo.json');
const defaultLocalRepoPath = path.resolve(trackerRootDir, '..', 'LeetCode-Solutions');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFile(filePath, contents) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents, 'utf8');
  }
}

function run(command, cwd) {
  return execSync(command, { cwd, stdio: 'pipe' }).toString('utf8').trim();
}

function runInherit(command, cwd) {
  execSync(command, { cwd, stdio: 'inherit' });
}

function loadConfig() {
  const fallback = {
    enabled: true,
    localRepoPath: defaultLocalRepoPath,
    branch: 'main',
    remoteName: 'origin',
    remoteUrl: '',
    solutionsRoot: 'problems',
    autoPush: true,
  };

  if (!fs.existsSync(configPath)) {
    ensureDir(path.dirname(configPath));
    fs.writeFileSync(configPath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
    return fallback;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8').trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      localRepoPath: parsed.localRepoPath
        ? path.resolve(trackerRootDir, parsed.localRepoPath)
        : fallback.localRepoPath,
    };
  } catch {
    return fallback;
  }
}

function saveConfig(config) {
  const serializable = {
    ...config,
    localRepoPath: path.relative(trackerRootDir, config.localRepoPath).replace(/\\/g, '/'),
  };
  fs.writeFileSync(configPath, JSON.stringify(serializable, null, 2) + '\n', 'utf8');
}

function ensureGitRepo(repoPath, branch) {
  ensureDir(repoPath);

  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    runInherit('git init', repoPath);
  }

  try {
    const currentBranch = run('git branch --show-current', repoPath);
    if (!currentBranch) {
      runInherit(`git checkout -b ${branch}`, repoPath);
    }
  } catch {
    runInherit(`git checkout -b ${branch}`, repoPath);
  }
}

function ensureRepoScaffold(repoPath) {
  ensureFile(path.join(repoPath, '.gitignore'), '.DS_Store\n');
  ensureFile(
    path.join(repoPath, 'README.md'),
    [
      '# LeetCode Solutions',
      '',
      'Mirror repository for solution files created from `LeetCode-Tracker`.',
      '',
      '## Structure',
      '',
      '- `problems/YYYY/MM/DD/`: solution files grouped by solve date',
      '',
      'This repo is updated by the tracker workflow so solutions are stored locally and in GitHub.',
      '',
    ].join('\n')
  );
}

function copyFilePreserveTree(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function syncSolutionsRepo(entries) {
  const config = loadConfig();
  if (!config.enabled) {
    return { config, syncedFiles: [], repoReady: false };
  }

  ensureGitRepo(config.localRepoPath, config.branch);
  ensureRepoScaffold(config.localRepoPath);

  const syncedFiles = [];
  for (const entry of entries) {
    if (!entry.solutionPath) continue;
    const sourcePath = path.join(trackerRootDir, entry.solutionPath);
    if (!fs.existsSync(sourcePath)) continue;

    const destinationPath = path.join(config.localRepoPath, config.solutionsRoot, entry.solutionPath.replace(/^problems\//, ''));
    copyFilePreserveTree(sourcePath, destinationPath);
    syncedFiles.push(path.relative(config.localRepoPath, destinationPath).replace(/\\/g, '/'));
  }

  return {
    config,
    syncedFiles,
    repoReady: true,
  };
}

function setRemoteIfNeeded(config) {
  if (!config.remoteUrl) return false;

  const existingRemotes = run('git remote', config.localRepoPath)
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!existingRemotes.includes(config.remoteName)) {
    runInherit(`git remote add ${config.remoteName} ${config.remoteUrl}`, config.localRepoPath);
    return true;
  }

  const currentUrl = run(`git remote get-url ${config.remoteName}`, config.localRepoPath);
  if (currentUrl !== config.remoteUrl) {
    runInherit(`git remote set-url ${config.remoteName} ${config.remoteUrl}`, config.localRepoPath);
    return true;
  }

  return false;
}

function hasWorkingTreeChanges(repoPath) {
  try {
    run('git diff --quiet', repoPath);
    run('git diff --cached --quiet', repoPath);
    return false;
  } catch {
    return true;
  }
}

function commitAndPushSolutionsRepo(message) {
  const config = loadConfig();
  if (!config.enabled) {
    return { skipped: true, reason: 'Solutions repo sync is disabled.' };
  }

  try {
    ensureGitRepo(config.localRepoPath, config.branch);
    ensureRepoScaffold(config.localRepoPath);
    setRemoteIfNeeded(config);

    runInherit('git add .', config.localRepoPath);
    if (!hasWorkingTreeChanges(config.localRepoPath)) {
      return { skipped: true, reason: 'No solutions repo changes to commit.' };
    }

    runInherit(`git commit -m "${String(message || 'leetcode solutions update').replace(/"/g, '\\"')}"`, config.localRepoPath);

    if (!config.autoPush) {
      return { skipped: false, pushed: false, repoPath: config.localRepoPath };
    }

    if (!config.remoteUrl) {
      return { skipped: false, pushed: false, repoPath: config.localRepoPath, reason: 'No remote URL configured.' };
    }

    runInherit(`git push ${config.remoteName} ${config.branch}`, config.localRepoPath);
    return { skipped: false, pushed: true, repoPath: config.localRepoPath };
  } catch (error) {
    return {
      skipped: false,
      pushed: false,
      repoPath: config.localRepoPath,
      reason: `Solutions repo push failed: ${error.message || String(error)}`,
    };
  }
}

module.exports = {
  configPath,
  defaultLocalRepoPath,
  loadConfig,
  saveConfig,
  syncSolutionsRepo,
  commitAndPushSolutionsRepo,
};
