#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const entriesPath = path.join(rootDir, 'progress', 'entries.json');
const dashboardPath = path.join(rootDir, 'DASHBOARD.md');
const profilePath = path.join(rootDir, 'progress', 'profile.json');
const bossesPath = path.join(rootDir, 'progress', 'bosses.json');

const pointsByDifficulty = {
  easy: 10,
  medium: 20,
  hard: 40,
};

const FREEZE_WINDOW_DAYS = 14;
const FREEZE_ALLOWANCE_PER_WINDOW = 1;

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

function readBosses() {
  const fallback = [
    {
      id: 'array-overlord',
      name: 'Array Overlord',
      theme: 'arrays, pointers, and windows',
      requiredTags: ['array', 'two-pointers', 'sliding-window'],
      tiers: [
        { name: 'Bronze', requirements: { solves: 3 } },
        { name: 'Silver', requirements: { solves: 5, mediumPlus: 2 } },
        { name: 'Gold', requirements: { solves: 7, mediumPlus: 3 } },
        { name: 'Diamond', requirements: { solves: 10, hard: 1 } },
      ],
    },
  ];

  if (!fs.existsSync(bossesPath)) {
    fs.writeFileSync(bossesPath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
    return fallback;
  }

  try {
    const raw = fs.readFileSync(bossesPath, 'utf8').trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
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

function missesAllowedForSpan(spanDays) {
  if (spanDays <= 0) return 0;
  return Math.ceil(spanDays / FREEZE_WINDOW_DAYS) * FREEZE_ALLOWANCE_PER_WINDOW;
}

function calculateProtectedStreak(dateSet, endDateObj) {
  let span = 0;
  let missesUsed = 0;
  let solvedCount = 0;
  let cursor = new Date(endDateObj);

  while (span < 5000) {
    span += 1;
    const key = toDateKey(cursor);

    if (dateSet.has(key)) {
      solvedCount += 1;
    } else {
      missesUsed += 1;
    }

    const allowed = missesAllowedForSpan(span);
    if (missesUsed > allowed) {
      span -= 1;
      break;
    }

    cursor = addDays(cursor, -1);
  }

  if (solvedCount === 0) {
    return {
      streak: 0,
      missesUsed: 0,
      missesAllowed: FREEZE_ALLOWANCE_PER_WINDOW,
    };
  }

  return {
    streak: span,
    missesUsed,
    missesAllowed: missesAllowedForSpan(span),
  };
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

function getWeekStartMonday(dateObj) {
  const result = new Date(dateObj);
  const day = result.getDay();
  const distance = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - distance);
  return new Date(`${toDateKey(result)}T00:00:00`);
}

function getWeekIndex(dateObj) {
  const yearStart = new Date(dateObj.getFullYear(), 0, 1);
  return Math.ceil((((dateObj - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
}

function getCurrentBoss(dateObj = toDate(getToday())) {
  const bosses = readBosses();
  if (!bosses.length) {
    return null;
  }
  const weekIndex = getWeekIndex(dateObj);
  return bosses[weekIndex % bosses.length];
}

function checkRequirements(progress, requirements = {}) {
  const needed = {
    solves: requirements.solves || 0,
    mediumPlus: requirements.mediumPlus || 0,
    hard: requirements.hard || 0,
    tagHits: requirements.tagHits || 0,
  };

  return {
    passed:
      progress.solves >= needed.solves &&
      progress.mediumPlus >= needed.mediumPlus &&
      progress.hard >= needed.hard &&
      progress.tagHits >= needed.tagHits,
    needed,
  };
}

function getBossProgress(entries, dateObj = toDate(getToday())) {
  const boss = getCurrentBoss(dateObj);
  if (!boss) {
    return null;
  }

  const weekStart = getWeekStartMonday(dateObj);
  const weekEnd = addDays(weekStart, 6);

  const weekEntries = entries.filter((entry) => {
    const d = toDate(entry.solvedAt);
    return d >= weekStart && d <= weekEnd;
  });

  const tagSet = new Set((boss.requiredTags || []).map((tag) => String(tag).toLowerCase()));

  let tagHits = 0;
  let mediumPlus = 0;
  let hard = 0;

  for (const entry of weekEntries) {
    if (entry.difficulty === 'medium' || entry.difficulty === 'hard') {
      mediumPlus += 1;
    }
    if (entry.difficulty === 'hard') {
      hard += 1;
    }
    const hasTag = (entry.tags || []).some((tag) => tagSet.has(String(tag).toLowerCase()));
    if (hasTag) {
      tagHits += 1;
    }
  }

  const progress = {
    solves: weekEntries.length,
    mediumPlus,
    hard,
    tagHits,
  };

  let achievedTier = null;
  let nextTier = null;

  for (const tier of boss.tiers || []) {
    const result = checkRequirements(progress, tier.requirements || {});
    if (result.passed) {
      achievedTier = tier;
    } else if (!nextTier) {
      nextTier = {
        ...tier,
        remaining: {
          solves: Math.max(0, result.needed.solves - progress.solves),
          mediumPlus: Math.max(0, result.needed.mediumPlus - progress.mediumPlus),
          hard: Math.max(0, result.needed.hard - progress.hard),
          tagHits: Math.max(0, result.needed.tagHits - progress.tagHits),
        },
      };
      break;
    }
  }

  return {
    boss,
    weekRange: `${toDateKey(weekStart)} to ${toDateKey(weekEnd)}`,
    progress,
    achievedTier,
    nextTier,
  };
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

  const currentProtected = calculateProtectedStreak(dateSet, today);
  let currentStreak = currentProtected.streak;

  let longest = 0;
  if (sortedDates.length > 0) {
    const earliest = toDate(sortedDates[0]);
    let cursor = earliest;
    while (cursor <= today) {
      const candidate = calculateProtectedStreak(dateSet, cursor).streak;
      if (candidate > longest) longest = candidate;
      cursor = addDays(cursor, 1);
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
    freezeMissesUsed: currentProtected.missesUsed,
    freezeMissesAllowed: currentProtected.missesAllowed,
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
  const bossStatus = getBossProgress(entries);
  const recentLines = stats.recent.length
    ? stats.recent
        .map((e) => `- ${e.solvedAt} · #${e.id} ${e.title} (${formatDifficulty(e.difficulty)}) [${e.language}]`) 
        .join('\n')
    : '- No solves yet. Add your first one today 🚀';

  const bossSection = bossStatus
    ? `## Weekly Boss Fight\n- Boss: **${bossStatus.boss.name}** (${bossStatus.boss.theme})\n- Week: **${bossStatus.weekRange}**\n- Progress: solves=${bossStatus.progress.solves}, medium+=${bossStatus.progress.mediumPlus}, hard=${bossStatus.progress.hard}, themeHits=${bossStatus.progress.tagHits}\n- Reward Tier: **${bossStatus.achievedTier ? bossStatus.achievedTier.name : 'Unranked'}**\n${bossStatus.nextTier ? `- Next Tier: **${bossStatus.nextTier.name}** (remaining: solves ${bossStatus.nextTier.remaining.solves}, medium+ ${bossStatus.nextTier.remaining.mediumPlus}, hard ${bossStatus.nextTier.remaining.hard}, themeHits ${bossStatus.nextTier.remaining.tagHits})` : '- Max tier reached this week: **Diamond**'}\n\n`
    : '';

  const markdown = `# LeetCode Progress Dashboard\n\n## Snapshot\n- Total Solved: **${stats.total}**\n- Solved Days: **${stats.solvedDays}**\n- Current Streak: **${stats.currentStreak} day(s)**\n- Longest Streak: **${stats.longestStreak} day(s)**\n- XP: **${stats.xp}**\n- Level: **${stats.level}**\n- Streak Shield: **${stats.freezeMissesUsed}/${stats.freezeMissesAllowed} miss used** (1 miss allowed per 14 days)\n\n## Daily Mission\n- ${mission.title}\n- ${mission.detail}\n- Nudge: ${nudge}\n\n${bossSection}## Consistency Score\n- Last 7 active days: **${stats.weekActiveDays}/7**\n- Consistency score: **${stats.consistencyScore}/100**\n\n## Difficulty Breakdown\n- Easy: **${stats.byDifficulty.easy}**\n- Medium: **${stats.byDifficulty.medium}**\n- Hard: **${stats.byDifficulty.hard}**\n\n## 14-Day Consistency\n${renderWeekBar(entries)}\n\n## Achievements\n${achievements.map((a) => `- ${a}`).join('\n')}\n\n## Recent Solves\n${recentLines}\n\n---\nAuto-generated by \`npm run lc:dashboard\`.\n`;

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
  const bossStatus = getBossProgress(entries);

  console.log(`✅ Logged #${entry.id} ${entry.title} (${formatDifficulty(entry.difficulty)})`);
  console.log(`📁 Solution file: ${entry.solutionPath}`);
  console.log(`🔥 Current streak: ${stats.currentStreak} day(s)`);
  if (bossStatus) {
    console.log(`👹 Weekly Boss: ${bossStatus.boss.name}`);
    console.log(`🏆 Tier: ${bossStatus.achievedTier ? bossStatus.achievedTier.name : 'Unranked'}`);
    if (bossStatus.nextTier) {
      console.log(
        `➡️ Next ${bossStatus.nextTier.name}: solves +${bossStatus.nextTier.remaining.solves}, medium+ +${bossStatus.nextTier.remaining.mediumPlus}, hard +${bossStatus.nextTier.remaining.hard}, themeHits +${bossStatus.nextTier.remaining.tagHits}`
      );
    }
  }
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
  console.log(`🛡️ Streak shield usage: ${stats.freezeMissesUsed}/${stats.freezeMissesAllowed} (1 miss per 14 days)`);
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
  const bossStatus = getBossProgress(entries);

  console.log('🎮 LeetCode Daily Game Mode');
  console.log(`- ${mission.title}`);
  console.log(`- ${mission.detail}`);
  console.log(`- Consistency: ${stats.weekActiveDays}/7 days this week (${stats.consistencyScore}/100)`);
  console.log(`- Current streak: ${stats.currentStreak}`);
  console.log(`- Shield usage: ${stats.freezeMissesUsed}/${stats.freezeMissesAllowed}`);
  if (bossStatus) {
    console.log(`- Boss: ${bossStatus.boss.name} [${bossStatus.achievedTier ? bossStatus.achievedTier.name : 'Unranked'}]`);
  }
  console.log(`- ${nudge}`);
}

function showBoss(entries) {
  const bossStatus = getBossProgress(entries);
  if (!bossStatus) {
    console.log('No boss configured. Add progress/bosses.json to enable boss fights.');
    return;
  }

  console.log('👹 Weekly Boss Fight');
  console.log(`- Boss: ${bossStatus.boss.name}`);
  console.log(`- Theme: ${bossStatus.boss.theme}`);
  console.log(`- Week: ${bossStatus.weekRange}`);
  console.log(
    `- Progress: solves=${bossStatus.progress.solves}, medium+=${bossStatus.progress.mediumPlus}, hard=${bossStatus.progress.hard}, themeHits=${bossStatus.progress.tagHits}`
  );
  console.log(`- Current Tier: ${bossStatus.achievedTier ? bossStatus.achievedTier.name : 'Unranked'}`);
  if (bossStatus.nextTier) {
    console.log(`- Next Tier: ${bossStatus.nextTier.name}`);
    console.log(
      `  remaining => solves ${bossStatus.nextTier.remaining.solves}, medium+ ${bossStatus.nextTier.remaining.mediumPlus}, hard ${bossStatus.nextTier.remaining.hard}, themeHits ${bossStatus.nextTier.remaining.tagHits}`
    );
  } else {
    console.log('- Max tier reached this week: Diamond');
  }
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

    if (command === 'boss') {
      showBoss(entries);
      return;
    }

    console.log('Usage:');
    console.log('  npm run lc:add -- --id 1 --title "Two Sum" --difficulty easy --lang js --tags array,hash --time 15');
    console.log('  npm run lc:today');
    console.log('  npm run lc:dashboard');
    console.log('  npm run lc:mission');
    console.log('  npm run lc:boss');
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

main();
