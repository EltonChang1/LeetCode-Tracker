const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const RECENT_SUBMISSIONS_QUERY = `
  query recentSubmissions($username: String!, $limit: Int!) {
    recentSubmissionList(username: $username, limit: $limit) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

const RECENT_ACCEPTED_QUERY = `
  query recentAccepted($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      title
      titleSlug
      timestamp
    }
  }
`;

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      difficulty
      topicTags {
        slug
      }
    }
  }
`;

const MATCHED_USER_STATS_QUERY = `
  query matchedUserStats($username: String!) {
    matchedUser(username: $username) {
      username
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
  }
`;

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
    golang: 'go',
    go: 'go',
    rust: 'rs',
  };
  return aliases[raw] || (raw || 'txt');
}

function normalizeDifficulty(input) {
  const value = String(input || '').toLowerCase();
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
}

function toDateKeyFromTimestamp(timestamp) {
  const num = Number(timestamp);
  if (!Number.isFinite(num)) return null;
  const d = new Date(num * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function postGraphQL(query, variables) {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com',
      Origin: 'https://leetcode.com',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode request failed (${response.status})`);
  }

  const payload = await response.json();
  if (payload.errors && payload.errors.length) {
    const msg = payload.errors[0]?.message || 'LeetCode GraphQL error';
    throw new Error(msg);
  }

  return payload.data || {};
}

async function fetchRecentAccepted(username, limit) {
  const data = await postGraphQL(RECENT_SUBMISSIONS_QUERY, {
    username,
    limit,
  }).catch(async () => {
    const fallback = await postGraphQL(RECENT_ACCEPTED_QUERY, {
      username,
      limit,
    });
    const accepted = Array.isArray(fallback.recentAcSubmissionList) ? fallback.recentAcSubmissionList : [];
    return {
      recentSubmissionList: accepted.map((item) => ({
        ...item,
        statusDisplay: 'Accepted',
        lang: 'txt',
      })),
    };
  });

  const list = Array.isArray(data.recentSubmissionList) ? data.recentSubmissionList : [];
  return list.filter((item) => String(item.statusDisplay || '').toLowerCase() === 'accepted');
}

async function fetchQuestionMeta(titleSlug, cache) {
  if (!titleSlug) {
    return {
      questionFrontendId: null,
      difficulty: 'medium',
      topicTags: [],
    };
  }

  if (cache.has(titleSlug)) {
    return cache.get(titleSlug);
  }

  const data = await postGraphQL(QUESTION_QUERY, { titleSlug });
  const question = data.question || {};
  const normalized = {
    questionFrontendId: question.questionFrontendId || null,
    difficulty: normalizeDifficulty(question.difficulty),
    topicTags: Array.isArray(question.topicTags)
      ? question.topicTags.map((tag) => String(tag.slug || '').trim().toLowerCase()).filter(Boolean)
      : [],
  };
  cache.set(titleSlug, normalized);
  return normalized;
}

async function fetchAcceptedTotals(username) {
  const data = await postGraphQL(MATCHED_USER_STATS_QUERY, { username });
  const matched = data.matchedUser || {};
  const local = Array.isArray(matched.submitStats?.acSubmissionNum) ? matched.submitStats.acSubmissionNum : [];
  const global = Array.isArray(matched.submitStatsGlobal?.acSubmissionNum) ? matched.submitStatsGlobal.acSubmissionNum : [];

  const pickAll = (arr) => {
    const item = arr.find((value) => String(value?.difficulty || '').toLowerCase() === 'all');
    return Number(item?.count || 0);
  };

  const byDifficulty = (arr) => {
    const safe = Array.isArray(arr) ? arr : [];
    const pick = (difficulty) => {
      const item = safe.find((value) => String(value?.difficulty || '').toLowerCase() === difficulty);
      return Number(item?.count || 0);
    };
    return {
      easy: pick('easy'),
      medium: pick('medium'),
      hard: pick('hard'),
    };
  };

  return {
    localAccepted: pickAll(local),
    globalAccepted: pickAll(global),
    localByDifficulty: byDifficulty(local),
    globalByDifficulty: byDifficulty(global),
  };
}

function countExistingBootstrapEntries(existingEntries, username, difficulty) {
  const marker = `Bootstrap aggregate import from LeetCode @${username}`;
  return existingEntries.filter((entry) => {
    const note = String(entry.notes || '');
    return note.includes(marker) && String(entry.difficulty || '').toLowerCase() === difficulty;
  }).length;
}

function createBootstrapEntries({ username, targetByDifficulty, existingEntries }) {
  const createdAt = new Date().toISOString();
  const seedDates = {
    easy: '2000-01-01',
    medium: '2000-01-02',
    hard: '2000-01-03',
  };

  const imported = [];
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const target = Number(targetByDifficulty[difficulty] || 0);
    const existingBootstrap = countExistingBootstrapEntries(existingEntries, username, difficulty);
    const needed = Math.max(0, target - existingBootstrap);

    for (let index = 0; index < needed; index += 1) {
      const serial = existingBootstrap + index + 1;
      imported.push({
        id: `BOOT-${username}-${difficulty}-${serial}`,
        title: `[Bootstrap] ${difficulty[0].toUpperCase() + difficulty.slice(1)} solved #${serial}`,
        difficulty,
        language: 'txt',
        solvedAt: seedDates[difficulty],
        timeMinutes: null,
        tags: [],
        url: `https://leetcode.com/${username}/`,
        notes: `Bootstrap aggregate import from LeetCode @${username}`,
        createdAt,
      });
    }
  }

  return imported;
}

async function syncLeetCodeEntries({ username, limit = 20, existingEntries = [], bootstrapMode = false }) {
  const cleanUsername = String(username || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(cleanUsername)) {
    throw new Error('Invalid username. Use LeetCode username (letters, numbers, _, -).');
  }

  const cappedLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const recentAccepted = await fetchRecentAccepted(cleanUsername, cappedLimit);
  const totals = await fetchAcceptedTotals(cleanUsername).catch(() => ({
    localAccepted: 0,
    globalAccepted: 0,
    localByDifficulty: { easy: 0, medium: 0, hard: 0 },
    globalByDifficulty: { easy: 0, medium: 0, hard: 0 },
  }));

  const detailCache = new Map();
  const existingKeys = new Set(
    existingEntries.map((entry) => `${String(entry.id)}|${entry.solvedAt}|${String(entry.language || '')}`)
  );

  const imported = [];
  for (const submission of recentAccepted) {
    const slug = String(submission.titleSlug || '').trim();
    const solvedAt = toDateKeyFromTimestamp(submission.timestamp);
    if (!slug || !solvedAt) continue;

    const meta = await fetchQuestionMeta(slug, detailCache);
    const language = normalizeLanguage(submission.lang || 'txt');
    const id = String(meta.questionFrontendId || slug);
    const dedupeKey = `${id}|${solvedAt}|${language}`;

    if (existingKeys.has(dedupeKey)) {
      continue;
    }

    const entry = {
      id,
      title: String(submission.title || slug)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160),
      difficulty: normalizeDifficulty(meta.difficulty),
      language,
      solvedAt,
      timeMinutes: null,
      tags: meta.topicTags,
      url: `https://leetcode.com/problems/${slug}/`,
      notes: `Imported from LeetCode profile @${cleanUsername}`,
      createdAt: new Date().toISOString(),
    };

    imported.push(entry);
    existingKeys.add(dedupeKey);
  }

  let bootstrapImportedCount = 0;
  if (!imported.length && bootstrapMode && recentAccepted.length === 0 && (totals.localAccepted > 0 || totals.globalAccepted > 0)) {
    const byDifficultySource = totals.localAccepted > 0 ? totals.localByDifficulty : totals.globalByDifficulty;
    const bootstrapImported = createBootstrapEntries({
      username: cleanUsername,
      targetByDifficulty: byDifficultySource,
      existingEntries,
    });
    imported.push(...bootstrapImported);
    bootstrapImportedCount = bootstrapImported.length;
  }

  return {
    username: cleanUsername,
    fetchedAccepted: recentAccepted.length,
    localAccepted: totals.localAccepted,
    globalAccepted: totals.globalAccepted,
    localByDifficulty: totals.localByDifficulty,
    globalByDifficulty: totals.globalByDifficulty,
    visibilityLimited: recentAccepted.length === 0 && (totals.localAccepted > 0 || totals.globalAccepted > 0),
    bootstrapUsed: Boolean(bootstrapMode),
    bootstrapImportedCount,
    imported,
  };
}

module.exports = {
  syncLeetCodeEntries,
};
