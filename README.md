# LeetCode Tracker Workspace

A friendly, gamified LeetCode practice setup for VS Code with daily GitHub workflow.

## What This Repo Is

This repo is a local LeetCode/DSA practice system with two main parts:
- a Node.js CLI for logging solved problems and updating progress data
- a lightweight web dashboard for streaks, missions, rewards, leagues, raids, and DSA practice

It is designed to make daily problem solving easier to sustain, not just to store solutions.

## Requirements

- Node.js 18+ and npm
- Git
- A GitHub repo connected as `origin` if you want to use the daily push workflow
- Optional: a public LeetCode profile if you want to use profile sync

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/EltonChang1/LeetCode-Tracker.git
cd LeetCode-Tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Optional: connect your own GitHub repo

If you are using this as your own tracker, point `origin` to your repo:

```bash
git remote remove origin
git remote add origin <your-repo-url>
```

## Features
- ✅ Log solved problems from terminal with one command
- 🔥 Auto-calculate your daily streak and longest streak
- 🛡️ Streak shield: 1 miss allowed per 14 days
- ⭐ XP + level system based on difficulty
- 🏅 Achievement badges to keep momentum
- 👹 Weekly boss fights with rotating themes
- 🏆 Reward tiers: Bronze → Silver → Gold → Diamond
- 🏟️ Seasonal leagues with tier ladders
- 📈 ELO-style rank progression (Iron → Grandmaster)
- 🛡️ Weekly raid boss mode with solo-simulated teammate squad
- 🎁 Daily loot chest with persistent wallet
- ✨ Win streak multiplier with configurable intensity
- 🍀 Lucky Streak Weekend event (temporary rarity + multiplier cap boosts)
- ⚡ Midweek Momentum event (Tue–Thu combo bonus boosts raid damage)
- 🎯 Daily mission with low-friction start prompt
- 📈 Weekly consistency score (0-100)
- 📊 Auto-generated dashboard (`DASHBOARD.md`)
- 🌐 Game-style web dashboard (`web/index.html`)
- 🚀 One-command daily commit + push workflow

## Quick Start
1. Open this folder in VS Code or your terminal.
2. Install packages with `npm install`.
3. Run your first log command:
   - `npm run lc:add -- --id 1 --title "Two Sum" --difficulty easy --lang js --tags array,hash-table --time 15`
4. Regenerate your dashboard:
   - `npm run lc:dashboard`
5. Start the web app:
   - `npm run lc:web`
   - then open `http://localhost:4321`
6. Push your daily update:
   - `npm run lc:push`
   - or custom message: `npm run lc:push -- "leetcode day 12"`

## How To Use

### Log a solved problem

```bash
npm run lc:add -- \
  --id 42 \
  --title "Trapping Rain Water" \
  --difficulty hard \
  --lang js \
  --tags array,two-pointers,stack \
  --time 35 \
  --url "https://leetcode.com/problems/trapping-rain-water/" \
  --notes "Two-pointer optimization"
```

This command updates your progress data and creates a dated solution file under `problems/YYYY/MM/DD/`.

### Check today’s progress

```bash
npm run lc:today
npm run lc:mission
```

Use these to see your current streak state and the low-friction daily mission prompt.

### View generated dashboard data

```bash
npm run lc:dashboard
```

This regenerates `DASHBOARD.md` from the JSON data in `progress/`.

### Run the local web dashboard

```bash
npm run lc:web
```

Open `http://localhost:4321` to use:
- the main gamified dashboard
- the DSA practice board
- recent progress and reward systems

### Enable web write-back mode

```bash
npm run lc:web:write
```

This starts the same local app with file write-back enabled for supported actions.

### Sync from your LeetCode profile

```bash
npm run lc:sync -- --username your_leetcode_name --limit 25
```

If recent history is hidden on your profile, try:

```bash
npm run lc:sync -- --username your_leetcode_name --limit 25 --bootstrap
```

### Push your daily activity to GitHub

```bash
npm run lc:push
```

Or with a custom commit message:

```bash
npm run lc:push -- "leetcode day 12"
```

## Daily Routine (5-minute flow)
1. Run `npm run lc:mission` and do only the tiny mission.
2. Solve at least one problem.
3. Log it using `npm run lc:add ...`.
4. Add your solution code in the generated file under `problems/YYYY/MM/DD/`.
5. Run `npm run lc:push`.

## Stickiness Strategy (Ethical)
- Lower activation energy: mission starts with a tiny first step.
- Reward consistency: streak, XP, level, and badges update quickly.
- Build identity proof: daily GitHub commits become visible consistency.
- No coercion: this app nudges behavior; it does not force people.
- Low-motivation fallback: open one problem and code for 2 minutes.

## Game Loop
1. Open game dashboard: `npm run lc:web`
2. Complete daily mission shown in dashboard.
3. Beat weekly boss milestones in `npm run lc:boss`.
4. Track season and ELO progress in `npm run lc:league`.
5. Push weekly raid damage in `npm run lc:raid`.
6. Open chest reward: `npm run lc:chest -- --open`.
7. Log solve with `npm run lc:add -- ...`
8. Watch streak shield, multiplier, chest wallet, achievements, boss tier, league rank, and raid progress update.
9. End session with `npm run lc:push`.

## Boss Configuration
- Boss catalog is stored in `progress/bosses.json`.
- One boss is selected each week automatically.
- Tiers are unlocked by solving counts and theme-based tag hits.

## League + Raid Configuration
- League tiers and season settings: `progress/leagues.json`
- Raid roster and weekly HP settings: `progress/raid-bosses.json`

## Rewards Configuration
- Intensity and chest tuning: `progress/rewards.json`
- Persistent wallet + daily claims: `progress/rewards-state.json`
- Weekend event controls are in `rewards.json > weekendEvent`
- Midweek raid combo event controls are in `rewards.json > midweekEvent`

## Web Write-Back API (Optional)
- The web dashboard can stay in simulation mode (default) or sync interactions to real files.
- Start with safe write API enabled: `npm run lc:web:write`.
- In dashboard, enter your username and click **Sync from LeetCode**.
- Enable **Sync Mode** toggle for interactive button actions writing to disk.
- Synced actions write to:
   - `progress/entries.json` (solve interactions)
   - `progress/rewards-state.json` (chest claims)
- Safety guards:
   - Writes are disabled unless `LCQ_ALLOW_WRITE=1`.
   - Payload size limit + strict schema validation on server.
   - Duplicate entry and duplicate daily chest claim checks.

## LeetCode Profile Sync
- `lc:sync` imports your recent **Accepted** submissions directly from LeetCode into `progress/entries.json`.
- Example: `npm run lc:sync -- --username your_leetcode_name --limit 25`
- Optional bootstrap mode: `npm run lc:sync -- --username your_leetcode_name --limit 25 --bootstrap`
- Difficulty/tags are resolved per problem; duplicates are skipped automatically.
- When recent submission history is hidden but profile counts are visible, bootstrap mode imports aggregate Easy/Medium/Hard counts as historical synthetic entries.
- This uses LeetCode's GraphQL endpoint (community/undocumented API surface), so schema/rate-limit behavior may change over time.

## Structure
- `progress/entries.json`: source of truth for your solved history
- `DASHBOARD.md`: generated progress board
- `problems/YYYY/MM/DD/`: auto-created solution files
- `scripts/track.js`: tracker CLI
- `scripts/push-daily.js`: daily commit/push helper
- `.vscode/tasks.json`: click-to-run tasks in VS Code

## Optional Motivation Ideas
- Set a minimum target: 1 problem/day.
- Reward yourself every 7-day streak.
- Alternate easy/medium/hard days.

Enjoy the grind and make consistency your superpower 💯
