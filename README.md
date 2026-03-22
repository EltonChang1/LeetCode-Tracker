# LeetCode Tracker Workspace

A friendly, gamified LeetCode practice setup for VS Code with daily GitHub workflow.

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
1. Open this folder in VS Code.
2. Initialize GitHub repo (if not done):
   - `git init`
   - `git remote add origin <your-repo-url>`
3. Run your first log command:
   - `npm run lc:add -- --id 1 --title "Two Sum" --difficulty easy --lang js --tags array,hash-table --time 15`
4. Check progress:
   - `npm run lc:today`
   - `npm run lc:mission`
   - `npm run lc:boss`
   - `npm run lc:league`
   - `npm run lc:raid`
   - `npm run lc:chest -- --open`
   - `npm run lc:dashboard`
   - `npm run lc:web` then open `http://localhost:4321`
5. Daily update to GitHub:
   - `npm run lc:push`
   - or custom message: `npm run lc:push -- "leetcode day 12"`

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

## Add Entry Command
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
