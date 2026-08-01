# NFL 2026 Schedule Predictor

Pick winners for every 2026 NFL regular-season game and see projected division standings and playoff bracket update in real time. Picks sync bidirectionally — selecting a winner on one team's schedule automatically updates the opponent's schedule.

## Features

- Full 2026 NFL schedule (272 games, all 32 teams)
- Organized by conference and division on a single page
- Live division standings with playoff seeding
- Interactive playoff bracket through the Super Bowl
- Picks persisted in localStorage

## Setup

```bash
npm install
npm run fetch:schedule   # Pull latest schedule from ESPN
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run fetch:schedule` | Refresh schedule data from ESPN API |

## Data

Schedule data is fetched from ESPN's public API at build time and stored in `public/schedule-2026.json`. Re-run `fetch:schedule` when the schedule is updated.

## Tiebreakers

Standings use simplified tiebreakers: win percentage → head-to-head → division record → conference record → common opponents → deterministic fallback.
