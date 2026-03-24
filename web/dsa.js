const DSA_STORAGE_KEY = 'lcq-dsa-state-v2';
const DAILY_SET_SIZE = 3;

const dsaQuestions = [
  { title: 'Two Sum', id: 'two-sum', difficulty: 'easy', topic: 'Arrays', tags: ['array', 'hash-table'], description: 'Find a pair quickly by trading brute force for lookup speed.' },
  { title: 'Merge Sorted Array', id: 'merge-sorted-array', difficulty: 'easy', topic: 'Two Pointers', tags: ['array', 'two-pointers'], description: 'Practice in-place merging by filling from the back.' },
  { title: 'Backspace String Compare', id: 'backspace-string-compare', difficulty: 'easy', topic: 'Two Pointers', tags: ['string', 'two-pointers'], description: 'Simulate editor backspaces without rebuilding the whole string.' },
  { title: 'Palindrome Linked List', id: 'palindrome-linked-list', difficulty: 'easy', topic: 'Linked Lists', tags: ['linked-list', 'two-pointers'], description: 'Use middle, reverse, and compare to test symmetry efficiently.' },
  { title: 'Merge Two Sorted Lists', id: 'merge-two-sorted-lists', difficulty: 'easy', topic: 'Linked Lists', tags: ['linked-list', 'recursion'], description: 'A classic merge routine that rewards pointer confidence.' },
  { title: 'Longest Substring Without Repeating Characters', id: 'longest-substring-without-repeating-characters', difficulty: 'medium', topic: 'Sliding Window', tags: ['string', 'sliding-window', 'hash-table'], description: 'Track a valid window while duplicates push the left edge forward.' },
  { title: 'Longest Palindromic Substring', id: 'longest-palindromic-substring', difficulty: 'medium', topic: 'Strings', tags: ['string', 'dynamic-programming'], description: 'Expand around centers to find the best mirror in the string.' },
  { title: 'Container With Most Water', id: 'container-with-most-water', difficulty: 'medium', topic: 'Two Pointers', tags: ['array', 'two-pointers', 'greedy'], description: 'Shrink the weaker wall first and learn why it works.' },
  { title: 'Remove Duplicates from Sorted List II', id: 'remove-duplicates-from-sorted-list-ii', difficulty: 'medium', topic: 'Linked Lists', tags: ['linked-list'], description: 'Use a dummy head to cleanly remove repeated blocks.' },
  { title: '3Sum', id: '3sum', difficulty: 'medium', topic: 'Two Pointers', tags: ['array', 'sorting', 'two-pointers'], description: 'Sort first, then collapse the search with a moving pair.' },
  { title: 'Interval List Intersections', id: 'interval-list-intersections', difficulty: 'medium', topic: 'Intervals', tags: ['intervals', 'two-pointers'], description: 'Walk both interval lists and compare overlapping ranges.' },
  { title: 'Find All Anagrams in a String', id: 'find-all-anagrams-in-a-string', difficulty: 'medium', topic: 'Sliding Window', tags: ['string', 'sliding-window'], description: 'Maintain character counts in a fixed-size window.' },
  { title: 'Subarray Product Less Than K', id: 'subarray-product-less-than-k', difficulty: 'medium', topic: 'Sliding Window', tags: ['array', 'sliding-window'], description: 'Use a multiplicative window to count valid subarrays fast.' },
  { title: 'Minimum Size Subarray Sum', id: 'minimum-size-subarray-sum', difficulty: 'medium', topic: 'Sliding Window', tags: ['array', 'sliding-window'], description: 'Shrink the window only when the running total clears the target.' },
  { title: 'Remove Nth Node From End of List', id: 'remove-nth-node-from-end-of-list', difficulty: 'medium', topic: 'Linked Lists', tags: ['linked-list', 'two-pointers'], description: 'Gap two pointers to land right before the removal point.' },
  { title: '3Sum Closest', id: '3sum-closest', difficulty: 'medium', topic: 'Two Pointers', tags: ['array', 'sorting', 'two-pointers'], description: 'The sorted two-pointer pattern also works when exact matches are rare.' },
  { title: 'Add Two Numbers II', id: 'add-two-numbers-ii', difficulty: 'medium', topic: 'Linked Lists', tags: ['linked-list', 'stack'], description: 'Stacks help when addition must happen from the end.' },
  { title: 'Trapping Rain Water', id: 'trapping-rain-water', difficulty: 'hard', topic: 'Two Pointers', tags: ['array', 'two-pointers', 'stack'], description: 'Model left and right boundaries to measure trapped volume.' },
  { title: 'Rotate Array', id: 'rotate-array', difficulty: 'medium', topic: 'Arrays', tags: ['array'], description: 'Practice reversal-based transforms on arrays.' },
  { title: 'Minimum Window Substring', id: 'minimum-window-substring', difficulty: 'hard', topic: 'Sliding Window', tags: ['string', 'sliding-window', 'hash-table'], description: 'A high-value sliding window challenge with tight validity bookkeeping.' },
  { title: 'Rank Transform of an Array', id: 'rank-transform-of-an-array', difficulty: 'easy', topic: 'Arrays', tags: ['array', 'sorting', 'hash-table'], description: 'Map sorted unique values back to compact ranks.' },
  { title: 'K Closest Points to Origin', id: 'k-closest-points-to-origin', difficulty: 'medium', topic: 'Heaps', tags: ['heap', 'geometry'], description: 'Use a heap or quickselect to keep only the closest points.' },
  { title: 'Binary Tree Level Order Traversal II', id: 'binary-tree-level-order-traversal-ii', difficulty: 'medium', topic: 'Trees', tags: ['tree', 'bfs'], description: 'Level-order traversal becomes more interesting when output order flips.' },
  { title: 'Sliding Window Maximum', id: 'sliding-window-maximum', difficulty: 'hard', topic: 'Monotonic Queue', tags: ['array', 'deque', 'sliding-window'], description: 'Train the monotonic deque pattern for fast max queries.' },
  { title: 'Constrained Subsequence Sum', id: 'constrained-subsequence-sum', difficulty: 'hard', topic: 'Dynamic Programming', tags: ['dp', 'deque'], description: 'Mix DP with a windowed max structure to stay linear.' },
  { title: 'Minimum Cost to Hire K Workers', id: 'minimum-cost-to-hire-k-workers', difficulty: 'hard', topic: 'Heaps', tags: ['heap', 'greedy'], description: 'Sort by ratio and use a heap to control the candidate pool.' },
  { title: 'Merge K Sorted Lists', id: 'merge-k-sorted-lists', difficulty: 'hard', topic: 'Heaps', tags: ['linked-list', 'heap'], description: 'A heap turns many sorted streams into one clean merge.' },
  { title: 'Reverse Linked List', id: 'reverse-linked-list', difficulty: 'easy', topic: 'Linked Lists', tags: ['linked-list'], description: 'The core pointer-flip drill every list problem builds on.' },
  { title: 'Valid Parentheses', id: 'valid-parentheses', difficulty: 'easy', topic: 'Stacks', tags: ['stack', 'string'], description: 'Use a stack to model what still needs to be closed.' },
  { title: 'Smallest Subsequence of Distinct Characters', id: 'smallest-subsequence-of-distinct-characters', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'greedy', 'string'], description: 'A monotonic stack can build the lexicographically smallest answer.' },
  { title: 'Min Stack', id: 'min-stack', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'design'], description: 'Design a stack that can answer min queries instantly.' },
  { title: 'Basic Calculator II', id: 'basic-calculator-ii', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'math', 'string'], description: 'Stream through operators while preserving precedence.' },
  { title: 'Find the Most Competitive Subsequence', id: 'find-the-most-competitive-subsequence', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'greedy'], description: 'Use a constrained monotonic stack to keep the best subsequence.' },
  { title: 'Reorder List', id: 'reorder-list', difficulty: 'medium', topic: 'Linked Lists', tags: ['linked-list'], description: 'Split, reverse, and weave two halves together.' },
  { title: 'Daily Temperatures', id: 'daily-temperatures', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'monotonic-stack'], description: 'Monotonic stacks shine when each value wants its next greater answer.' },
  { title: 'Next Greater Element II', id: 'next-greater-element-ii', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'monotonic-stack'], description: 'Handle circular scans without losing the next-greater pattern.' },
  { title: 'Asteroid Collision', id: 'asteroid-collision', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'simulation'], description: 'Use a stack to resolve opposing motion and repeated collisions.' },
  { title: 'Minimum Remove to Make Valid Parentheses', id: 'minimum-remove-to-make-valid-parentheses', difficulty: 'medium', topic: 'Stacks', tags: ['stack', 'string'], description: 'Track invalid positions and rebuild only what survives.' },
  { title: 'Longest Valid Parentheses', id: 'longest-valid-parentheses', difficulty: 'hard', topic: 'Stacks', tags: ['stack', 'string', 'dynamic-programming'], description: 'Measure balanced ranges with index-aware stack logic.' },
  { title: 'Create Maximum Number', id: 'create-maximum-number', difficulty: 'hard', topic: 'Greedy', tags: ['greedy', 'stack'], description: 'Build the strongest subsequences and merge them carefully.' },
  { title: 'Number of Atoms', id: 'number-of-atoms', difficulty: 'hard', topic: 'Stacks', tags: ['stack', 'string', 'hash-table'], description: 'Nested formulas become manageable when scopes stack cleanly.' },
  { title: 'Largest Rectangle in Histogram', id: 'largest-rectangle-in-histogram', difficulty: 'hard', topic: 'Monotonic Stack', tags: ['stack', 'monotonic-stack'], description: 'One of the most important monotonic stack templates to master.' },
  { title: 'Subtree of Another Tree', id: 'subtree-of-another-tree', difficulty: 'easy', topic: 'Trees', tags: ['tree', 'dfs'], description: 'Compare subtrees recursively and reason about structural equality.' },
  { title: 'Same Tree', id: 'same-tree', difficulty: 'easy', topic: 'Trees', tags: ['tree', 'dfs'], description: 'A compact recursion drill for tree identity.' },
  { title: 'Symmetric Tree', id: 'symmetric-tree', difficulty: 'easy', topic: 'Trees', tags: ['tree', 'dfs', 'bfs'], description: 'Mirror recursion teaches how to compare opposite branches.' },
  { title: 'Cheapest Flights Within K Stops', id: 'cheapest-flights-within-k-stops', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'shortest-path'], description: 'Balance path cost with stop count constraints.' },
  { title: 'Path with Minimum Effort', id: 'path-with-minimum-effort', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'dijkstra', 'grid'], description: 'Think in terms of minimizing the worst edge on the chosen path.' },
  { title: 'Course Schedule II', id: 'course-schedule-ii', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'topological-sort'], description: 'Topological ordering is the heart of prerequisite scheduling.' },
  { title: 'Implement Trie Prefix Tree', id: 'implement-trie-prefix-tree', difficulty: 'medium', topic: 'Tries', tags: ['trie', 'design'], description: 'Build a prefix structure that makes repeated lookups cheap.' },
  { title: 'Number of Islands', id: 'number-of-islands', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'dfs', 'bfs', 'grid'], description: 'Flood fill each component once and count the landmasses.' },
  { title: 'Number of Provinces', id: 'number-of-provinces', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'dfs', 'union-find'], description: 'Component counting appears again in matrix graph form.' },
  { title: 'Populating Next Right Pointers in Each Node II', id: 'populating-next-right-pointers-in-each-node-ii', difficulty: 'medium', topic: 'Trees', tags: ['tree', 'bfs'], description: 'Connect nodes level by level without depending on a perfect tree.' },
  { title: 'Shortest Path in Binary Matrix', id: 'shortest-path-in-binary-matrix', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'bfs', 'grid'], description: 'Classic BFS in eight directions on a grid.' },
  { title: 'All Paths From Source to Target', id: 'all-paths-from-source-to-target', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'dfs', 'backtracking'], description: 'Enumerate every route with DFS and backtracking.' },
  { title: 'Rotting Oranges', id: 'rotting-oranges', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'bfs', 'grid'], description: 'Multi-source BFS gives you the minute-by-minute spread.' },
  { title: 'N-ary Tree Level Order Traversal', id: 'n-ary-tree-level-order-traversal', difficulty: 'medium', topic: 'Trees', tags: ['tree', 'bfs'], description: 'A BFS warmup with many children per node.' },
  { title: 'Time Needed to Inform All Employees', id: 'time-needed-to-inform-all-employees', difficulty: 'medium', topic: 'Trees', tags: ['tree', 'dfs'], description: 'Propagate time through a management tree to find the longest chain.' },
  { title: 'Binary Tree Right Side View', id: 'binary-tree-right-side-view', difficulty: 'medium', topic: 'Trees', tags: ['tree', 'bfs', 'dfs'], description: 'Capture the visible node on each level from one side.' },
  { title: 'Most Stones Removed with Same Row or Column', id: 'most-stones-removed-with-same-row-or-column', difficulty: 'medium', topic: 'Graphs', tags: ['graph', 'union-find'], description: 'Convert the board into connected components and count removals.' },
  { title: 'Bus Routes', id: 'bus-routes', difficulty: 'hard', topic: 'Graphs', tags: ['graph', 'bfs'], description: 'BFS across routes instead of raw stops to avoid exploding state.' },
];

const topicHints = {
  Arrays: ['Look for a reusable invariant before reaching for brute force.', 'Ask whether sorting or hashing reduces repeated work.'],
  'Two Pointers': ['Decide what condition makes one pointer move instead of the other.', 'Draw the left and right meaning before coding.'],
  'Sliding Window': ['Define exactly what makes the window valid.', 'Only shrink after the window has become strong enough.'],
  'Linked Lists': ['A dummy node often simplifies edge cases.', 'Pause and sketch pointer roles before mutating links.'],
  Intervals: ['Sort or align by start times, then compare one step at a time.', 'Treat overlap detection as a local decision.'],
  Heaps: ['Use the heap for the one thing you need to know fastest.', 'Keep heap contents minimal and purposeful.'],
  Trees: ['Pick DFS for structure, BFS for levels.', 'Write down what each recursive call promises to return.'],
  Stacks: ['Store exactly what future work still depends on.', 'Indices are often more useful than raw values.'],
  'Monotonic Stack': ['The stack should stay ordered after every push.', 'Pop while the new value answers questions for older entries.'],
  'Monotonic Queue': ['Keep candidates in the order they can still matter.', 'Remove expired indices before reading the best answer.'],
  Graphs: ['Choose the graph shape first: adjacency list, grid, or implicit states.', 'BFS is for minimum steps, DFS is for exploration, Dijkstra is for weighted paths.'],
  Tries: ['Each node represents a shared prefix, not a whole word.', 'Distinguish between a path existing and a word ending.'],
  'Dynamic Programming': ['Name the state before naming the loop.', 'Ask what previous answers are required for this position.'],
  Strings: ['Index-based reasoning is usually cleaner than rebuilding strings.', 'Try center expansion when symmetry matters.'],
  Greedy: ['State why a local best choice cannot hurt future options.', 'Greedy gets much safer once you can prove an exchange argument.'],
};

const statusMeta = {
  'not-started': { label: 'Not Started', className: 'status-not-started' },
  'in-progress': { label: 'In Progress', className: 'status-in-progress' },
  solved: { label: 'Solved', className: 'status-solved' },
  review: { label: 'Revisit', className: 'status-review' },
  mastered: { label: 'Mastered', className: 'status-mastered' },
};

let state = loadState();
let rerollSeed = 0;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DSA_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(DSA_STORAGE_KEY, JSON.stringify(state));
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function titleCase(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hashString(value) {
  return [...String(value || '')].reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) % 10007, 7);
}

function getQuestionState(id) {
  return {
    status: 'not-started',
    notes: '',
    lastTouched: '',
    attempts: 0,
    confidence: 0,
    expanded: false,
    ...state[id],
  };
}

function updateQuestionState(id, patch) {
  state = {
    ...state,
    [id]: {
      ...getQuestionState(id),
      ...patch,
    },
  };
  saveState();
  render();
}

function pickHints(question) {
  const topicSpecific = topicHints[question.topic] || ['State the invariant out loud before you code.', 'Look for a pattern the topic uses repeatedly.'];
  return [
    question.description,
    topicSpecific[0],
    topicSpecific[1],
  ];
}

function questionWithState(question) {
  const current = getQuestionState(question.id);
  return {
    ...question,
    state: current,
    hints: pickHints(question),
    url: `https://leetcode.com/problems/${question.id}/`,
  };
}

function getAllQuestions() {
  return dsaQuestions.map(questionWithState);
}

function getFilters() {
  return {
    search: document.getElementById('searchInput')?.value.trim().toLowerCase() || '',
    status: document.getElementById('statusFilter')?.value || 'all',
    difficulty: document.getElementById('difficultyFilter')?.value || 'all',
    topic: document.getElementById('topicFilter')?.value || 'all',
  };
}

function filterQuestions(questions, filters) {
  return questions.filter((question) => {
    const haystack = [question.title, question.topic, ...question.tags].join(' ').toLowerCase();
    const matchesSearch = !filters.search || haystack.includes(filters.search);
    const matchesStatus = filters.status === 'all' || question.state.status === filters.status;
    const matchesDifficulty = filters.difficulty === 'all' || question.difficulty === filters.difficulty;
    const matchesTopic = filters.topic === 'all' || question.topic === filters.topic;
    return matchesSearch && matchesStatus && matchesDifficulty && matchesTopic;
  });
}

function scoreQuestion(question) {
  const statusBoost = {
    review: 110,
    'in-progress': 90,
    'not-started': 70,
    solved: 30,
    mastered: 10,
  };
  const difficultyBoost = {
    easy: 8,
    medium: 18,
    hard: 28,
  };
  const staleBonus = question.state.lastTouched && question.state.lastTouched !== todayKey() ? 12 : 0;
  const rerollBonus = (hashString(`${question.id}:${rerollSeed}`) % 17);
  return (statusBoost[question.state.status] || 0) + (difficultyBoost[question.difficulty] || 0) + staleBonus + rerollBonus;
}

function buildDailySet(questions) {
  return [...questions]
    .sort((a, b) => {
      const delta = scoreQuestion(b) - scoreQuestion(a);
      if (delta !== 0) return delta;
      return a.title.localeCompare(b.title);
    })
    .slice(0, DAILY_SET_SIZE);
}

function getTopicStats(questions) {
  const grouped = new Map();
  questions.forEach((question) => {
    const item = grouped.get(question.topic) || { total: 0, solved: 0, mastered: 0, review: 0 };
    item.total += 1;
    if (question.state.status === 'solved' || question.state.status === 'mastered') item.solved += 1;
    if (question.state.status === 'mastered') item.mastered += 1;
    if (question.state.status === 'review') item.review += 1;
    grouped.set(question.topic, item);
  });
  return [...grouped.entries()]
    .map(([topic, stats]) => ({ topic, ...stats, percent: Math.round((stats.solved / stats.total) * 100) }))
    .sort((a, b) => b.percent - a.percent || a.topic.localeCompare(b.topic));
}

function updateHeroLine(questions) {
  const reviewCount = questions.filter((question) => question.state.status === 'review').length;
  const inProgressCount = questions.filter((question) => question.state.status === 'in-progress').length;
  const line = reviewCount
    ? `${reviewCount} questions are waiting in your review queue.`
    : inProgressCount
      ? `${inProgressCount} problems are already in motion.`
      : 'Pick a route, start small, and keep the streak moving.';
  document.getElementById('dsaHeroLine').textContent = line;
}

function renderStats(questions) {
  const total = questions.length;
  const solved = questions.filter((question) => question.state.status === 'solved' || question.state.status === 'mastered').length;
  const inProgress = questions.filter((question) => question.state.status === 'in-progress').length;
  const review = questions.filter((question) => question.state.status === 'review').length;
  const mastered = questions.filter((question) => question.state.status === 'mastered').length;

  document.getElementById('progressStat').textContent = `${solved}/${total}`;
  document.getElementById('inProgressStat').textContent = String(inProgress);
  document.getElementById('reviewStat').textContent = String(review);
  document.getElementById('masteredStat').textContent = String(mastered);
}

function renderDailySet(questions) {
  const container = document.getElementById('dailySet');
  const dailySet = buildDailySet(questions);

  container.innerHTML = dailySet.length
    ? dailySet.map((question) => `
        <article class="daily-card">
          <div class="daily-card-copy">
            <p class="daily-kicker">${question.topic} · ${titleCase(question.difficulty)}</p>
            <h3>${question.title}</h3>
            <p class="muted">${question.description}</p>
          </div>
          <div class="actions">
            <button class="btn small ghost" type="button" data-jump="${question.id}">Open Card</button>
            <button class="btn small" type="button" data-status="${question.id}:in-progress">Start</button>
          </div>
        </article>
      `).join('')
    : '<p class="muted">No questions found for today&apos;s route yet.</p>';
}

function renderTopicProgress(questions) {
  const container = document.getElementById('topicProgress');
  const items = getTopicStats(questions);
  container.innerHTML = items.map((item) => `
    <article class="topic-card">
      <div class="topic-line">
        <strong>${item.topic}</strong>
        <span>${item.solved}/${item.total} solved</span>
      </div>
      <div class="topic-bar">
        <span style="width:${item.percent}%"></span>
      </div>
      <p class="muted">${item.percent}% clear${item.review ? ` · ${item.review} queued for revisit` : ''}${item.mastered ? ` · ${item.mastered} mastered` : ''}</p>
    </article>
  `).join('');
}

function renderBoard(questions, filters) {
  const board = document.getElementById('dsaQuestions');
  const filtered = filterQuestions(questions, filters);
  document.getElementById('resultsLine').textContent = `${filtered.length} question${filtered.length === 1 ? '' : 's'} match your current filters.`;

  board.innerHTML = filtered.length
    ? filtered.map((question) => renderQuestionCard(question)).join('')
    : '<article class="card"><p class="muted">Nothing matches this filter set. Clear filters or reroll your route.</p></article>';
}

function renderQuestionCard(question) {
  const status = statusMeta[question.state.status] || statusMeta['not-started'];
  const confidenceLabel = question.state.confidence ? `${question.state.confidence}/5 confidence` : 'No confidence rating yet';

  return `
    <article class="card dsa-question-card ${question.state.expanded ? 'expanded' : ''}" id="question-${question.id}">
      <div class="question-top">
        <div>
          <div class="question-meta">
            <span class="pill ${status.className}">${status.label}</span>
            <span class="pill pill-difficulty">${titleCase(question.difficulty)}</span>
            <span class="pill pill-topic">${question.topic}</span>
          </div>
          <h2>${question.title}</h2>
          <p class="muted">${question.description}</p>
        </div>
        <div class="actions">
          <button class="btn small ghost" type="button" data-toggle="${question.id}">
            ${question.state.expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      <div class="chips">
        ${question.tags.map((tag) => `<span class="chip">${tag}</span>`).join('')}
      </div>

      <div class="question-actions actions">
        <button class="btn small ghost" type="button" data-status="${question.id}:not-started">Reset</button>
        <button class="btn small ghost" type="button" data-status="${question.id}:in-progress">In Progress</button>
        <button class="btn small ghost" type="button" data-status="${question.id}:solved">Solved</button>
        <button class="btn small ghost" type="button" data-status="${question.id}:review">Revisit</button>
        <button class="btn small" type="button" data-status="${question.id}:mastered">Mastered</button>
      </div>

      ${question.state.expanded ? `
        <div class="question-detail-grid">
          <section class="detail-panel">
            <h3>Guided Hints</h3>
            <ol class="hint-list">
              ${question.hints.map((hint) => `<li>${hint}</li>`).join('')}
            </ol>
            <p class="muted">Last touched: ${question.state.lastTouched || 'Not yet'}</p>
            <p class="muted">Attempts: ${question.state.attempts}</p>
            <p class="muted">${confidenceLabel}</p>
            <div class="actions">
              <button class="btn small ghost" type="button" data-attempt="${question.id}">+ Attempt</button>
              <a class="btn small ghost" href="${question.url}" target="_blank" rel="noreferrer">Open LeetCode</a>
            </div>
          </section>

          <section class="detail-panel">
            <h3>Reflection Notes</h3>
            <label class="filter-field">
              <span>Confidence</span>
              <select class="text-input" data-confidence="${question.id}">
                <option value="0"${question.state.confidence === 0 ? ' selected' : ''}>Rate your confidence</option>
                <option value="1"${question.state.confidence === 1 ? ' selected' : ''}>1 - very shaky</option>
                <option value="2"${question.state.confidence === 2 ? ' selected' : ''}>2 - needs another pass</option>
                <option value="3"${question.state.confidence === 3 ? ' selected' : ''}>3 - decent</option>
                <option value="4"${question.state.confidence === 4 ? ' selected' : ''}>4 - strong</option>
                <option value="5"${question.state.confidence === 5 ? ' selected' : ''}>5 - can teach it</option>
              </select>
            </label>
            <textarea class="dsa-notes" data-notes="${question.id}" placeholder="Capture the trick, bug, edge case, or what you want to revisit...">${escapeHtml(question.state.notes)}</textarea>
          </section>
        </div>
      ` : ''}
    </article>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function populateTopicFilter() {
  const select = document.getElementById('topicFilter');
  const current = select.value || 'all';
  const topics = [...new Set(dsaQuestions.map((question) => question.topic))].sort();
  select.innerHTML = '<option value="all">All topics</option>' + topics.map((topic) => `<option value="${topic}">${topic}</option>`).join('');
  select.value = topics.includes(current) ? current : 'all';
}

function attachEventHandlers() {
  document.getElementById('searchInput').addEventListener('input', render);
  document.getElementById('statusFilter').addEventListener('change', render);
  document.getElementById('difficultyFilter').addEventListener('change', render);
  document.getElementById('topicFilter').addEventListener('change', render);

  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('difficultyFilter').value = 'all';
    document.getElementById('topicFilter').value = 'all';
    render();
  });

  document.getElementById('rerollSetBtn').addEventListener('click', () => {
    rerollSeed += 1;
    render();
  });

  document.getElementById('randomPickBtn').addEventListener('click', () => {
    const questions = filterQuestions(getAllQuestions(), getFilters());
    if (!questions.length) return;
    const choice = questions[Math.floor(Math.random() * questions.length)];
    updateQuestionState(choice.id, { expanded: true, lastTouched: getQuestionState(choice.id).lastTouched });
    requestAnimationFrame(() => {
      document.getElementById(`question-${choice.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.getElementById('dailySet').addEventListener('click', handleDelegatedClick);
  document.getElementById('dsaQuestions').addEventListener('click', handleDelegatedClick);
  document.getElementById('dsaQuestions').addEventListener('change', handleDelegatedChange);
  document.getElementById('dsaQuestions').addEventListener('input', handleDelegatedInput);
}

function handleDelegatedClick(event) {
  const statusTarget = event.target.closest('[data-status]');
  if (statusTarget) {
    const [id, status] = statusTarget.getAttribute('data-status').split(':');
    updateQuestionState(id, {
      status,
      expanded: true,
      lastTouched: todayKey(),
    });
    return;
  }

  const toggleTarget = event.target.closest('[data-toggle]');
  if (toggleTarget) {
    const id = toggleTarget.getAttribute('data-toggle');
    updateQuestionState(id, {
      expanded: !getQuestionState(id).expanded,
    });
    return;
  }

  const attemptTarget = event.target.closest('[data-attempt]');
  if (attemptTarget) {
    const id = attemptTarget.getAttribute('data-attempt');
    const current = getQuestionState(id);
    updateQuestionState(id, {
      attempts: current.attempts + 1,
      lastTouched: todayKey(),
      expanded: true,
      status: current.status === 'not-started' ? 'in-progress' : current.status,
    });
    return;
  }

  const jumpTarget = event.target.closest('[data-jump]');
  if (jumpTarget) {
    const id = jumpTarget.getAttribute('data-jump');
    updateQuestionState(id, {
      expanded: true,
    });
    requestAnimationFrame(() => {
      document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

function handleDelegatedChange(event) {
  const confidenceTarget = event.target.closest('[data-confidence]');
  if (!confidenceTarget) return;
  const id = confidenceTarget.getAttribute('data-confidence');
  updateQuestionState(id, {
    confidence: Number(confidenceTarget.value) || 0,
    expanded: true,
    lastTouched: todayKey(),
  });
}

function handleDelegatedInput(event) {
  const notesTarget = event.target.closest('[data-notes]');
  if (!notesTarget) return;
  const id = notesTarget.getAttribute('data-notes');
  state = {
    ...state,
    [id]: {
      ...getQuestionState(id),
      notes: notesTarget.value,
      expanded: true,
    },
  };
  saveState();
}

function render() {
  const questions = getAllQuestions();
  const filters = getFilters();
  updateHeroLine(questions);
  renderStats(questions);
  renderDailySet(questions);
  renderTopicProgress(questions);
  renderBoard(questions, filters);
}

document.addEventListener('DOMContentLoaded', () => {
  populateTopicFilter();
  attachEventHandlers();
  render();
});
