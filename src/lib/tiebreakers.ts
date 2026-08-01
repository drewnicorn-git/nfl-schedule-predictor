import type { Game, SeasonPicks, Team, TeamRecord } from '../data/types';

export interface WLT {
  wins: number;
  losses: number;
  ties: number;
}

export interface TiebreakContext {
  teamsById: Map<string, Team>;
  games: Game[];
  picks: SeasonPicks;
  records: Map<string, TeamRecord>;
}

export function winPct({ wins, losses, ties }: WLT): number {
  const total = wins + losses + ties;
  if (total === 0) return 0;
  return (wins + ties * 0.5) / total;
}

function comparePct(a: number, b: number): number {
  if (a !== b) return b > a ? 1 : -1;
  return 0;
}

function coinToss(a: string, b: string): number {
  return a.localeCompare(b);
}

function getOpponents(teamId: string, ctx: TiebreakContext): Set<string> {
  const opps = new Set<string>();
  for (const game of ctx.games) {
    if (game.homeTeamId === teamId) opps.add(game.awayTeamId);
    if (game.awayTeamId === teamId) opps.add(game.homeTeamId);
  }
  return opps;
}

function getDefeatedOpponents(teamId: string, ctx: TiebreakContext): Set<string> {
  const beaten = new Set<string>();
  for (const game of ctx.games) {
    const winner = ctx.picks[game.id];
    if (!winner) continue;
    if (winner !== teamId) continue;
    const opp = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
    beaten.add(opp);
  }
  return beaten;
}

function recordVsOpponents(
  teamId: string,
  opponents: Set<string>,
  ctx: TiebreakContext,
): WLT {
  const record: WLT = { wins: 0, losses: 0, ties: 0 };
  for (const game of ctx.games) {
    const winner = ctx.picks[game.id];
    if (!winner) continue;
    const involves =
      game.homeTeamId === teamId || game.awayTeamId === teamId;
    if (!involves) continue;
    const opp = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
    if (!opponents.has(opp)) continue;
    if (winner === teamId) record.wins++;
    else record.losses++;
  }
  return record;
}

function headToHeadRecord(
  teamId: string,
  opponents: string[],
  ctx: TiebreakContext,
): WLT {
  return recordVsOpponents(teamId, new Set(opponents), ctx);
}

function commonOpponents(teamIds: string[], ctx: TiebreakContext): Set<string> {
  if (teamIds.length === 0) return new Set();
  let common = getOpponents(teamIds[0], ctx);
  for (let i = 1; i < teamIds.length; i++) {
    const opps = getOpponents(teamIds[i], ctx);
    common = new Set([...common].filter((o) => opps.has(o)));
  }
  return common;
}

function commonGamesRecord(teamId: string, tiedIds: string[], ctx: TiebreakContext): WLT {
  const common = commonOpponents(tiedIds, ctx);
  return recordVsOpponents(teamId, common, ctx);
}

function commonGamesCount(record: WLT): number {
  return record.wins + record.losses + record.ties;
}

function strengthOfVictory(teamId: string, ctx: TiebreakContext): number {
  const defeated = getDefeatedOpponents(teamId, ctx);
  if (defeated.size === 0) return 0;
  let totalWins = 0;
  let totalGames = 0;
  for (const oppId of defeated) {
    const rec = ctx.records.get(oppId);
    if (!rec) continue;
    totalWins += rec.wins + rec.ties * 0.5;
    totalGames += rec.wins + rec.losses + rec.ties;
  }
  return totalGames === 0 ? 0 : totalWins / totalGames;
}

function strengthOfSchedule(teamId: string, ctx: TiebreakContext): number {
  const opps = getOpponents(teamId, ctx);
  if (opps.size === 0) return 0;
  let totalWins = 0;
  let totalGames = 0;
  for (const oppId of opps) {
    const rec = ctx.records.get(oppId);
    if (!rec) continue;
    totalWins += rec.wins + rec.ties * 0.5;
    totalGames += rec.wins + rec.losses + rec.ties;
  }
  return totalGames === 0 ? 0 : totalWins / totalGames;
}

function headToHeadSweepResult(
  teamIds: string[],
  ctx: TiebreakContext,
): { winner: string | null; eliminated: string | null } {
  for (const teamId of teamIds) {
    const others = teamIds.filter((id) => id !== teamId);
    let beatAll = true;
    let lostAll = true;
    let hasAny = false;

    for (const other of others) {
      const h2h = headToHeadRecord(teamId, [other], ctx);
      const played = h2h.wins + h2h.losses + h2h.ties;
      if (played === 0) continue;
      hasAny = true;
      if (h2h.wins <= h2h.losses) beatAll = false;
      if (h2h.wins >= h2h.losses) lostAll = false;
    }

    if (!hasAny) continue;
    if (beatAll) return { winner: teamId, eliminated: null };
    if (lostAll) return { winner: null, eliminated: teamId };
  }
  return { winner: null, eliminated: null };
}

type Criterion = {
  name: string;
  compare: (a: string, b: string, tied: string[], ctx: TiebreakContext) => number;
};

/** Division tiebreaker — two clubs (NFL steps 1–12; steps 7–11 require scores and are skipped). */
const DIVISION_TWO: Criterion[] = [
  {
    name: 'head-to-head',
    compare: (a, b, _tied, ctx) =>
      comparePct(
        winPct(headToHeadRecord(a, [b], ctx)),
        winPct(headToHeadRecord(b, [a], ctx)),
      ),
  },
  {
    name: 'division-record',
    compare: (a, b, _tied, ctx) => {
      const ra = ctx.records.get(a)!;
      const rb = ctx.records.get(b)!;
      return comparePct(
        winPct({ wins: ra.divWins, losses: ra.divLosses, ties: 0 }),
        winPct({ wins: rb.divWins, losses: rb.divLosses, ties: 0 }),
      );
    },
  },
  {
    name: 'common-games',
    compare: (a, b, tied, ctx) =>
      comparePct(
        winPct(commonGamesRecord(a, tied.length >= 2 ? tied : [a, b], ctx)),
        winPct(commonGamesRecord(b, tied.length >= 2 ? tied : [a, b], ctx)),
      ),
  },
  {
    name: 'conference-record',
    compare: (a, b, _tied, ctx) => {
      const ra = ctx.records.get(a)!;
      const rb = ctx.records.get(b)!;
      return comparePct(
        winPct({ wins: ra.confWins, losses: ra.confLosses, ties: 0 }),
        winPct({ wins: rb.confWins, losses: rb.confLosses, ties: 0 }),
      );
    },
  },
  {
    name: 'strength-of-victory',
    compare: (a, b, _tied, ctx) =>
      comparePct(strengthOfVictory(a, ctx), strengthOfVictory(b, ctx)),
  },
  {
    name: 'strength-of-schedule',
    compare: (a, b, _tied, ctx) =>
      comparePct(strengthOfSchedule(a, ctx), strengthOfSchedule(b, ctx)),
  },
];

/** Wild-card tiebreaker — two clubs from different divisions. */
const WILD_CARD_TWO: Criterion[] = [
  {
    name: 'head-to-head',
    compare: (a, b, _tied, ctx) => {
      const ha = headToHeadRecord(a, [b], ctx);
      const hb = headToHeadRecord(b, [a], ctx);
      if (ha.wins + ha.losses + ha.ties === 0) return 0;
      return comparePct(winPct(ha), winPct(hb));
    },
  },
  {
    name: 'conference-record',
    compare: (a, b, _tied, ctx) => {
      const ra = ctx.records.get(a)!;
      const rb = ctx.records.get(b)!;
      return comparePct(
        winPct({ wins: ra.confWins, losses: ra.confLosses, ties: 0 }),
        winPct({ wins: rb.confWins, losses: rb.confLosses, ties: 0 }),
      );
    },
  },
  {
    name: 'common-games-min-4',
    compare: (a, b, tied, ctx) => {
      const ra = commonGamesRecord(a, tied, ctx);
      const rb = commonGamesRecord(b, tied, ctx);
      if (commonGamesCount(ra) < 4 || commonGamesCount(rb) < 4) return 0;
      return comparePct(winPct(ra), winPct(rb));
    },
  },
  {
    name: 'strength-of-victory',
    compare: (a, b, _tied, ctx) =>
      comparePct(strengthOfVictory(a, ctx), strengthOfVictory(b, ctx)),
  },
  {
    name: 'strength-of-schedule',
    compare: (a, b, _tied, ctx) =>
      comparePct(strengthOfSchedule(a, ctx), strengthOfSchedule(b, ctx)),
  },
];

function applyCriteriaTwo(
  a: string,
  b: string,
  tied: string[],
  criteria: Criterion[],
  ctx: TiebreakContext,
): number {
  for (const c of criteria) {
    const result = c.compare(a, b, tied, ctx);
    if (result !== 0) return result;
  }
  return coinToss(a, b);
}

export function compareDivisionTwo(
  a: string,
  b: string,
  ctx: TiebreakContext,
): number {
  return applyCriteriaTwo(a, b, [a, b], DIVISION_TWO, ctx);
}

export function compareWildCardTwo(
  a: string,
  b: string,
  ctx: TiebreakContext,
): number {
  const teamA = ctx.teamsById.get(a)!;
  const teamB = ctx.teamsById.get(b)!;
  if (teamA.division === teamB.division) {
    return compareDivisionTwo(a, b, ctx);
  }
  return applyCriteriaTwo(a, b, [a, b], WILD_CARD_TWO, ctx);
}

/** Division winners seeds 1–4: NFL uses wild-card tiebreakers for home-field priority. */
export function compareDivisionWinnersForSeed(
  a: string,
  b: string,
  ctx: TiebreakContext,
): number {
  const ra = ctx.records.get(a)!;
  const rb = ctx.records.get(b)!;
  const pctCmp = comparePct(ra.winPct, rb.winPct);
  if (pctCmp !== 0) return pctCmp;
  return applyCriteriaTwo(a, b, [a, b], WILD_CARD_TWO, ctx);
}

function pickOneByCriteria(
  teamIds: string[],
  criteria: Criterion[],
  ctx: TiebreakContext,
): string | null {
  if (teamIds.length <= 1) return teamIds[0] ?? null;

  for (const c of criteria) {
    const values = teamIds.map((id) => ({
      id,
      value: (() => {
        const others = teamIds.filter((x) => x !== id);
        if (others.length === 0) return 0;
        let best = 0;
        for (const other of others) {
          const cmp = c.compare(id, other, teamIds, ctx);
          if (cmp < 0) best++;
          else if (cmp > 0) best--;
        }
        return best;
      })(),
    }));

    const maxVal = Math.max(...values.map((v) => v.value));
    const minVal = Math.min(...values.map((v) => v.value));
    const best = values.filter((v) => v.value === maxVal);
    if (best.length === 1 && maxVal > minVal) return best[0].id;
  }
  return null;
}

function pickOneDivisionMulti(teamIds: string[], ctx: TiebreakContext): string {
  let remaining = [...teamIds];

  while (remaining.length > 1) {
    const multiCriteria: Criterion[] = [
      {
        name: 'head-to-head-multi',
        compare: (a, b, tied, c) =>
          comparePct(
            winPct(headToHeadRecord(a, tied.filter((x) => x !== a), c)),
            winPct(headToHeadRecord(b, tied.filter((x) => x !== b), c)),
          ),
      },
      ...DIVISION_TWO.slice(1),
    ];

    const winner = pickOneByCriteria(remaining, multiCriteria, ctx);
    if (winner) return winner;

    remaining.sort(coinToss);
    return remaining[0];
  }
  return remaining[0];
}

/** Rank teams within a division: win percentage first, then NFL division tiebreakers. */
export function rankDivisionTeams(teamIds: string[], ctx: TiebreakContext): string[] {
  const ranked: string[] = [];
  let remaining = [...teamIds];

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      ranked.push(remaining[0]);
      break;
    }

    const topPct = Math.max(...remaining.map((id) => ctx.records.get(id)!.winPct));
    const samePct = remaining.filter((id) => ctx.records.get(id)!.winPct === topPct);
    const rest = remaining.filter((id) => ctx.records.get(id)!.winPct !== topPct);

    if (samePct.length === 1) {
      ranked.push(samePct[0]);
      remaining = rest;
      continue;
    }

    const winner =
      samePct.length === 2
        ? applyCriteriaTwo(samePct[0], samePct[1], samePct, DIVISION_TWO, ctx) <= 0
          ? samePct[0]
          : samePct[1]
        : pickOneDivisionMulti(samePct, ctx);

    ranked.push(winner);
    remaining = [...rest, ...samePct.filter((id) => id !== winner)];
  }

  return ranked;
}

function highestPerDivision(teamIds: string[], ctx: TiebreakContext): string[] {
  const byDiv = new Map<string, string[]>();
  for (const id of teamIds) {
    const div = ctx.teamsById.get(id)!.division;
    if (!byDiv.has(div)) byDiv.set(div, []);
    byDiv.get(div)!.push(id);
  }
  const result: string[] = [];
  for (const ids of byDiv.values()) {
    result.push(rankDivisionTeams(ids, ctx)[0]);
  }
  return result;
}

function pickOneWildCardMulti(teamIds: string[], ctx: TiebreakContext): string {
  let remaining = [...teamIds];

  while (remaining.length > 1) {
    const allSameDiv =
      remaining.length > 0 &&
      remaining.every(
        (id) => ctx.teamsById.get(id)!.division === ctx.teamsById.get(remaining[0])!.division,
      );

    if (allSameDiv) {
      return pickOneDivisionMulti(remaining, ctx);
    }

    remaining = highestPerDivision(remaining, ctx);
    if (remaining.length === 1) return remaining[0];

    const sweep = headToHeadSweepResult(remaining, ctx);
    if (sweep.winner) return sweep.winner;
    if (sweep.eliminated) {
      remaining = remaining.filter((id) => id !== sweep.eliminated);
      continue;
    }

    const winner = pickOneByCriteria(remaining, WILD_CARD_TWO, ctx);
    if (winner) return winner;

    remaining.sort(coinToss);
    return remaining[0];
  }
  return remaining[0];
}

function pickNextWildCard(pool: string[], ctx: TiebreakContext): string {
  const topPct = Math.max(...pool.map((id) => ctx.records.get(id)!.winPct));
  const tier = pool.filter((id) => ctx.records.get(id)!.winPct === topPct);
  if (tier.length === 1) return tier[0];
  return pickOneWildCardMulti(tier, ctx);
}

/** Select the top N wild-card teams using NFL procedures. */
export function selectWildCardTeams(
  candidates: string[],
  count: number,
  ctx: TiebreakContext,
): string[] {
  const selected: string[] = [];
  let pool = [...candidates];

  while (selected.length < count && pool.length > 0) {
    const pick = pickNextWildCard(pool, ctx);
    selected.push(pick);
    pool = pool.filter((id) => id !== pick);
  }
  return selected;
}

/** Seed wild-card teams 5–7 among themselves. */
export function rankWildCardTeams(teamIds: string[], ctx: TiebreakContext): string[] {
  const ranked: string[] = [];
  let remaining = [...teamIds];

  while (remaining.length > 0) {
    if (remaining.length === 1) {
      ranked.push(remaining[0]);
      break;
    }

    const topPct = Math.max(...remaining.map((id) => ctx.records.get(id)!.winPct));
    const tier = remaining.filter((id) => ctx.records.get(id)!.winPct === topPct);
    const rest = remaining.filter((id) => !tier.includes(id));

    if (tier.length === 1) {
      ranked.push(tier[0]);
      remaining = rest;
      continue;
    }

    const sortedTier = [...tier].sort((a, b) => compareWildCardTwo(a, b, ctx));
    ranked.push(sortedTier[0]);
    remaining = [...rest, ...sortedTier.slice(1)];
  }

  return ranked;
}

/** Seed division winners 1–4 using wild-card tiebreakers (NFL rule). */
export function rankDivisionWinners(teamIds: string[], ctx: TiebreakContext): string[] {
  return [...teamIds].sort((a, b) => compareDivisionWinnersForSeed(a, b, ctx));
}

export function createTiebreakContext(
  teams: Team[],
  games: Game[],
  picks: SeasonPicks,
  records: Map<string, TeamRecord>,
): TiebreakContext {
  return {
    teamsById: new Map(teams.map((t) => [t.id, t])),
    games,
    picks,
    records,
  };
}
