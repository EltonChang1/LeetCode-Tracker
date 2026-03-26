const points = { easy: 10, medium: 20, hard: 40 };
const FREEZE_WINDOW_DAYS = 14;
const ELO_BASE = 1000;

const ELO_TARGET_BY_DIFFICULTY = { easy: 900, medium: 1150, hard: 1400 };
const ELO_K_BY_DIFFICULTY = { easy: 16, medium: 24, hard: 32 };
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

const fallbackLeagueConfig = {
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

const fallbackRaidBosses = [
  {
    id: 'kraken-of-complexity',
    name: 'Kraken of Complexity',
    element: 'Algorithmic Depth',
    weeklyHp: 1600,
    weaknessTags: ['graph', 'dp', 'tree'],
    loot: 'Complexity Core',
  },
];

const fallbackRewardsConfig = {
  intensity: 'balanced',
  intensities: {
    casual: { multiplierStep: 0.05, maxMultiplier: 1.6, streakPerStep: 3, baseChestBoost: 0 },
    balanced: { multiplierStep: 0.1, maxMultiplier: 2.2, streakPerStep: 3, baseChestBoost: 1 },
    hardcore: { multiplierStep: 0.15, maxMultiplier: 3, streakPerStep: 2, baseChestBoost: 2 },
  },
  chest: {
    rarityWeights: { common: 58, rare: 28, epic: 11, legendary: 3 },
    rewards: {
      common: { coins: [40, 80], tokens: [0, 1], gems: [0, 0] },
      rare: { coins: [90, 170], tokens: [1, 3], gems: [0, 1] },
      epic: { coins: [180, 320], tokens: [2, 5], gems: [2, 5] },
      legendary: { coins: [350, 550], tokens: [5, 10], gems: [6, 12] },
    },
  },
  weekendEvent: {
    enabled: true,
    days: [0, 6],
    name: 'Lucky Streak Weekend',
    multiplierCapBonus: 0.6,
    chestWeightBonus: { common: -12, rare: 6, epic: 4, legendary: 2 },
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

const fallbackRewardsState = {
  wallet: {
    coins: 0,
    tokens: 0,
    gems: 0,
  },
  claims: {},
};

const fallbackBosses = [
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

const INTERACTIVE_STORAGE_KEY = 'lcq-interactive-v1';
const SYNC_MODE_STORAGE_KEY = 'lcq-write-sync-mode';
const LEETCODE_USERNAME_STORAGE_KEY = 'lcq-leetcode-username';
const DEFAULT_TAG_POOL = ['array', 'hash-table', 'dp', 'graph', 'tree', 'sliding-window', 'two-pointers'];
const TITLE_POOL = {
  easy: ['Potion Sort', 'Warmup Path', 'Quick Pair'],
  medium: ['Combo Engine', 'Mid-Boss Route', 'Signal Optimizer'],
  hard: ['Void Traversal', 'Legend Cutover', 'Raid Prime Solver'],
};

const deepClone = (v) => JSON.parse(JSON.stringify(v));

function defaultInteractiveState() {
  return {
    extraEntries: [],
    rewardsStateOverride: null,
    chestRerolls: {},
    activityLog: [],
    missionStarted: false,
  };
}

function loadInteractiveState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INTERACTIVE_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') {
      return defaultInteractiveState();
    }
    return {
      ...defaultInteractiveState(),
      ...parsed,
      extraEntries: Array.isArray(parsed.extraEntries) ? parsed.extraEntries : [],
      chestRerolls: parsed.chestRerolls && typeof parsed.chestRerolls === 'object' ? parsed.chestRerolls : {},
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
    };
  } catch {
    return defaultInteractiveState();
  }
}

function saveInteractiveState(state) {
  localStorage.setItem(INTERACTIVE_STORAGE_KEY, JSON.stringify(state));
}

function loadSyncMode() {
  return localStorage.getItem(SYNC_MODE_STORAGE_KEY) === '1';
}

function saveSyncMode(enabled) {
  localStorage.setItem(SYNC_MODE_STORAGE_KEY, enabled ? '1' : '0');
}

function loadLeetCodeUsername() {
  return localStorage.getItem(LEETCODE_USERNAME_STORAGE_KEY) || '';
}

function saveLeetCodeUsername(username) {
  localStorage.setItem(LEETCODE_USERNAME_STORAGE_KEY, String(username || '').trim());
}

async function apiRequest(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || 'API request failed');
  }
  return json;
}

function addActivity(state, text) {
  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.activityLog.unshift(`[${stamp}] ${text}`);
  state.activityLog = state.activityLog.slice(0, 24);
}

function pickOne(arr, seed) {
  if (!arr.length) return '';
  return arr[pseudoRandomNumber(seed, 0, arr.length - 1)];
}

function makeSimEntry(difficulty, date = todayKey(), tags = []) {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const chosenTags = tags.length
    ? tags
    : [pickOne(DEFAULT_TAG_POOL, `${nonce}-t1`), pickOne(DEFAULT_TAG_POOL, `${nonce}-t2`)].filter(Boolean);
  return {
    id: `SIM-${nonce}`,
    title: pickOne(TITLE_POOL[difficulty] || TITLE_POOL.easy, `${nonce}-${difficulty}`),
    difficulty,
    language: 'js',
    solvedAt: date,
    timeMinutes: difficulty === 'hard' ? 45 : difficulty === 'medium' ? 25 : 12,
    tags: [...new Set(chosenTags)],
    url: '',
    notes: 'Interactive web simulation entry',
    createdAt: new Date().toISOString(),
  };
}

const toDate = (s) => new Date(`${s}T00:00:00`);
const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const missesAllowedForSpan = (spanDays) => Math.ceil(spanDays / FREEZE_WINDOW_DAYS);

const getWeekStartMonday = (d) => {
  const result = new Date(d);
  const day = result.getDay();
  const distance = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - distance);
  return new Date(`${key(result)}T00:00:00`);
};

const getWeekIndex = (d) => {
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
};

function todayKey() {
  const d = new Date();
  return key(d);
}

function calculateProtectedStreak(dateSet, endDate) {
  let span = 0;
  let misses = 0;
  let solved = 0;
  let cursor = new Date(endDate);

  while (span < 5000) {
    span += 1;
    const date = key(cursor);

    if (dateSet.has(date)) solved += 1;
    else misses += 1;

    if (misses > missesAllowedForSpan(span)) {
      span -= 1;
      break;
    }

    cursor = addDays(cursor, -1);
  }

  if (solved === 0) return { streak: 0, missesUsed: 0, missesAllowed: 1 };
  return { streak: span, missesUsed: misses, missesAllowed: missesAllowedForSpan(span) };
}

function getAchievements(stats) {
  const badges = [];
  if (stats.total >= 1) badges.push('🥚 First Blood');
  if (stats.currentStreak >= 3) badges.push('🔥 3-Day Combo');
  if (stats.longestStreak >= 7) badges.push('🏅 Week Warrior');
  if (stats.hard >= 10) badges.push('🧠 Hard Hunter');
  if (stats.total >= 50) badges.push('💪 Grind Master');
  if (stats.total >= 100) badges.push('👑 Century Club');
  return badges.length ? badges : ['🌱 Starter Seed'];
}

function calcStats(entries) {
  const dates = new Set(entries.map((e) => e.solvedAt));
  const sorted = [...dates].sort();
  const today = toDate(todayKey());

  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  let xp = 0;

  for (const e of entries) {
    if (byDifficulty[e.difficulty] !== undefined) byDifficulty[e.difficulty] += 1;
    xp += points[e.difficulty] || 0;
  }

  const currentProtected = calculateProtectedStreak(dates, today);

  let longest = 0;
  if (sorted.length) {
    let cursor = toDate(sorted[0]);
    while (cursor <= today) {
      longest = Math.max(longest, calculateProtectedStreak(dates, cursor).streak);
      cursor = addDays(cursor, 1);
    }
  }

  const byDate = entries.reduce((acc, e) => {
    acc[e.solvedAt] = (acc[e.solvedAt] || 0) + 1;
    return acc;
  }, {});

  const tk = todayKey();
  const weekStart = addDays(toDate(tk), -6);
  let weekActiveDays = 0;
  for (let i = 0; i < 7; i += 1) {
    if (byDate[key(addDays(weekStart, i))]) weekActiveDays += 1;
  }

  return {
    total: entries.length,
    solvedDays: sorted.length,
    currentStreak: currentProtected.streak,
    longestStreak: longest,
    freezeMissesUsed: currentProtected.missesUsed,
    freezeMissesAllowed: currentProtected.missesAllowed,
    xp,
    level: Math.floor(xp / 100) + 1,
    consistencyScore: Math.round((weekActiveDays / 7) * 100),
    weekActiveDays,
    todayCount: byDate[tk] || 0,
    byDifficulty,
    recent: [...entries].sort((a, b) => b.solvedAt.localeCompare(a.solvedAt)).slice(0, 8),
    dates,
  };
}

async function loadData() {
  const [entriesRes, profileRes, bossesRes, leagueRes, raidRes, rewardsRes, rewardsStateRes] = await Promise.all([
    fetch(`/progress/entries.json?ts=${Date.now()}`),
    fetch(`/progress/profile.json?ts=${Date.now()}`),
    fetch(`/progress/bosses.json?ts=${Date.now()}`),
    fetch(`/progress/leagues.json?ts=${Date.now()}`),
    fetch(`/progress/raid-bosses.json?ts=${Date.now()}`),
    fetch(`/progress/rewards.json?ts=${Date.now()}`),
    fetch(`/progress/rewards-state.json?ts=${Date.now()}`),
  ]);

  const entries = entriesRes.ok ? await entriesRes.json() : [];
  const profile = profileRes.ok ? await profileRes.json() : { dailyMinimum: 1, targetMinutes: 20, preferredWarmupDifficulty: 'easy' };
  const bosses = bossesRes.ok ? await bossesRes.json() : fallbackBosses;
  const league = leagueRes.ok ? await leagueRes.json() : fallbackLeagueConfig;
  const raidBosses = raidRes.ok ? await raidRes.json() : fallbackRaidBosses;
  const rewardsConfig = rewardsRes.ok ? await rewardsRes.json() : fallbackRewardsConfig;
  const rewardsState = rewardsStateRes.ok ? await rewardsStateRes.json() : fallbackRewardsState;
  return {
    entries: Array.isArray(entries) ? entries : [],
    profile,
    bosses: Array.isArray(bosses) && bosses.length ? bosses : fallbackBosses,
    league: league && typeof league === 'object' ? league : fallbackLeagueConfig,
    raidBosses: Array.isArray(raidBosses) && raidBosses.length ? raidBosses : fallbackRaidBosses,
    rewardsConfig: rewardsConfig && typeof rewardsConfig === 'object' ? rewardsConfig : fallbackRewardsConfig,
    rewardsState: rewardsState && typeof rewardsState === 'object' ? rewardsState : fallbackRewardsState,
  };
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

function eloProgress(entries) {
  const sorted = [...entries].sort((a, b) => {
    if (a.solvedAt !== b.solvedAt) return a.solvedAt.localeCompare(b.solvedAt);
    return String(a.id).localeCompare(String(b.id));
  });

  let rating = ELO_BASE;
  for (const entry of sorted) {
    const target = ELO_TARGET_BY_DIFFICULTY[entry.difficulty] || ELO_BASE;
    const k = ELO_K_BY_DIFFICULTY[entry.difficulty] || 16;
    const expected = 1 / (1 + 10 ** ((target - rating) / 400));
    rating += k * (1 - expected);
  }

  rating = Math.max(300, Math.round(rating));
  const rank = ratingToRank(rating);
  return {
    rating,
    rank: rank.current.name,
    nextRank: rank.next ? rank.next.name : null,
    toNext: rank.next ? Math.max(0, rank.next.minRating - rating) : 0,
  };
}

function seasonStatus(entries, league) {
  const today = toDate(todayKey());
  const anchor = toDate(league.seasonAnchorDate || fallbackLeagueConfig.seasonAnchorDate);
  const seasonLengthDays = Math.max(1, Number(league.seasonLengthDays || 90));
  const days = Math.floor((today - anchor) / 86400000);
  const seasonIndex = days >= 0 ? Math.floor(days / seasonLengthDays) : 0;
  const start = addDays(anchor, seasonIndex * seasonLengthDays);
  const end = addDays(start, seasonLengthDays - 1);

  const inSeason = entries.filter((entry) => {
    const d = toDate(entry.solvedAt);
    return d >= start && d <= end;
  });

  const points = inSeason.reduce((sum, entry) => {
    const base = { easy: 10, medium: 25, hard: 55 }[entry.difficulty] || 0;
    return sum + base;
  }, 0);

  const tiers = [...(league.tiers || fallbackLeagueConfig.tiers)].sort((a, b) => a.minPoints - b.minPoints);
  let tier = tiers[0];
  let next = null;
  for (let i = 0; i < tiers.length; i += 1) {
    if (points >= tiers[i].minPoints) {
      tier = tiers[i];
      next = tiers[i + 1] || null;
    }
  }

  return {
    seasonId: `S${seasonIndex + 1}`,
    range: `${key(start)} to ${key(end)}`,
    points,
    tier: tier ? tier.name : 'Bronze',
    nextTier: next ? next.name : null,
    toNext: next ? Math.max(0, next.minPoints - points) : 0,
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

function getIntensityProfile(rewardsConfig) {
  const keyName = rewardsConfig.intensity || 'balanced';
  const selected = (rewardsConfig.intensities && rewardsConfig.intensities[keyName]) || rewardsConfig.intensities.balanced;
  return {
    key: keyName,
    ...selected,
  };
}

function getStreakMultiplier(currentStreak, rewardsConfig) {
  const profile = getIntensityProfile(rewardsConfig);
  const steps = Math.floor(Math.max(0, currentStreak) / Math.max(1, profile.streakPerStep || 3));
  const raw = 1 + steps * (profile.multiplierStep || 0.1);
  const event = luckyWeekendEvent(rewardsConfig);
  const cap = (profile.maxMultiplier || 2) + (event.active ? Number(event.multiplierCapBonus || 0) : 0);
  return {
    intensity: profile.key,
    cap: Number(cap.toFixed(2)),
    multiplier: Number(Math.min(cap, raw).toFixed(2)),
  };
}

function luckyWeekendEvent(rewardsConfig) {
  const event = rewardsConfig.weekendEvent || fallbackRewardsConfig.weekendEvent;
  const days = Array.isArray(event.days) && event.days.length ? event.days : [0, 6];
  const active = Boolean(event.enabled) && days.includes(new Date().getDay());
  return {
    ...event,
    active,
  };
}

function midweekMomentumEvent(rewardsConfig) {
  const event = rewardsConfig.midweekEvent || fallbackRewardsConfig.midweekEvent;
  const days = Array.isArray(event.days) && event.days.length ? event.days : [2, 3, 4];
  const active = Boolean(event.enabled) && days.includes(new Date().getDay());
  return {
    ...event,
    active,
  };
}

function boostedWeights(weights, event) {
  const source = { ...weights };
  if (!event.active) return source;
  const bonus = event.chestWeightBonus || {};
  const result = {};
  for (const keyName of Object.keys(source)) {
    result[keyName] = Math.max(1, Number(source[keyName]) + Number(bonus[keyName] || 0));
  }
  return result;
}

function pickWeightedRarity(weights, seedText) {
  const pairs = Object.entries(weights || {}).filter(([, value]) => Number(value) > 0);
  if (!pairs.length) return 'common';
  const total = pairs.reduce((sum, [, value]) => sum + Number(value), 0);
  const roll = pseudoRandomNumber(`${seedText}-rarity`, 1, total);
  let cursor = 0;
  for (const [name, value] of pairs) {
    cursor += Number(value);
    if (roll <= cursor) return name;
  }
  return pairs[pairs.length - 1][0];
}

function chestPreview(entries, currentStreak, rewardsConfig) {
  const today = todayKey();
  const profile = getIntensityProfile(rewardsConfig);
  const event = luckyWeekendEvent(rewardsConfig);
  const chest = rewardsConfig.chest || fallbackRewardsConfig.chest;
  const rarity = pickWeightedRarity(boostedWeights(chest.rarityWeights, event), `${today}-${entries.length}-${currentStreak}-${profile.key}`);
  const rewardRange = chest.rewards[rarity] || chest.rewards.common;
  const boost = Math.max(0, profile.baseChestBoost || 0);
  return {
    rarity,
    eventActive: event.active,
    rewards: {
      coins: pseudoRandomNumber(`${today}-${rarity}-coins`, rewardRange.coins[0], rewardRange.coins[1]) + boost * 10 + (event.active ? Number(event.chestCoinBonus || 0) : 0),
      tokens: pseudoRandomNumber(`${today}-${rarity}-tokens`, rewardRange.tokens[0], rewardRange.tokens[1]) + Math.floor(boost / 2),
      gems: pseudoRandomNumber(`${today}-${rarity}-gems`, rewardRange.gems[0], rewardRange.gems[1]),
    },
  };
}

function chestStatus(entries, currentStreak, rewardsConfig, rewardsState, previewOverride = null) {
  const claim = (rewardsState.claims && rewardsState.claims[todayKey()]) || null;
  return {
    claimed: Boolean(claim),
    claim,
    preview: previewOverride || chestPreview(entries, currentStreak, rewardsConfig),
    wallet: (rewardsState.wallet || fallbackRewardsState.wallet),
  };
}

function raidStatus(entries, raidBosses, rewardsConfig) {
  const today = toDate(todayKey());
  const weekStart = getWeekStartMonday(today);
  const weekEnd = addDays(weekStart, 6);
  const weekIndex = getWeekIndex(today);
  const boss = raidBosses[weekIndex % raidBosses.length];
  if (!boss) return null;

  const midweek = midweekMomentumEvent(rewardsConfig);

  const weakness = new Set((boss.weaknessTags || []).map((tag) => String(tag).toLowerCase()));
  const weekEntries = entries.filter((entry) => {
    const d = toDate(entry.solvedAt);
    return d >= weekStart && d <= weekEnd;
  });

  let playerDamage = 0;
  for (const entry of weekEntries) {
    const base = entry.difficulty === 'hard' ? 190 : entry.difficulty === 'medium' ? 110 : 60;
    const weaknessBonus = (entry.tags || []).some((tag) => weakness.has(String(tag).toLowerCase())) ? 30 : 0;
    playerDamage += base + weaknessBonus;
  }

  const dates = new Set(entries.map((entry) => entry.solvedAt));
  const streakInfo = calculateProtectedStreak(dates, today);
  const comboStep = Math.max(1, Number(midweek.comboStep || 3));
  const comboSteps = Math.floor(Math.max(0, streakInfo.streak) / comboStep);
  const comboBonusDamage = midweek.active ? comboSteps * Number(midweek.comboBonusPerStep || 0) : 0;
  const boostedPlayerDamage = midweek.active
    ? Math.round((playerDamage + comboBonusDamage) * Number(midweek.raidDamageMultiplier || 1))
    : playerDamage;

  const allies = ['Nova', 'Cipher', 'Rune'].map((name, idx) => ({
    name,
    damage: pseudoRandomNumber(`${name}-${key(weekStart)}-${idx}`, 180, 340) + Math.min(120, weekEntries.length * 18),
  }));

  const teamDamage = allies.reduce((sum, ally) => sum + ally.damage, 0);
  const hp = Number(boss.weeklyHp || 1500);
  const boostedTeamDamage = midweek.active
    ? Math.round(teamDamage * Number(midweek.teamDamageMultiplier || 1))
    : teamDamage;
  const totalDamage = boostedPlayerDamage + boostedTeamDamage;
  const hpLeft = Math.max(0, hp - totalDamage);
  const clearPct = Math.round((Math.min(totalDamage, hp) / hp) * 100);
  const rewardTier = clearPct >= 100 ? 'Legendary' : clearPct >= 80 ? 'Epic' : clearPct >= 55 ? 'Rare' : 'Common';

  return {
    boss,
    weekRange: `${key(weekStart)} to ${key(weekEnd)}`,
    hp,
    totalDamage,
    playerDamage: boostedPlayerDamage,
    basePlayerDamage: playerDamage,
    comboBonusDamage,
    comboSteps,
    streakForCombo: streakInfo.streak,
    teamDamage: boostedTeamDamage,
    baseTeamDamage: teamDamage,
    hpLeft,
    clearPct,
    rewardTier,
    allies,
    midweek,
  };
}

function checkReq(progress, req = {}) {
  const needed = {
    solves: req.solves || 0,
    mediumPlus: req.mediumPlus || 0,
    hard: req.hard || 0,
    tagHits: req.tagHits || 0,
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

function bossStatus(entries, bosses) {
  const today = toDate(todayKey());
  const weekIndex = getWeekIndex(today);
  const boss = bosses[weekIndex % bosses.length];

  if (!boss) return null;

  const weekStart = getWeekStartMonday(today);
  const weekEnd = addDays(weekStart, 6);
  const tags = new Set((boss.requiredTags || []).map((t) => String(t).toLowerCase()));

  const weekEntries = entries.filter((entry) => {
    const d = toDate(entry.solvedAt);
    return d >= weekStart && d <= weekEnd;
  });

  const progress = {
    solves: weekEntries.length,
    mediumPlus: weekEntries.filter((e) => e.difficulty === 'medium' || e.difficulty === 'hard').length,
    hard: weekEntries.filter((e) => e.difficulty === 'hard').length,
    tagHits: weekEntries.filter((e) => (e.tags || []).some((tag) => tags.has(String(tag).toLowerCase()))).length,
  };

  let achievedTier = null;
  let nextTier = null;

  for (const tier of boss.tiers || []) {
    const result = checkReq(progress, tier.requirements || {});
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
    progress,
    achievedTier,
    nextTier,
    weekRange: `${key(weekStart)} to ${key(weekEnd)}`,
  };
}

function missionText(stats, profile) {
  if (stats.todayCount >= (profile.dailyMinimum || 1)) {
    return 'Daily mission complete. Bonus quest: 1 medium or review one old mistake.';
  }
  return `Solve ${profile.dailyMinimum || 1} ${profile.preferredWarmupDifficulty || 'easy'} in ≤ ${profile.targetMinutes || 20} min.`;
}

function nudge(stats) {
  if (stats.todayCount > 0) return 'Momentum unlocked. Protect it with a clean daily commit.';
  return 'Tiny start wins: open one problem and code for 2 minutes.';
}

function render(stats, profile, entries, bosses, leagueConfig, raidBosses, rewardsConfig, rewardsState, interactive) {
  document.getElementById('todayLine').textContent = `Today: ${todayKey()} · ${stats.todayCount} solve(s)`;
  document.getElementById('currentStreak').textContent = `${stats.currentStreak}d`;
  document.getElementById('longestStreak').textContent = `${stats.longestStreak}d`;
  document.getElementById('xpLevel').textContent = `${stats.xp} XP · Lv ${stats.level}`;
  document.getElementById('consistency').textContent = `${stats.consistencyScore}/100`;
  document.getElementById('shieldText').textContent = `${stats.freezeMissesUsed}/${stats.freezeMissesAllowed} used`;
  document.getElementById('missionText').textContent = missionText(stats, profile);
  document.getElementById('nudgeText').textContent = nudge(stats);
  const missionHref = `/web/dsa.html?start=today&difficulty=${encodeURIComponent(profile.preferredWarmupDifficulty || 'easy')}`;
  const startPracticeLink = document.getElementById('startPracticeLink');
  const missionStartLink = document.getElementById('missionStartBtn');
  if (startPracticeLink) startPracticeLink.href = missionHref;
  if (missionStartLink) missionStartLink.href = missionHref;
  const practiceBridgeLine = document.getElementById('practiceBridgeLine');
  if (practiceBridgeLine) {
    practiceBridgeLine.textContent = stats.todayCount > 0
      ? 'Jump back into the guided DSA board to finish review or push one more focused solve.'
      : 'Start the mission in the DSA board and we will queue the best first problem for you.';
  }

  const achievements = document.getElementById('achievements');
  achievements.innerHTML = '';
  for (const a of getAchievements({
    total: stats.total,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    hard: stats.byDifficulty.hard,
  })) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = a;
    achievements.appendChild(span);
  }

  const heatbar = document.getElementById('heatbar');
  heatbar.innerHTML = '';
  const start = addDays(toDate(todayKey()), -13);
  for (let i = 0; i < 14; i += 1) {
    const d = addDays(start, i);
    const k = key(d);
    const item = document.createElement('div');
    item.className = `day ${stats.dates.has(k) ? 'active' : ''}`;
    item.textContent = `${stats.dates.has(k) ? '✅' : '⬜'} ${k.slice(5)}`;
    heatbar.appendChild(item);
  }

  const recent = document.getElementById('recentList');
  recent.innerHTML = '';
  if (!stats.recent.length) {
    const li = document.createElement('li');
    li.textContent = 'No solves logged yet. Start your first quest now.';
    recent.appendChild(li);
  } else {
    for (const r of stats.recent) {
      const li = document.createElement('li');
      li.textContent = `${r.solvedAt} · #${r.id} ${r.title} (${r.difficulty}) [${r.language}]`;
      recent.appendChild(li);
    }
  }

  const status = bossStatus(entries, bosses);
  if (status) {
    document.getElementById('bossName').textContent = `${status.boss.name} · ${status.achievedTier ? status.achievedTier.name : 'Unranked'}`;
    document.getElementById('bossTheme').textContent = `${status.boss.theme} (${status.weekRange})`;
    document.getElementById('bossProgress').textContent = `solves=${status.progress.solves}, medium+=${status.progress.mediumPlus}, hard=${status.progress.hard}, themeHits=${status.progress.tagHits}`;

    const tiers = document.getElementById('bossTiers');
    tiers.innerHTML = '';
    for (const tier of status.boss.tiers || []) {
      const chip = document.createElement('span');
      const isReached = status.achievedTier && status.boss.tiers.findIndex((t) => t.name === status.achievedTier.name) >= status.boss.tiers.findIndex((t) => t.name === tier.name);
      const isNext = status.nextTier && status.nextTier.name === tier.name;
      chip.className = `chip ${isReached ? 'tier-on' : ''} ${isNext ? 'tier-next' : ''}`.trim();
      chip.textContent = tier.name;
      tiers.appendChild(chip);
    }

    const nextHint = document.getElementById('nextTierHint');
    if (status.nextTier) {
      nextHint.textContent = `Next ${status.nextTier.name}: solves +${status.nextTier.remaining.solves}, medium+ +${status.nextTier.remaining.mediumPlus}, hard +${status.nextTier.remaining.hard}, themeHits +${status.nextTier.remaining.tagHits}`;
    } else {
      nextHint.textContent = 'Diamond tier cleared. Weekly boss defeated.';
    }
  }

  const league = seasonStatus(entries, leagueConfig);
  const elo = eloProgress(entries);
  document.getElementById('leagueTier').textContent = `${league.tier} · ${league.seasonId}`;
  document.getElementById('leaguePoints').textContent = `Points ${league.points}${league.nextTier ? ` · Next ${league.nextTier} in ${league.toNext}` : ' · Max tier'}`;
  document.getElementById('eloLine').textContent = `ELO ${elo.rating} (${elo.rank})${elo.nextRank ? ` · Next ${elo.nextRank} in ${elo.toNext}` : ''}`;

  const raid = raidStatus(entries, raidBosses, rewardsConfig);
  if (raid) {
    document.getElementById('raidBoss').textContent = `${raid.boss.name} · ${raid.clearPct}% · ${raid.rewardTier}${raid.midweek && raid.midweek.active ? ' · ⚡ Midweek' : ''}`;
    document.getElementById('raidDamage').textContent = `Damage ${raid.totalDamage}/${raid.hp} · You ${raid.playerDamage} · Team ${raid.teamDamage}${raid.midweek && raid.midweek.active ? ` · Combo +${raid.comboBonusDamage}` : ''}`;
    document.getElementById('raidAllies').textContent = `Allies: ${raid.allies.map((ally) => `${ally.name}:${ally.damage}`).join(', ')}`;
  }

  const multiplier = getStreakMultiplier(stats.currentStreak, rewardsConfig);
  const chest = chestStatus(entries, stats.currentStreak, rewardsConfig, rewardsState, interactive.chestRerolls[todayKey()] || null);
  const chestLoot = chest.claimed ? chest.claim : chest.preview;
  const event = luckyWeekendEvent(rewardsConfig);

  document.getElementById('multiplierLine').textContent = `x${multiplier.multiplier} [${multiplier.intensity}]${event.active ? ` · 🍀 ${event.name}` : ''}`;
  document.getElementById('boostedXpLine').textContent = `Boosted XP: ${Math.round(stats.xp * multiplier.multiplier)} (base ${stats.xp})`;
  document.getElementById('chestLine').textContent = `${chest.claimed ? 'Claimed' : 'Ready'} · ${chestLoot.rarity} · +${chestLoot.rewards.coins}c +${chestLoot.rewards.tokens}t +${chestLoot.rewards.gems}g${event.active ? ' · weekend boosted' : ''}`;
  document.getElementById('walletLine').textContent = `Wallet: ${chest.wallet.coins} coins · ${chest.wallet.tokens} tokens · ${chest.wallet.gems} gems`;

  const activityLog = document.getElementById('activityLog');
  if (activityLog) {
    activityLog.innerHTML = '';
    const logs = interactive.activityLog.length
      ? interactive.activityLog
      : ['No actions yet. Tap any gameplay button to interact.'];
    for (const line of logs) {
      const li = document.createElement('li');
      li.textContent = line;
      activityLog.appendChild(li);
    }
  }
}

let baseData = null;
let interactive = loadInteractiveState();
let writeSyncEnabled = loadSyncMode();
let serverAllowWrites = false;

function flashButton(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('pulse');
  setTimeout(() => el.classList.remove('pulse'), 500);
}

function getEffectiveRewardsState() {
  if (!interactive.rewardsStateOverride) {
    interactive.rewardsStateOverride = deepClone(baseData.rewardsState || fallbackRewardsState);
  }
  return interactive.rewardsStateOverride;
}

function getEffectiveEntries() {
  return [...baseData.entries, ...interactive.extraEntries];
}

function updateSyncUi() {
  const toggle = document.getElementById('syncWriteToggle');
  const line = document.getElementById('syncModeLine');
  const syncBtn = document.getElementById('leetcodeSyncBtn');
  if (!toggle || !line) return;

  toggle.disabled = !serverAllowWrites;
  toggle.checked = writeSyncEnabled && serverAllowWrites;
  if (syncBtn) syncBtn.disabled = !serverAllowWrites;

  if (!serverAllowWrites) {
    line.textContent = 'Write API disabled on server. Start web server with LCQ_ALLOW_WRITE=1 to enable sync mode.';
    return;
  }

  line.textContent = toggle.checked
    ? 'Sync mode ON: actions write to progress/entries.json and progress/rewards-state.json.'
    : 'Sync mode OFF: actions stay in browser simulation only.';
}

function getBossPreferredTags() {
  const status = bossStatus(getEffectiveEntries(), baseData.bosses);
  return status?.boss?.requiredTags?.slice(0, 2) || [];
}

function getRaidPreferredTags() {
  const raid = raidStatus(getEffectiveEntries(), baseData.raidBosses, baseData.rewardsConfig);
  return raid?.boss?.weaknessTags?.slice(0, 2) || [];
}

async function addSolveAction(difficulty, tags = []) {
  const entry = makeSimEntry(difficulty, todayKey(), tags);

  if (writeSyncEnabled && serverAllowWrites) {
    await apiRequest('/api/entries', 'POST', { entry });
    addActivity(interactive, `Synced ${difficulty.toUpperCase()} quest to progress file: ${entry.title}`);
    saveInteractiveState(interactive);
    return;
  }

  interactive.extraEntries.push(entry);
  addActivity(interactive, `Solved ${difficulty.toUpperCase()} quest: ${entry.title}`);
  saveInteractiveState(interactive);
}

async function openChestAction() {
  const entries = getEffectiveEntries();
  const stats = calcStats(entries);
  const rewardsState = getEffectiveRewardsState();
  const today = todayKey();
  const claim = rewardsState.claims?.[today];

  if (claim) {
    addActivity(interactive, `Chest already claimed today (${claim.rarity}).`);
    return;
  }

  const preview = interactive.chestRerolls[today] || chestPreview(entries, stats.currentStreak, baseData.rewardsConfig);

  if (writeSyncEnabled && serverAllowWrites) {
    const response = await apiRequest('/api/rewards/claim', 'POST', {
      date: today,
      claim: preview,
    });
    interactive.rewardsStateOverride = null;
    delete interactive.chestRerolls[today];
    addActivity(
      interactive,
      `Synced chest claim: ${response.claim.rarity} (+${response.claim.rewards.coins}c, +${response.claim.rewards.tokens}t, +${response.claim.rewards.gems}g)`
    );
    saveInteractiveState(interactive);
    return;
  }

  if (!rewardsState.claims) rewardsState.claims = {};
  rewardsState.claims[today] = {
    ...preview,
    claimedAt: new Date().toISOString(),
  };
  rewardsState.wallet.coins += preview.rewards.coins;
  rewardsState.wallet.tokens += preview.rewards.tokens;
  rewardsState.wallet.gems += preview.rewards.gems;
  delete interactive.chestRerolls[today];
  addActivity(interactive, `Opened chest: ${preview.rarity} (+${preview.rewards.coins}c, +${preview.rewards.tokens}t, +${preview.rewards.gems}g)`);
  saveInteractiveState(interactive);
}

function rerollChestAction() {
  const rewardsState = getEffectiveRewardsState();
  const today = todayKey();
  if ((rewardsState.claims && rewardsState.claims[today])) {
    addActivity(interactive, 'Cannot reroll: chest already claimed today.');
    return;
  }
  if ((rewardsState.wallet?.tokens || 0) < 1) {
    addActivity(interactive, 'Need 1 token to reroll chest preview.');
    return;
  }

  const entries = getEffectiveEntries();
  const stats = calcStats(entries);
  rewardsState.wallet.tokens -= 1;
  const reroll = chestPreview(entries, stats.currentStreak + 1, baseData.rewardsConfig);
  interactive.chestRerolls[today] = reroll;
  addActivity(interactive, `Rerolled chest preview -> ${reroll.rarity}.`);
  saveInteractiveState(interactive);
}

function backfillYesterdayAction() {
  const yesterday = key(addDays(toDate(todayKey()), -1));
  const entries = getEffectiveEntries();
  const already = entries.some((entry) => entry.solvedAt === yesterday);
  if (already) {
    addActivity(interactive, 'Yesterday is already filled. Nice consistency.');
    return;
  }
  interactive.extraEntries.push(makeSimEntry('easy', yesterday, ['array']));
  addActivity(interactive, `Backfilled yesterday (${yesterday}) with an easy quest.`);
  saveInteractiveState(interactive);
}

async function syncLeetCodeProfileAction() {
  if (!serverAllowWrites) {
    throw new Error('Write API is disabled. Start with npm run lc:web:write.');
  }

  const input = document.getElementById('leetcodeUsernameInput');
  const bootstrapToggle = document.getElementById('leetcodeBootstrapToggle');
  const username = String(input?.value || '').trim();
  if (!username) {
    throw new Error('Enter your LeetCode username first.');
  }

  saveLeetCodeUsername(username);
  const result = await apiRequest('/api/leetcode/sync', 'POST', {
    username,
    limit: 25,
    bootstrapMode: Boolean(bootstrapToggle?.checked),
  });

  interactive.rewardsStateOverride = null;
  addActivity(
    interactive,
    `LeetCode sync @${result.username}: +${result.importedCount} new solve(s) from ${result.fetchedAccepted} accepted recent submissions.`
  );
  if (result.visibilityLimited) {
    addActivity(
      interactive,
      `Profile visibility note: accepted solves exist (local=${result.localAccepted}, global=${result.globalAccepted}) but recent submission history is not publicly exposed.`
    );
    if (!result.bootstrapImportedCount) {
      addActivity(interactive, 'Tip: enable bootstrap mode toggle to import aggregate Easy/Medium/Hard counts.');
    }
  }
  if (result.bootstrapImportedCount > 0) {
    addActivity(
      interactive,
      `Bootstrap imported ${result.bootstrapImportedCount} aggregate entries from profile counts.`
    );
  }
  saveInteractiveState(interactive);
}

function bindButton(id, handler) {
  const el = document.getElementById(id);
  if (!el || el.dataset.bound === '1') return;
  el.dataset.bound = '1';
  el.addEventListener('click', async () => {
    try {
      await handler();
      flashButton(id);
      await refreshBoard(writeSyncEnabled && serverAllowWrites);
    } catch (error) {
      addActivity(interactive, `Action failed: ${error.message}`);
      saveInteractiveState(interactive);
      await refreshBoard(false);
    }
  });
}

async function refreshBoard(reloadBase = false) {
  try {
    if (reloadBase || !baseData) {
      baseData = await loadData();
    }

    const entries = getEffectiveEntries();
    const rewardsState = getEffectiveRewardsState();
    const stats = calcStats(entries);
    render(
      stats,
      baseData.profile,
      entries,
      baseData.bosses,
      baseData.league,
      baseData.raidBosses,
      baseData.rewardsConfig,
      rewardsState,
      interactive
    );

    updateSyncUi();

    const usernameInput = document.getElementById('leetcodeUsernameInput');
    if (usernameInput && !usernameInput.value) {
      usernameInput.value = loadLeetCodeUsername();
    }

    bindButton('missionCompleteBtn', async () => {
      await addSolveAction(baseData.profile.preferredWarmupDifficulty || 'easy');
      addActivity(interactive, 'Mission completed with a focused solve.');
      saveInteractiveState(interactive);
    });

    bindButton('bossAttackBtn', () => addSolveAction('medium', getBossPreferredTags()));
    bindButton('bossFocusBtn', () => addSolveAction('hard', getBossPreferredTags()));
    bindButton('leagueGrindBtn', () => addSolveAction('medium', ['dp', 'array']));
    bindButton('eloDuelBtn', () => addSolveAction('hard', ['graph', 'tree']));
    bindButton('raidAttackBtn', () => addSolveAction('medium', getRaidPreferredTags()));
    bindButton('raidTeamSkillBtn', () => addSolveAction('easy', getRaidPreferredTags()));
    bindButton('streakChargeBtn', () => addSolveAction('easy', ['sliding-window']));
    bindButton('quickEasyBtn', () => addSolveAction('easy'));
    bindButton('quickMediumBtn', () => addSolveAction('medium'));
    bindButton('quickHardBtn', () => addSolveAction('hard'));
    bindButton('chestOpenBtn', openChestAction);
    bindButton('chestRerollBtn', rerollChestAction);
    bindButton('backfillDayBtn', backfillYesterdayAction);
    bindButton('leetcodeSyncBtn', syncLeetCodeProfileAction);

    const syncToggle = document.getElementById('syncWriteToggle');
    if (syncToggle && syncToggle.dataset.bound !== '1') {
      syncToggle.dataset.bound = '1';
      syncToggle.addEventListener('change', async (event) => {
        writeSyncEnabled = Boolean(event.target.checked) && serverAllowWrites;
        saveSyncMode(writeSyncEnabled);
        addActivity(interactive, `Sync mode ${writeSyncEnabled ? 'enabled' : 'disabled'}.`);
        saveInteractiveState(interactive);
        await refreshBoard(writeSyncEnabled && serverAllowWrites);
      });
    }

    const resetBtn = document.getElementById('resetSimBtn');
    if (resetBtn && resetBtn.dataset.bound !== '1') {
      resetBtn.dataset.bound = '1';
      resetBtn.addEventListener('click', async () => {
        interactive = defaultInteractiveState();
        saveInteractiveState(interactive);
        flashButton('resetSimBtn');
        await refreshBoard(false);
      });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn && refreshBtn.dataset.bound !== '1') {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', async () => {
        flashButton('refreshBtn');
        await refreshBoard(true);
      });
    }
  } catch (err) {
    document.getElementById('todayLine').textContent = `Failed to load progress data: ${err.message}`;
  }
}

async function bootstrap() {
  try {
    const state = await apiRequest('/api/state', 'GET');
    serverAllowWrites = Boolean(state.allowWrites);
  } catch {
    serverAllowWrites = false;
  }

  if (!serverAllowWrites) {
    writeSyncEnabled = false;
    saveSyncMode(false);
  }

  await refreshBoard(true);
}

bootstrap();
