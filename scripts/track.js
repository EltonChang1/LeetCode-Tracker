#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { syncLeetCodeEntries } = require('./leetcode-sync');
const { syncSolutionsRepo } = require('./solutions-repo');

const rootDir = path.resolve(__dirname, '..');
const entriesPath = path.join(rootDir, 'progress', 'entries.json');
const dashboardPath = path.join(rootDir, 'DASHBOARD.md');
const profilePath = path.join(rootDir, 'progress', 'profile.json');
const bossesPath = path.join(rootDir, 'progress', 'bosses.json');
const leaguesPath = path.join(rootDir, 'progress', 'leagues.json');
const raidBossesPath = path.join(rootDir, 'progress', 'raid-bosses.json');
const rewardsPath = path.join(rootDir, 'progress', 'rewards.json');
const rewardsStatePath = path.join(rootDir, 'progress', 'rewards-state.json');

const pointsByDifficulty = {
  easy: 10,
  medium: 20,
  hard: 40,
};

const FREEZE_WINDOW_DAYS = 14;
const FREEZE_ALLOWANCE_PER_WINDOW = 1;

const ELO_BASE = 1000;
const ELO_TARGET_BY_DIFFICULTY = {
  easy: 900,
  medium: 1150,
  hard: 1400,
};
const ELO_K_BY_DIFFICULTY = {
  easy: 16,
  medium: 24,
  hard: 32,
};
const ELO_RANKS = [
  { name: 'Iron', minRating: 0 },
  { name: 'Bronze', minRating: 900 },
  { name: 'Silver', minRating: 1050 },
  { name: 'Gold', minRating: 1200 },
  { name: 'Platinum', minRating: 1350 },
  { name: 'Diamond', minRating: 1500 },
  { name: 'Master', minRating: 1700 },
  { name: 'Grandmaster', minRating: 1900 },
];

const rewardDefaults = {
  intensity: 'balanced',
  intensities: {
    casual: {
      multiplierStep: 0.05,
      maxMultiplier: 1.6,
      streakPerStep: 3,
      baseChestBoost: 0,
    },
    balanced: {
      multiplierStep: 0.1,
      maxMultiplier: 2.2,
      streakPerStep: 3,
      baseChestBoost: 1,
    },
    hardcore: {
      multiplierStep: 0.15,
      maxMultiplier: 3,
      streakPerStep: 2,
      baseChestBoost: 2,
    },
  },
  chest: {
    rarityWeights: {
      common: 58,
      rare: 28,
      epic: 11,
      legendary: 3,
    },
    rewards: {
      common: {
        coins: [40, 80],
        tokens: [0, 1],
        gems: [0, 0],
      },
      rare: {
        coins: [90, 170],
        tokens: [1, 3],
        gems: [0, 1],
      },
      epic: {
        coins: [180, 320],
        tokens: [2, 5],
        gems: [2, 5],
      },
      legendary: {
        coins: [350, 550],
        tokens: [5, 10],
        gems: [6, 12],
      },
    },
  },
  weekendEvent: {
    enabled: true,
    days: [0, 6],
    name: 'Lucky Streak Weekend',
    multiplierCapBonus: 0.6,
    chestWeightBonus: {
      common: -12,
      rare: 6,
      epic: 4,
      legendary: 2,
    },
    chestCoinBonus: 25,
    tagline: 'Fortune favors consistency. Weekend rewards are juiced.',
  },
  midweekEvent: {
    enabled: true,
    days: [2, 3, 4],
    name: 'Midweek Momentum',
    raidDamageMultiplier: 1.2,
    teamDamageMultiplier: 1.08,
    comboStep: 3,
    comboBonusPerStep: 35,
    tagline: 'Combo chains empower your raid squad Tuesday through Thursday.',
  },
};

const rewardStateDefaults = {
  wallet: {
    coins: 0,
    tokens: 0,
    gems: 0,
  },
  claims: {},
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

function readLeagueConfig() {
  const fallback = {
    seasonAnchorDate: '2026-01-01',
    seasonLengthDays: 90,
    tiers: [
      { name: 'Bronze', minPoints: 0 },
      { name: 'Silver', minPoints: 300 },
      { name: 'Gold', minPoints: 700 },
      { name: 'Platinum', minPoints: 1200 },
      { name: 'Diamond', minPoints: 1800 },
      { name: 'Master', minPoints: 2600 },
      { name: 'Grandmaster', minPoints: 3600 },
    ],
  };

  if (!fs.existsSync(leaguesPath)) {
    fs.writeFileSync(leaguesPath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
    return fallback;
  }

  try {
    const raw = fs.readFileSync(leaguesPath, 'utf8').trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      ...fallback,
      ...parsed,
      tiers: Array.isArray(parsed.tiers) && parsed.tiers.length ? parsed.tiers : fallback.tiers,
    };
  } catch {
    return fallback;
  }
}

function readRaidBosses() {
  const fallback = [
    {
      id: 'kraken-of-complexity',
      name: 'Kraken of Complexity',
      element: 'Algorithmic Depth',
      weeklyHp: 1600,
      weaknessTags: ['graph', 'dp', 'tree'],
      loot: 'Complexity Core',
    },
  ];

  if (!fs.existsSync(raidBossesPath)) {
    fs.writeFileSync(raidBossesPath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
    return fallback;
  }

  try {
    const raw = fs.readFileSync(raidBossesPath, 'utf8').trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readRewardsConfig() {
  if (!fs.existsSync(rewardsPath)) {
    fs.writeFileSync(rewardsPath, JSON.stringify(rewardDefaults, null, 2) + '\n', 'utf8');
    return rewardDefaults;
  }

  try {
    const raw = fs.readFileSync(rewardsPath, 'utf8').trim();
    if (!raw) return rewardDefaults;
    const parsed = JSON.parse(raw);
    return {
      ...rewardDefaults,
      ...parsed,
      intensities: {
        ...rewardDefaults.intensities,
        ...(parsed.intensities || {}),
      },
      chest: {
        ...rewardDefaults.chest,
        ...(parsed.chest || {}),
        rarityWeights: {
          ...rewardDefaults.chest.rarityWeights,
          ...((parsed.chest && parsed.chest.rarityWeights) || {}),
        },
        rewards: {
          ...rewardDefaults.chest.rewards,
          ...((parsed.chest && parsed.chest.rewards) || {}),
        },
      },
      weekendEvent: {
        ...rewardDefaults.weekendEvent,
        ...(parsed.weekendEvent || {}),
      },
      midweekEvent: {
        ...rewardDefaults.midweekEvent,
        ...(parsed.midweekEvent || {}),
      },
    };
  } catch {
    return rewardDefaults;
  }
}

function readRewardsState() {
  if (!fs.existsSync(rewardsStatePath)) {
    fs.writeFileSync(rewardsStatePath, JSON.stringify(rewardStateDefaults, null, 2) + '\n', 'utf8');
    return rewardStateDefaults;
  }

  try {
    const raw = fs.readFileSync(rewardsStatePath, 'utf8').trim();
    if (!raw) return rewardStateDefaults;
    const parsed = JSON.parse(raw);
    return {
      ...rewardStateDefaults,
      ...parsed,
      wallet: {
        ...rewardStateDefaults.wallet,
        ...(parsed.wallet || {}),
      },
      claims: {
        ...((parsed.claims && typeof parsed.claims === 'object') ? parsed.claims : {}),
      },
    };
  } catch {
    return rewardStateDefaults;
  }
}

function writeRewardsState(state) {
  fs.writeFileSync(rewardsStatePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
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

function ratingToRank(rating) {
  let current = ELO_RANKS[0];
  let next = null;
  for (let i = 0; i < ELO_RANKS.length; i += 1) {
    const rank = ELO_RANKS[i];
    if (rating >= rank.minRating) {
      current = rank;
      next = ELO_RANKS[i + 1] || null;
    }
  }
  return { current, next };
}

function getSortedEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.solvedAt !== b.solvedAt) return a.solvedAt.localeCompare(b.solvedAt);
    if ((a.createdAt || '') !== (b.createdAt || '')) return (a.createdAt || '').localeCompare(b.createdAt || '');
    return String(a.id).localeCompare(String(b.id));
  });
}

function calculateEloProgress(entries) {
  const sorted = getSortedEntries(entries);
  let rating = ELO_BASE;

  for (const entry of sorted) {
    const target = ELO_TARGET_BY_DIFFICULTY[entry.difficulty] || ELO_BASE;
    const k = ELO_K_BY_DIFFICULTY[entry.difficulty] || 16;
    const expected = 1 / (1 + 10 ** ((target - rating) / 400));
    rating += k * (1 - expected);
  }

  rating = Math.max(300, Math.round(rating));
  const rank = ratingToRank(rating);
  const progressToNext = rank.next
    ? Math.max(0, Math.min(100, Math.round(((rating - rank.current.minRating) / (rank.next.minRating - rank.current.minRating)) * 100)))
    : 100;

  return {
    rating,
    rank: rank.current.name,
    nextRank: rank.next ? rank.next.name : null,
    toNext: rank.next ? Math.max(0, rank.next.minRating - rating) : 0,
    progressToNext,
  };
}

function getSeasonInfo(entries, dateObj = toDate(getToday())) {
  const config = readLeagueConfig();
  const anchor = toDate(config.seasonAnchorDate || '2026-01-01');
  const seasonLengthDays = Math.max(1, Number(config.seasonLengthDays || 90));

  const daysFromAnchor = Math.floor((dateObj - anchor) / 86400000);
  const seasonIndex = daysFromAnchor >= 0 ? Math.floor(daysFromAnchor / seasonLengthDays) : 0;
  const seasonStart = addDays(anchor, seasonIndex * seasonLengthDays);
  const seasonEnd = addDays(seasonStart, seasonLengthDays - 1);

  const inSeason = entries.filter((entry) => {
    const d = toDate(entry.solvedAt);
    return d >= seasonStart && d <= seasonEnd;
  });

  const seasonPoints = inSeason.reduce((sum, entry) => {
    const base = pointsByDifficulty[entry.difficulty] || 0;
    const bonus = entry.difficulty === 'hard' ? 15 : entry.difficulty === 'medium' ? 5 : 0;
    return sum + base + bonus;
  }, 0);

  const tiers = [...config.tiers].sort((a, b) => a.minPoints - b.minPoints);
  let tier = tiers[0];
  let nextTier = null;
  for (let i = 0; i < tiers.length; i += 1) {
    if (seasonPoints >= tiers[i].minPoints) {
      tier = tiers[i];
      nextTier = tiers[i + 1] || null;
    }
  }

  return {
    seasonId: `S${seasonIndex + 1}`,
    seasonRange: `${toDateKey(seasonStart)} to ${toDateKey(seasonEnd)}`,
    seasonLengthDays,
    points: seasonPoints,
    tier: tier ? tier.name : 'Bronze',
    nextTier: nextTier ? nextTier.name : null,
    toNext: nextTier ? Math.max(0, nextTier.minPoints - seasonPoints) : 0,
    solves: inSeason.length,
  };
}

function pseudoRandomNumber(seedText, min, max) {
  const seed = String(seedText || 'seed');
  let value = 0;
  for (let i = 0; i < seed.length; i += 1) {
    value = (value * 31 + seed.charCodeAt(i)) % 1000000;
  }
  const ratio = value / 1000000;
  return Math.floor(min + ratio * (max - min + 1));
}

function getIntensityProfile(rewardConfig) {
  const intensityKey = rewardConfig.intensity || 'balanced';
  const selected = rewardConfig.intensities[intensityKey] || rewardConfig.intensities.balanced;
  return {
    key: intensityKey,
    ...selected,
  };
}

function getLuckyWeekendEvent(rewardConfig, dateObj = toDate(getToday())) {
  const event = rewardConfig.weekendEvent || rewardDefaults.weekendEvent;
  const days = Array.isArray(event.days) && event.days.length ? event.days : [0, 6];
  const active = Boolean(event.enabled) && days.includes(dateObj.getDay());
  return {
    ...event,
    active,
  };
}

function getMidweekMomentumEvent(rewardConfig, dateObj = toDate(getToday())) {
  const event = rewardConfig.midweekEvent || rewardDefaults.midweekEvent;
  const days = Array.isArray(event.days) && event.days.length ? event.days : [2, 3, 4];
  const active = Boolean(event.enabled) && days.includes(dateObj.getDay());
  return {
    ...event,
    active,
  };
}

function getDayName(dayIndex) {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[dayIndex] || 'Unknown';
}

function getEventSchedule(eventConfig, fallbackDays, dateObj = toDate(getToday())) {
  const event = eventConfig || {};
  const rawDays = Array.isArray(event.days) && event.days.length ? event.days : fallbackDays;
  const days = rawDays
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  const enabled = Boolean(event.enabled);
  if (!enabled || !days.length) {
    return {
      active: false,
      enabled,
      nextDayLabel: 'disabled',
    };
  }

  const today = dateObj.getDay();
  if (days.includes(today)) {
    return {
      active: true,
      enabled,
      nextDayLabel: `Today (${getDayName(today)})`,
    };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = (today + offset) % 7;
    if (days.includes(candidate)) {
      return {
        active: false,
        enabled,
        nextDayLabel: getDayName(candidate),
      };
    }
  }

  return {
    active: false,
    enabled,
    nextDayLabel: 'unknown',
  };
}

function getBoostedWeights(weights, event) {
  const source = {
    ...weights,
  };

  if (!event.active) {
    return source;
  }

  const bonus = event.chestWeightBonus || {};
  const result = {};
  for (const rarity of Object.keys(source)) {
    result[rarity] = Math.max(1, Number(source[rarity]) + Number(bonus[rarity] || 0));
  }
  return result;
}

function getStreakMultiplier(currentStreak, rewardConfig, event = getLuckyWeekendEvent(rewardConfig)) {
  const profile = getIntensityProfile(rewardConfig);
  const steps = Math.floor(Math.max(0, currentStreak) / Math.max(1, profile.streakPerStep || 3));
  const raw = 1 + steps * (profile.multiplierStep || 0.1);
  const cap = (profile.maxMultiplier || 2) + (event.active ? Number(event.multiplierCapBonus || 0) : 0);
  const multiplier = Math.min(cap, raw);
  return {
    intensity: profile.key,
    cap: Number(cap.toFixed(2)),
    multiplier: Number(multiplier.toFixed(2)),
  };
}

function pickWeightedRarity(weights, seedText) {
  const entries = Object.entries(weights || {}).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return 'common';
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
  const roll = pseudoRandomNumber(`${seedText}-rarity`, 1, total);

  let cursor = 0;
  for (const [rarity, value] of entries) {
    cursor += Number(value);
    if (roll <= cursor) {
      return rarity;
    }
  }
  return entries[entries.length - 1][0];
}

function rollDailyChest(todayKey, entries, stats, rewardConfig, event = getLuckyWeekendEvent(rewardConfig)) {
  const profile = getIntensityProfile(rewardConfig);
  const chest = rewardConfig.chest || rewardDefaults.chest;
  const boostedWeights = getBoostedWeights(chest.rarityWeights, event);
  const rarity = pickWeightedRarity(boostedWeights, `${todayKey}-${entries.length}-${stats.currentStreak}-${profile.key}`);
  const rewardRange = chest.rewards[rarity] || chest.rewards.common;

  const boost = Math.max(0, profile.baseChestBoost || 0);

  const coins =
    pseudoRandomNumber(`${todayKey}-${rarity}-coins`, rewardRange.coins[0], rewardRange.coins[1]) +
    boost * 10 +
    (event.active ? Number(event.chestCoinBonus || 0) : 0);
  const tokens = pseudoRandomNumber(`${todayKey}-${rarity}-tokens`, rewardRange.tokens[0], rewardRange.tokens[1]) + Math.floor(boost / 2);
  const gems = pseudoRandomNumber(`${todayKey}-${rarity}-gems`, rewardRange.gems[0], rewardRange.gems[1]);

  return {
    rarity,
    eventActive: event.active,
    rewards: {
      coins,
      tokens,
      gems,
    },
  };
}

function getDailyChestStatus(entries, stats, rewardConfig, rewardState, dateKey = getToday(), event = getLuckyWeekendEvent(rewardConfig)) {
  const existing = rewardState.claims[dateKey];
  const preview = rollDailyChest(dateKey, entries, stats, rewardConfig, event);
  return {
    date: dateKey,
    claimed: Boolean(existing),
    claim: existing || null,
    preview,
    wallet: rewardState.wallet,
  };
}

function openDailyChest(entries, stats, rewardConfig, rewardState, dateKey = getToday(), event = getLuckyWeekendEvent(rewardConfig)) {
  if (rewardState.claims[dateKey]) {
    return {
      alreadyClaimed: true,
      chest: rewardState.claims[dateKey],
      wallet: rewardState.wallet,
    };
  }

  const rolled = rollDailyChest(dateKey, entries, stats, rewardConfig, event);
  const claim = {
    ...rolled,
    claimedAt: new Date().toISOString(),
  };

  rewardState.claims[dateKey] = claim;
  rewardState.wallet.coins += claim.rewards.coins;
  rewardState.wallet.tokens += claim.rewards.tokens;
  rewardState.wallet.gems += claim.rewards.gems;

  writeRewardsState(rewardState);

  return {
    alreadyClaimed: false,
    chest: claim,
    wallet: rewardState.wallet,
  };
}

function getRaidStatus(entries, rewardConfig = readRewardsConfig(), dateObj = toDate(getToday())) {
  const bosses = readRaidBosses();
  if (!bosses.length) return null;

  const midweekEvent = getMidweekMomentumEvent(rewardConfig, dateObj);

  const weekStart = getWeekStartMonday(dateObj);
  const weekEnd = addDays(weekStart, 6);
  const weekIndex = getWeekIndex(dateObj);
  const boss = bosses[weekIndex % bosses.length];

  const weekEntries = entries.filter((entry) => {
    const d = toDate(entry.solvedAt);
    return d >= weekStart && d <= weekEnd;
  });

  const weakness = new Set((boss.weaknessTags || []).map((tag) => String(tag).toLowerCase()));

  let playerDamage = 0;
  for (const entry of weekEntries) {
    const base = entry.difficulty === 'hard' ? 190 : entry.difficulty === 'medium' ? 110 : 60;
    const weaknessBonus = (entry.tags || []).some((tag) => weakness.has(String(tag).toLowerCase())) ? 30 : 0;
    playerDamage += base + weaknessBonus;
  }

  const dateSet = new Set(entries.map((entry) => entry.solvedAt));
  const streakInfo = calculateProtectedStreak(dateSet, dateObj);
  const comboStep = Math.max(1, Number(midweekEvent.comboStep || 3));
  const comboSteps = Math.floor(Math.max(0, streakInfo.streak) / comboStep);
  const comboBonusDamage = midweekEvent.active ? comboSteps * Number(midweekEvent.comboBonusPerStep || 0) : 0;

  let boostedPlayerDamage = playerDamage;
  if (midweekEvent.active) {
    boostedPlayerDamage = Math.round((playerDamage + comboBonusDamage) * Number(midweekEvent.raidDamageMultiplier || 1));
  }

  const team = ['Nova', 'Cipher', 'Rune'].map((name, idx) => {
    const base = pseudoRandomNumber(`${name}-${toDateKey(weekStart)}-${idx}`, 180, 340);
    const consistencyBuff = Math.min(120, weekEntries.length * 18);
    return {
      name,
      damage: base + consistencyBuff,
    };
  });

  const teamDamage = team.reduce((sum, mate) => sum + mate.damage, 0);
  const boostedTeamDamage = midweekEvent.active
    ? Math.round(teamDamage * Number(midweekEvent.teamDamageMultiplier || 1))
    : teamDamage;
  const totalDamage = boostedPlayerDamage + boostedTeamDamage;
  const hp = Number(boss.weeklyHp || 1500);
  const hpLeft = Math.max(0, hp - totalDamage);
  const cleared = hpLeft === 0;
  const clearPct = Math.round((Math.min(totalDamage, hp) / hp) * 100);

  const rewardTier =
    clearPct >= 100 ? 'Legendary' :
    clearPct >= 80 ? 'Epic' :
    clearPct >= 55 ? 'Rare' :
    'Common';

  return {
    boss,
    weekRange: `${toDateKey(weekStart)} to ${toDateKey(weekEnd)}`,
    hp,
    playerDamage: boostedPlayerDamage,
    basePlayerDamage: playerDamage,
    comboBonusDamage,
    comboSteps,
    streakForCombo: streakInfo.streak,
    midweekEvent,
    team,
    teamDamage: boostedTeamDamage,
    baseTeamDamage: teamDamage,
    totalDamage,
    hpLeft,
    clearPct,
    cleared,
    rewardTier,
  };
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
  const elo = calculateEloProgress(entries);
  const season = getSeasonInfo(entries, today);
  const rewardsConfig = readRewardsConfig();
  const rewardsState = readRewardsState();
  const luckyEvent = getLuckyWeekendEvent(rewardsConfig, today);
  const raid = getRaidStatus(entries, rewardsConfig, today);
  const streakBonus = getStreakMultiplier(currentStreak, rewardsConfig, luckyEvent);
  const boostedXp = Math.round(xp * streakBonus.multiplier);
  const chest = getDailyChestStatus(entries, { currentStreak }, rewardsConfig, rewardsState, getToday(), luckyEvent);

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
    streakBonus,
    boostedXp,
    chest,
    luckyEvent,
    elo,
    season,
    raid,
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

  const leagueSection = `## Seasonal League\n- Season: **${stats.season.seasonId}** (${stats.season.seasonRange})\n- Tier: **${stats.season.tier}**\n- Points: **${stats.season.points}**\n${stats.season.nextTier ? `- Next Tier: **${stats.season.nextTier}** (need ${stats.season.toNext} pts)` : '- Max tier reached this season'}\n- ELO Rating: **${stats.elo.rating}** (${stats.elo.rank})\n${stats.elo.nextRank ? `- Next Rank: **${stats.elo.nextRank}** (need ${stats.elo.toNext})` : '- Top rank reached'}\n\n`;

  const raidSection = stats.raid
    ? `## Weekly Raid Boss (Solo-Simulated Team)\n- Raid: **${stats.raid.boss.name}** [${stats.raid.boss.element}]\n- Week: **${stats.raid.weekRange}**\n- HP: **${stats.raid.hp}** | Damage: **${stats.raid.totalDamage}** | HP Left: **${stats.raid.hpLeft}**\n- Clear: **${stats.raid.clearPct}%** | Reward Tier: **${stats.raid.rewardTier}**\n- You: **${stats.raid.playerDamage} dmg** | Team: **${stats.raid.teamDamage} dmg**\n${stats.raid.midweekEvent && stats.raid.midweekEvent.active ? `- Midweek Momentum: **ACTIVE** (+${stats.raid.comboBonusDamage} combo dmg, streak ${stats.raid.streakForCombo}, team mult x${stats.raid.midweekEvent.teamDamageMultiplier})\n` : ''}- Teammates: ${stats.raid.team.map((mate) => `${mate.name} ${mate.damage}`).join(', ')}\n\n`
    : '';

  const rewardsSection = `## Rewards Engine\n- Intensity: **${stats.streakBonus.intensity}**\n- Win Streak Multiplier: **x${stats.streakBonus.multiplier}** (cap x${stats.streakBonus.cap})\n- Boosted XP (effective): **${stats.boostedXp}**\n- Lucky Weekend Event: **${stats.luckyEvent.active ? `ACTIVE (${stats.luckyEvent.name})` : 'Inactive'}**\n${stats.luckyEvent.active ? `- Event Bonus: +${stats.luckyEvent.chestCoinBonus} chest coins, multiplier cap +${stats.luckyEvent.multiplierCapBonus}, boosted rarity odds\n- Event Tagline: ${stats.luckyEvent.tagline}\n` : ''}- Daily Chest: **${stats.chest.claimed ? 'Claimed' : 'Available'}**\n- Chest ${stats.chest.claimed ? 'Loot' : 'Preview'}: **${(stats.chest.claimed ? stats.chest.claim : stats.chest.preview).rarity}** (+${(stats.chest.claimed ? stats.chest.claim : stats.chest.preview).rewards.coins} coins, +${(stats.chest.claimed ? stats.chest.claim : stats.chest.preview).rewards.tokens} tokens, +${(stats.chest.claimed ? stats.chest.claim : stats.chest.preview).rewards.gems} gems)\n- Wallet: **${stats.chest.wallet.coins} coins / ${stats.chest.wallet.tokens} tokens / ${stats.chest.wallet.gems} gems**\n\n`;

  const markdown = `# LeetCode Progress Dashboard\n\n## Snapshot\n- Total Solved: **${stats.total}**\n- Solved Days: **${stats.solvedDays}**\n- Current Streak: **${stats.currentStreak} day(s)**\n- Longest Streak: **${stats.longestStreak} day(s)**\n- XP: **${stats.xp}**\n- Level: **${stats.level}**\n- Streak Shield: **${stats.freezeMissesUsed}/${stats.freezeMissesAllowed} miss used** (1 miss allowed per 14 days)\n\n## Daily Mission\n- ${mission.title}\n- ${mission.detail}\n- Nudge: ${nudge}\n\n${rewardsSection}${leagueSection}${bossSection}${raidSection}## Consistency Score\n- Last 7 active days: **${stats.weekActiveDays}/7**\n- Consistency score: **${stats.consistencyScore}/100**\n\n## Difficulty Breakdown\n- Easy: **${stats.byDifficulty.easy}**\n- Medium: **${stats.byDifficulty.medium}**\n- Hard: **${stats.byDifficulty.hard}**\n\n## 14-Day Consistency\n${renderWeekBar(entries)}\n\n## Achievements\n${achievements.map((a) => `- ${a}`).join('\n')}\n\n## Recent Solves\n${recentLines}\n\n---\nAuto-generated by \`npm run lc:dashboard\`.\n`;

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
  const solutionsSync = syncSolutionsRepo(entries);
  const stats = renderDashboard(entries);
  const bossStatus = getBossProgress(entries);

  console.log(`✅ Logged #${entry.id} ${entry.title} (${formatDifficulty(entry.difficulty)})`);
  console.log(`📁 Solution file: ${entry.solutionPath}`);
  if (solutionsSync.repoReady) {
    console.log(`🗂️ Mirrored into solutions repo: ${solutionsSync.config.localRepoPath}`);
  }
  console.log(`🔥 Current streak: ${stats.currentStreak} day(s)`);
  console.log(`✨ Win streak multiplier: x${stats.streakBonus.multiplier} [${stats.streakBonus.intensity}]`);
  if (stats.luckyEvent.active) {
    console.log(`🍀 ${stats.luckyEvent.name} ACTIVE: rarity boost + cap +${stats.luckyEvent.multiplierCapBonus}`);
  }
  console.log(`🏁 League: ${stats.season.tier} (${stats.season.points} pts) | ELO ${stats.elo.rating} (${stats.elo.rank})`);
  if (stats.elo.nextRank) {
    console.log(`📈 Next rank ${stats.elo.nextRank} in ${stats.elo.toNext} rating`);
  }
  if (stats.raid) {
    console.log(`🧨 Raid: ${stats.raid.boss.name} ${stats.raid.clearPct}% (${stats.raid.totalDamage}/${stats.raid.hp})`);
    if (stats.raid.midweekEvent && stats.raid.midweekEvent.active) {
      console.log(`⚡ Midweek Momentum ACTIVE: +${stats.raid.comboBonusDamage} combo dmg (streak ${stats.raid.streakForCombo})`);
    }
  }
  console.log(`🎁 Daily chest: ${stats.chest.claimed ? 'already claimed' : 'available now'} (use npm run lc:chest -- --open)`);
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
  console.log(`✨ Win streak multiplier: x${stats.streakBonus.multiplier} [${stats.streakBonus.intensity}]`);
  if (stats.luckyEvent.active) {
    console.log(`🍀 Event active: ${stats.luckyEvent.name}`);
  }
  console.log(`⭐ XP: ${stats.xp} | Level: ${stats.level}`);
  console.log(`💎 Wallet: ${stats.chest.wallet.coins}c/${stats.chest.wallet.tokens}t/${stats.chest.wallet.gems}g`);
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
  console.log(`- Multiplier: x${stats.streakBonus.multiplier} [${stats.streakBonus.intensity}]`);
  if (stats.luckyEvent.active) {
    console.log(`- Event: ${stats.luckyEvent.name} is active`);
  }
  console.log(`- Daily chest: ${stats.chest.claimed ? 'claimed' : 'ready to open'}`);
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

function showLeague(entries) {
  const stats = calculateStats(entries);
  console.log('🏟️ Seasonal League');
  console.log(`- Season: ${stats.season.seasonId}`);
  console.log(`- Range: ${stats.season.seasonRange}`);
  console.log(`- Tier: ${stats.season.tier}`);
  console.log(`- Points: ${stats.season.points}`);
  console.log(`- Solves this season: ${stats.season.solves}`);
  if (stats.season.nextTier) {
    console.log(`- Next Tier: ${stats.season.nextTier} in ${stats.season.toNext} pts`);
  } else {
    console.log('- Season tier maxed');
  }
  console.log(`- ELO: ${stats.elo.rating} (${stats.elo.rank})`);
  if (stats.elo.nextRank) {
    console.log(`- Next ELO Rank: ${stats.elo.nextRank} in ${stats.elo.toNext}`);
  } else {
    console.log('- ELO rank maxed');
  }
}

function showRaid(entries) {
  const stats = calculateStats(entries);
  if (!stats.raid) {
    console.log('Raid mode unavailable. Add progress/raid-bosses.json to enable it.');
    return;
  }

  console.log('🛡️ Weekly Raid Boss (Solo-Simulated Team)');
  console.log(`- Boss: ${stats.raid.boss.name} [${stats.raid.boss.element}]`);
  console.log(`- Week: ${stats.raid.weekRange}`);
  console.log(`- HP: ${stats.raid.hp}`);
  console.log(`- Damage: ${stats.raid.totalDamage} (${stats.raid.clearPct}%)`);
  console.log(`- HP Left: ${stats.raid.hpLeft}`);
  console.log(`- Reward Tier: ${stats.raid.rewardTier}`);
  console.log(`- You: ${stats.raid.playerDamage} dmg`);
  console.log(`- Team: ${stats.raid.teamDamage} dmg`);
  if (stats.raid.midweekEvent && stats.raid.midweekEvent.active) {
    console.log(`- Midweek Momentum: ACTIVE`);
    console.log(`  combo bonus => +${stats.raid.comboBonusDamage} (steps ${stats.raid.comboSteps}, streak ${stats.raid.streakForCombo})`);
  }
  console.log(`- Allies: ${stats.raid.team.map((mate) => `${mate.name}:${mate.damage}`).join(', ')}`);
}

function showChest(entries, args) {
  const stats = calculateStats(entries);
  const rewardsConfig = readRewardsConfig();
  const rewardsState = readRewardsState();
  const luckyEvent = getLuckyWeekendEvent(rewardsConfig);
  const open = Boolean(args.open);

  if (open) {
    const result = openDailyChest(entries, stats, rewardsConfig, rewardsState, getToday(), luckyEvent);
    if (result.alreadyClaimed) {
      console.log('🎁 Daily chest already claimed today.');
    } else {
      console.log('🎁 Daily chest opened!');
    }
    if (luckyEvent.active) {
      console.log(`🍀 ${luckyEvent.name} applied`);
    }
    console.log(`- Rarity: ${result.chest.rarity}`);
    console.log(`- Loot: +${result.chest.rewards.coins} coins, +${result.chest.rewards.tokens} tokens, +${result.chest.rewards.gems} gems`);
    console.log(`- Wallet: ${result.wallet.coins} coins / ${result.wallet.tokens} tokens / ${result.wallet.gems} gems`);
    return;
  }

  const chest = getDailyChestStatus(entries, stats, rewardsConfig, rewardsState, getToday(), luckyEvent);
  const loot = chest.claimed ? chest.claim : chest.preview;
  console.log('🎁 Daily Loot Chest');
  console.log(`- Lucky Weekend: ${luckyEvent.active ? `ACTIVE (${luckyEvent.name})` : 'inactive'}`);
  console.log(`- Status: ${chest.claimed ? 'Claimed' : 'Ready to open'}`);
  console.log(`- ${chest.claimed ? 'Loot' : 'Preview'}: ${loot.rarity} (+${loot.rewards.coins} coins, +${loot.rewards.tokens} tokens, +${loot.rewards.gems} gems)`);
  console.log(`- Intensity: ${stats.streakBonus.intensity}`);
  console.log(`- Multiplier: x${stats.streakBonus.multiplier} (cap x${stats.streakBonus.cap})`);
  console.log(`- Wallet: ${chest.wallet.coins} coins / ${chest.wallet.tokens} tokens / ${chest.wallet.gems} gems`);
  console.log('- Open with: npm run lc:chest -- --open');
}

function showEvents() {
  const rewardsConfig = readRewardsConfig();
  const today = toDate(getToday());

  const weekend = rewardsConfig.weekendEvent || rewardDefaults.weekendEvent;
  const weekendSchedule = getEventSchedule(weekend, [0, 6], today);

  const midweek = rewardsConfig.midweekEvent || rewardDefaults.midweekEvent;
  const midweekSchedule = getEventSchedule(midweek, [2, 3, 4], today);

  console.log('📅 Event Status');
  console.log(`- ${weekend.name || 'Lucky Streak Weekend'}: ${weekendSchedule.active ? 'ACTIVE' : 'inactive'} | next activation: ${weekendSchedule.nextDayLabel}`);
  console.log(`- ${midweek.name || 'Midweek Momentum'}: ${midweekSchedule.active ? 'ACTIVE' : 'inactive'} | next activation: ${midweekSchedule.nextDayLabel}`);
}

async function syncFromLeetCode(args) {
  const username = String(args.username || args.user || '').trim();
  const limit = Number(args.limit || 20);
  const bootstrapMode = Boolean(args.bootstrap || args.aggregate || args.fallback);

  if (!username) {
    throw new Error('Missing --username. Example: npm run lc:sync -- --username your_leetcode_name --limit 20');
  }

  const entries = readEntries();
  const result = await syncLeetCodeEntries({
    username,
    limit,
    existingEntries: entries,
    bootstrapMode,
  });

  if (!result.imported.length) {
    console.log(`ℹ️ No new accepted submissions to import for @${result.username}.`);
    console.log(`Checked ${result.fetchedAccepted} recent accepted submissions.`);
    if (result.visibilityLimited) {
      console.log(`⚠️ Profile visibility note: accepted solves exist (local=${result.localAccepted}, global=${result.globalAccepted}) but recent submissions are not exposed publicly.`);
      console.log('   LeetCode may hide recent submission history on public profiles, so per-problem auto-import is unavailable without visible recent submissions.');
      if (!bootstrapMode) {
        console.log('   Tip: rerun with --bootstrap to import aggregate Easy/Medium/Hard counts as historical bootstrap entries.');
      }
    }
    return;
  }

  entries.push(...result.imported);
  writeEntries(entries);
  const stats = renderDashboard(entries);

  console.log(`✅ Imported ${result.imported.length} new solve(s) from @${result.username}.`);
  console.log(`📥 Checked ${result.fetchedAccepted} recent accepted submission(s).`);
  if (result.bootstrapImportedCount > 0) {
    console.log(`🧱 Bootstrap imported: ${result.bootstrapImportedCount} aggregate entry(ies) (difficulty counts only).`);
  }
  console.log(`📊 Total solved now: ${stats.total} | Current streak: ${stats.currentStreak}`);
}

async function main() {
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

    if (command === 'league') {
      showLeague(entries);
      return;
    }

    if (command === 'raid') {
      showRaid(entries);
      return;
    }

    if (command === 'chest') {
      showChest(entries, args);
      return;
    }

    if (command === 'events') {
      showEvents();
      return;
    }

    if (command === 'sync') {
      await syncFromLeetCode(args);
      return;
    }

    console.log('Usage:');
    console.log('  npm run lc:add -- --id 1 --title "Two Sum" --difficulty easy --lang js --tags array,hash --time 15');
    console.log('  npm run lc:today');
    console.log('  npm run lc:dashboard');
    console.log('  npm run lc:mission');
    console.log('  npm run lc:boss');
    console.log('  npm run lc:league');
    console.log('  npm run lc:raid');
    console.log('  npm run lc:chest -- --open');
    console.log('  npm run lc:events');
    console.log('  npm run lc:sync -- --username your_leetcode_name --limit 20 [--bootstrap]');
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

main();
