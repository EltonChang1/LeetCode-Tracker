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
  const [entriesRes, profileRes, bossesRes, leagueRes, raidRes] = await Promise.all([
    fetch(`/progress/entries.json?ts=${Date.now()}`),
    fetch(`/progress/profile.json?ts=${Date.now()}`),
    fetch(`/progress/bosses.json?ts=${Date.now()}`),
    fetch(`/progress/leagues.json?ts=${Date.now()}`),
    fetch(`/progress/raid-bosses.json?ts=${Date.now()}`),
  ]);

  const entries = entriesRes.ok ? await entriesRes.json() : [];
  const profile = profileRes.ok ? await profileRes.json() : { dailyMinimum: 1, targetMinutes: 20, preferredWarmupDifficulty: 'easy' };
  const bosses = bossesRes.ok ? await bossesRes.json() : fallbackBosses;
  const league = leagueRes.ok ? await leagueRes.json() : fallbackLeagueConfig;
  const raidBosses = raidRes.ok ? await raidRes.json() : fallbackRaidBosses;
  return {
    entries: Array.isArray(entries) ? entries : [],
    profile,
    bosses: Array.isArray(bosses) && bosses.length ? bosses : fallbackBosses,
    league: league && typeof league === 'object' ? league : fallbackLeagueConfig,
    raidBosses: Array.isArray(raidBosses) && raidBosses.length ? raidBosses : fallbackRaidBosses,
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

function raidStatus(entries, raidBosses) {
  const today = toDate(todayKey());
  const weekStart = getWeekStartMonday(today);
  const weekEnd = addDays(weekStart, 6);
  const weekIndex = getWeekIndex(today);
  const boss = raidBosses[weekIndex % raidBosses.length];
  if (!boss) return null;

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

  const allies = ['Nova', 'Cipher', 'Rune'].map((name, idx) => ({
    name,
    damage: pseudoRandomNumber(`${name}-${key(weekStart)}-${idx}`, 180, 340) + Math.min(120, weekEntries.length * 18),
  }));

  const teamDamage = allies.reduce((sum, ally) => sum + ally.damage, 0);
  const hp = Number(boss.weeklyHp || 1500);
  const totalDamage = playerDamage + teamDamage;
  const hpLeft = Math.max(0, hp - totalDamage);
  const clearPct = Math.round((Math.min(totalDamage, hp) / hp) * 100);
  const rewardTier = clearPct >= 100 ? 'Legendary' : clearPct >= 80 ? 'Epic' : clearPct >= 55 ? 'Rare' : 'Common';

  return {
    boss,
    weekRange: `${key(weekStart)} to ${key(weekEnd)}`,
    hp,
    totalDamage,
    playerDamage,
    teamDamage,
    hpLeft,
    clearPct,
    rewardTier,
    allies,
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

function render(stats, profile, entries, bosses, leagueConfig, raidBosses) {
  document.getElementById('todayLine').textContent = `Today: ${todayKey()} · ${stats.todayCount} solve(s)`;
  document.getElementById('currentStreak').textContent = `${stats.currentStreak}d`;
  document.getElementById('longestStreak').textContent = `${stats.longestStreak}d`;
  document.getElementById('xpLevel').textContent = `${stats.xp} XP · Lv ${stats.level}`;
  document.getElementById('consistency').textContent = `${stats.consistencyScore}/100`;
  document.getElementById('shieldText').textContent = `${stats.freezeMissesUsed}/${stats.freezeMissesAllowed} used`;
  document.getElementById('missionText').textContent = missionText(stats, profile);
  document.getElementById('nudgeText').textContent = nudge(stats);

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

  const raid = raidStatus(entries, raidBosses);
  if (raid) {
    document.getElementById('raidBoss').textContent = `${raid.boss.name} · ${raid.clearPct}% · ${raid.rewardTier}`;
    document.getElementById('raidDamage').textContent = `Damage ${raid.totalDamage}/${raid.hp} · You ${raid.playerDamage} · Team ${raid.teamDamage}`;
    document.getElementById('raidAllies').textContent = `Allies: ${raid.allies.map((ally) => `${ally.name}:${ally.damage}`).join(', ')}`;
  }
}

async function bootstrap() {
  try {
    const { entries, profile, bosses, league, raidBosses } = await loadData();
    const stats = calcStats(entries);
    render(stats, profile, entries, bosses, league, raidBosses);
  } catch (err) {
    document.getElementById('todayLine').textContent = `Failed to load progress data: ${err.message}`;
  }
}

document.getElementById('refreshBtn').addEventListener('click', bootstrap);
bootstrap();
