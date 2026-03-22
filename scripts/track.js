#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const entriesPath = path.join(rootDir, 'progress', 'entries.json');
const dashboardPath = path.join(rootDir, 'DASHBOARD.md');
const profilePath = path.join(rootDir, 'progress', 'profile.json');

const pointsByDifficulty = {
  easy: 10,
  medium: 20,
  hard: 40,
};

function ensureFile(filePath, fallback = '[]\n') {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, fallback, 'utf8');
  }
}

function readEntries() {
  ensureFile(entriesPath);
  const raw = fs.readFileSync(entriesPath, 'utf8').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('progress/entries.json is invalid JSON');
  }
}

function readProfile() {
  const defaults = {
    dailyMinimum: 1,
    targetMinutes: 20,
    preferredWarmupDifficulty: 'easy',
    maxPainMinutes: 30,
  };

  if (!fs.existsSync(profilePath)) {
    fs.writeFileSync(profilePath, JSON.stringify(defaults, null, 2) + '\n', 'utf8');
    return defaults;
  }

  try {
    const raw = fs.readFileSync(profilePath, 'utf8').trim();
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return defaults;
  }
}

function writeEntries(entries) {
  const sorted = [...entries].sort((a, b) => {
    if (a.solvedAt === b.solvedAt) return String(a.id).localeCompare(String(b.id));
    return a.solvedAt.localeCompare(b.solvedAt);
  });
  fs.writeFileSync(entriesPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDifficulty(input) {
  if (!input) return null;
  const normalized = String(input).trim().toLowerCase();
  if (!pointsByDifficulty[normalized]) return null;
  return normalized;
}

function normalizeLanguage(input) {
  const raw = String(input || '').trim().toLowerCase();
  const aliases = {
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    python: 'py',
    py: 'py',
    java: 'java',
    cpp: 'cpp',
    cplusplus: 'cpp',
    cxx: 'cpp',
    go: 'go',
  };
  return aliases[raw] || raw || 'txt';
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function parseDateOrToday(input) {
  if (!input) return getToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error('Date must be YYYY-MM-DD');
  }
  return input;
}

function formatDifficulty(d) {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function templateForLanguage(entry, extension) {
  const meta = [
    `Title: ${entry.title}`,
    `LeetCode ID: ${entry.id}`,
    `Difficulty: ${formatDifficulty(entry.difficulty)}`,
    `Solved At: ${entry.solvedAt}`,
    `Tags: ${entry.tags.join(', ') || 'N/A'}`,
    `URL: ${entry.url || 'N/A'}`,
    '',
    'Notes:',
    entry.notes || 'Add approach notes here.',
    '',
  ];

  if (extension === 'py') {
    return `"""\n${meta.join('\n')}\n"""\n\nclass Solution:\n    def solve(self):\n        pass\n`;
  }

  if (extension === 'java') {
    return `/*\n${meta.join('\n')}\n*/\n\nclass Solution {\n    public void solve() {\n    }\n}\n`;
  }

  if (extension === 'cpp') {
    return `/*\n${meta.join('\n')}\n*/\n\nclass Solution {\npublic:\n    void solve() {\n    }\n};\n`;
  }

  if (extension === 'go') {
    return `/*\n${meta.join('\n')}\n*/\n\npackage main\n\nfunc solve() {\n}\n`;
  }

  if (extension === 'ts') {
    return `/*\n${meta.join('\n')}\n*/\n\nfunction solve(): void {\n}\n`;
  }

  return `/*\n${meta.join('\n')}\n*/\n\nfunction solve() {\n}\n`;
}

function ensureProblemFile(entry) {
  const [year, month, day] = entry.solvedAt.split('-');
  const language = normalizeLanguage(entry.language);
  const problemDir = path.join(rootDir, 'problems', year, month, day);
  fs.mkdirSync(problemDir, { recursive: true });

  const id = String(entry.id).padStart(4, '0');
  const fileName = `${id}-${slugify(entry.title)}.${language}`;
  const fullPath = path.join(problemDir, fileName);

  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, templateForLanguage(entry, language), 'utf8');
  }

  return path.relative(rootDir, fullPath).replace(/\\/g, '/');
}

function toDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateObj, days) {
  const result = new Date(dateObj);
  result.setDate(result.getDate() + days);
  return result;
}

function getEntriesByDate(entries) {
  return entries.reduce((acc, entry) => {
    acc[entry.solvedAt] = (acc[entry.solvedAt] || 0) + 1;
    return acc;
  }, {});
}

function randomPick(list, seedSource) {
  if (!list.length) return '';
  let seed = 0;
  const source = String(seedSource || getToday());
  for (let i = 0; i < source.length; i += 1) {
    seed += source.charCodeAt(i) * (i + 1);
  }
  return list[seed % list.length];
}

function calculateStats(entries) {
  const total = entries.length;
  const byDifficulty = { easy: 0, medium: 0, hard: 0 };

  for (const entry of entries) {
    if (byDifficulty[entry.difficulty] !== undefined) {
      byDifficulty[entry.difficulty] += 1;
    }
  }

  const dateSet = new Set(entries.map((e) => e.solvedAt));
  const sortedDates = [...dateSet].sort();
  const today = toDate(getToday());

  let longest = 0;
  let currentRun = 0;
  let prevDate = null;

  for (const dateStr of sortedDates) {
    const currDate = toDate(dateStr);
    if (!prevDate) {
      currentRun = 1;
    } else {
      const diffDays = Math.round((currDate - prevDate) / 86400000);
      currentRun = diffDays === 1 ? currentRun + 1 : 1;
    }
    if (currentRun > longest) longest = currentRun;
    prevDate = currDate;
  }

  let currentStreak = 0;
  if (sortedDates.length > 0) {
    const latest = toDate(sortedDates[sortedDates.length - 1]);
    const deltaFromToday = Math.round((today - latest) / 86400000);

    if (deltaFromToday <= 1) {
      currentStreak = 1;
      let cursor = latest;
      for (let i = sortedDates.length - 2; i >= 0; i -= 1) {
        const prev = toDate(sortedDates[i]);
        const diff = Math.round((cursor - prev) / 86400000);
        if (diff === 1) {
          currentStreak += 1;
          cursor = prev;
        } else {
          break;
        }
      }
      if (deltaFromToday === 1) {
        currentStreak = 0;
      }
    }
  }

  const xp = entries.reduce((sum, e) => sum + (pointsByDifficulty[e.difficulty] || 0), 0);
  const level = Math.floor(xp / 100) + 1;

  const todayKey = getToday();
  const byDate = getEntriesByDate(entries);
  const todayCount = byDate[todayKey] || 0;

  const weekStart = addDays(toDate(todayKey), -6);
  let weekActiveDays = 0;
  for (let i = 0; i < 7; i += 1) {
    const key = toDateKey(addDays(weekStart, i));
    if (byDate[key]) weekActiveDays += 1;
  }

  const consistencyScore = Math.min(100, Math.round((weekActiveDays / 7) * 100));

  return {
    total,
    byDifficulty,
    solvedDays: sortedDates.length,
    currentStreak,
    longestStreak: longest,
    xp,
    level,
    todayCount,
    weekActiveDays,
    consistencyScore,
    recent: [...entries].sort((a, b) => b.solvedAt.localeCompare(a.solvedAt)).slice(0, 10),
  };
}

function getDailyMission(stats, profile) {
  if (stats.todayCount >= profile.dailyMinimum) {
    return {
      status: 'complete',
      title: 'Daily mission complete 🎉',
      detail: 'Take the bonus quest: solve 1 medium or review 1 past mistake.',
    };
  }

  const timeCap = Math.min(profile.maxPainMinutes, profile.targetMinutes);
  return {
    status: 'open',
    title: 'Today\'s mission 🎯',
    detail: `Solve ${profile.dailyMinimum} ${profile.preferredWarmupDifficulty} problem in ≤ ${timeCap} min. Start with a 2-minute timer, not motivation.`,
  };
}

function getNudge(stats) {
  if (stats.todayCount > 0) {
    return randomPick(
      [
        'Momentum secured. Small wins compound.',
        'You already showed up today. That is the hardest part.',
        'Nice. Protect your future self with one more clean commit.',
      ],
      `${getToday()}-done`
    );
  }

  return randomPick(
    [
      'Don\'t aim to finish, aim to begin. Two minutes is enough.',
      'Keep the promise tiny: one easy problem, then stop if needed.',
      'Make it painless: open one problem, write one function signature.',
    ],
    `${getToday()}-start`
  );
}

function getAchievements(stats) {
  const list = [];

  if (stats.total >= 1) list.push('🥚 First Solve');
  if (stats.currentStreak >= 3) list.push('🔥 3-Day Streak');
  if (stats.longestStreak >= 7) list.push('🏅 Week Warrior');
  if (stats.byDifficulty.hard >= 10) list.push('🧠 Hard Hunter');
  if (stats.total >= 50) list.push('💪 Consistency Grinder');
  if (stats.total >= 100) list.push('👑 Century Club');

  return list.length ? list : ['🌱 Keep going — your first badge is one solve away!'];
}

function renderWeekBar(entries) {
  const dateSet = new Set(entries.map((e) => e.solvedAt));
  const today = toDate(getToday());
  const start = addDays(today, -13);
  const chunks = [];

  for (let i = 0; i < 14; i += 1) {
    const d = addDays(start, i);
    const key = toDateKey(d);
    const mark = dateSet.has(key) ? '✅' : '⬜️';
    chunks.push(`${mark} ${key.slice(5)}`);
  }

  return chunks.join(' | ');
}

function renderDashboard(entries) {
  const stats = calculateStats(entries);
  const profile = readProfile();
  const achievements = getAchievements(stats);
  const mission = getDailyMission(stats, profile);
  const nudge = getNudge(stats);
  const recentLines = stats.recent.length
    ? stats.recent
        .map((e) => `- ${e.solvedAt} · #${e.id} ${e.title} (${formatDifficulty(e.difficulty)}) [${e.language}]`) 
        .join('\n')
    : '- No solves yet. Add your first one today 🚀';

  const markdown = `# LeetCode Progress Dashboard\n\n## Snapshot\n- Total Solved: **${stats.total}**\n- Solved Days: **${stats.solvedDays}**\n- Current Streak: **${stats.currentStreak} day(s)**\n- Longest Streak: **${stats.longestStreak} day(s)**\n- XP: **${stats.xp}**\n- Level: **${stats.level}**\n\n## Daily Mission\n- ${mission.title}\n- ${mission.detail}\n- Nudge: ${nudge}\n\n## Consistency Score\n- Last 7 active days: **${stats.weekActiveDays}/7**\n- Consistency score: **${stats.consistencyScore}/100**\n\n## Difficulty Breakdown\n- Easy: **${stats.byDifficulty.easy}**\n- Medium: **${stats.byDifficulty.medium}**\n- Hard: **${stats.byDifficulty.hard}**\n\n## 14-Day Consistency\n${renderWeekBar(entries)}\n\n## Achievements\n${achievements.map((a) => `- ${a}`).join('\n')}\n\n## Recent Solves\n${recentLines}\n\n---\nAuto-generated by \`npm run lc:dashboard\`.\n`;

  fs.writeFileSync(dashboardPath, markdown, 'utf8');
  return stats;
}

function addEntry(args) {
  const id = args.id;
  const title = args.title;
  const difficulty = normalizeDifficulty(args.difficulty);
  const language = normalizeLanguage(args.lang || args.language || 'js');

  if (!id || !title || !difficulty) {
    throw new Error('Missing required fields. Use --id --title --difficulty and optional --lang');
  }

  const solvedAt = parseDateOrToday(args.date);
  const timeMinutes = args.time ? Number(args.time) : null;

  if (timeMinutes !== null && Number.isNaN(timeMinutes)) {
    throw new Error('--time must be a valid number');
  }

  const tags = String(args.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const entries = readEntries();

  const duplicate = entries.find(
    (e) => String(e.id) === String(id) && e.solvedAt === solvedAt && e.language === language
  );

  if (duplicate) {
    throw new Error(`Duplicate entry found for #${id} on ${solvedAt} with language ${language}`);
  }

  const entry = {
    id: String(id),
    title: String(title).trim(),
    difficulty,
    language,
    solvedAt,
    timeMinutes,
    tags,
    url: args.url ? String(args.url).trim() : '',
    notes: args.notes ? String(args.notes).trim() : '',
    createdAt: new Date().toISOString(),
  };

  entry.solutionPath = ensureProblemFile(entry);

  entries.push(entry);
  writeEntries(entries);
  const stats = renderDashboard(entries);

  console.log(`✅ Logged #${entry.id} ${entry.title} (${formatDifficulty(entry.difficulty)})`);
  console.log(`📁 Solution file: ${entry.solutionPath}`);
  console.log(`🔥 Current streak: ${stats.currentStreak} day(s)`);
}

function showToday(entries) {
  const today = getToday();
  const todaysEntries = entries.filter((e) => e.solvedAt === today);
  const stats = calculateStats(entries);
  const profile = readProfile();
  const mission = getDailyMission(stats, profile);
  const nudge = getNudge(stats);

  console.log(`📅 Today: ${today}`);
  console.log(`🧩 Solved today: ${todaysEntries.length}`);
  console.log(`🔥 Current streak: ${stats.currentStreak}`);
  console.log(`🏁 Longest streak: ${stats.longestStreak}`);
  console.log(`⭐ XP: ${stats.xp} | Level: ${stats.level}`);
  console.log(`📈 Consistency score: ${stats.consistencyScore}/100`);
  console.log(`🎯 ${mission.title}`);
  console.log(`   ${mission.detail}`);
  console.log(`💬 ${nudge}`);

  if (todaysEntries.length) {
    console.log('\nToday\'s solves:');
    for (const entry of todaysEntries) {
      console.log(`- #${entry.id} ${entry.title} (${formatDifficulty(entry.difficulty)})`);
    }
  } else {
    console.log('\nNo solve logged yet today. Grab a quick Easy and keep the streak alive! 🚀');
  }
}

function showMission(entries) {
  const stats = calculateStats(entries);
  const profile = readProfile();
  const mission = getDailyMission(stats, profile);
  const nudge = getNudge(stats);

  console.log('🎮 LeetCode Daily Game Mode');
  console.log(`- ${mission.title}`);
  console.log(`- ${mission.detail}`);
  console.log(`- Consistency: ${stats.weekActiveDays}/7 days this week (${stats.consistencyScore}/100)`);
  console.log(`- Current streak: ${stats.currentStreak}`);
  console.log(`- ${nudge}`);
}

function main() {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  try {
    if (command === 'add') {
      addEntry(args);
      return;
    }

    const entries = readEntries();

    if (command === 'dashboard') {
      const stats = renderDashboard(entries);
      console.log(`✅ Dashboard updated: solved=${stats.total}, streak=${stats.currentStreak}`);
      return;
    }

    if (command === 'today') {
      showToday(entries);
      return;
    }

    if (command === 'mission') {
      showMission(entries);
      return;
    }

    console.log('Usage:');
    console.log('  npm run lc:add -- --id 1 --title "Two Sum" --difficulty easy --lang js --tags array,hash --time 15');
    console.log('  npm run lc:today');
    console.log('  npm run lc:dashboard');
    console.log('  npm run lc:mission');
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

main();
