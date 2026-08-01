import type {
  Conference,
  ConferenceStandings,
  Game,
  SeasonPicks,
  StandingEntry,
  Team,
  TeamRecord,
} from '../data/types';

function emptyRecord(teamId: string): TeamRecord {
  return {
    teamId,
    wins: 0,
    losses: 0,
    ties: 0,
    winPct: 0,
    divWins: 0,
    divLosses: 0,
    confWins: 0,
    confLosses: 0,
  };
}

function computeWinPct(w: number, l: number, t: number): number {
  const total = w + l + t;
  if (total === 0) return 0;
  return (w + t * 0.5) / total;
}

export function buildRecords(
  teams: Team[],
  games: Game[],
  picks: SeasonPicks,
): Map<string, TeamRecord> {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const records = new Map<string, TeamRecord>();
  for (const team of teams) records.set(team.id, emptyRecord(team.id));

  for (const game of games) {
    const winnerId = picks[game.id];
    if (!winnerId) continue;

    const home = teamMap.get(game.homeTeamId);
    const away = teamMap.get(game.awayTeamId);
    if (!home || !away) continue;

    const loserId = winnerId === home.id ? away.id : home.id;
    const winner = records.get(winnerId)!;
    const loser = records.get(loserId)!;

    winner.wins++;
    loser.losses++;

    if (home.conference === away.conference) {
      winner.confWins++;
      loser.confLosses++;
    }

    if (home.division === away.division) {
      winner.divWins++;
      loser.divLosses++;
    }
  }

  for (const rec of records.values()) {
    rec.winPct = computeWinPct(rec.wins, rec.losses, rec.ties);
  }
  return records;
}

function headToHeadWinPct(
  teamA: string,
  teamB: string,
  games: Game[],
  picks: SeasonPicks,
): number | null {
  let aWins = 0;
  let bWins = 0;
  let played = 0;

  for (const game of games) {
    const involves =
      (game.homeTeamId === teamA && game.awayTeamId === teamB) ||
      (game.homeTeamId === teamB && game.awayTeamId === teamA);
    if (!involves) continue;
    const winner = picks[game.id];
    if (!winner) continue;
    played++;
    if (winner === teamA) aWins++;
    else if (winner === teamB) bWins++;
  }

  if (played === 0) return null;
  if (aWins === bWins) return 0.5;
  return aWins > bWins ? 1 : 0;
}

function commonOpponentsWinPct(
  teamA: string,
  teamB: string,
  _teams: Team[],
  games: Game[],
  _picks: SeasonPicks,
  records: Map<string, TeamRecord>,
): number {
  const opponentsA = new Set<string>();
  const opponentsB = new Set<string>();

  for (const game of games) {
    if (game.homeTeamId === teamA) opponentsA.add(game.awayTeamId);
    if (game.awayTeamId === teamA) opponentsA.add(game.homeTeamId);
    if (game.homeTeamId === teamB) opponentsB.add(game.awayTeamId);
    if (game.awayTeamId === teamB) opponentsB.add(game.homeTeamId);
  }

  const common = [...opponentsA].filter((o) => opponentsB.has(o));
  if (common.length === 0) return 0;

  let totalPct = 0;
  for (const oppId of common) {
    const rec = records.get(oppId);
    if (rec) totalPct += rec.winPct;
  }
  return totalPct / common.length;
}

function compareTeams(
  a: TeamRecord,
  b: TeamRecord,
  teams: Team[],
  games: Game[],
  picks: SeasonPicks,
  records: Map<string, TeamRecord>,
  sameDivision: boolean,
): number {
  if (b.winPct !== a.winPct) return b.winPct - a.winPct;

  const h2h = headToHeadWinPct(a.teamId, b.teamId, games, picks);
  if (h2h !== null && h2h !== 0.5) return h2h === 1 ? -1 : 1;

  if (sameDivision) {
    const aDivPct = computeWinPct(a.divWins, a.divLosses, 0);
    const bDivPct = computeWinPct(b.divWins, b.divLosses, 0);
    if (bDivPct !== aDivPct) return bDivPct - aDivPct;
  }

  const aConfPct = computeWinPct(a.confWins, a.confLosses, 0);
  const bConfPct = computeWinPct(b.confWins, b.confLosses, 0);
  if (bConfPct !== aConfPct) return bConfPct - aConfPct;

  const aCommon = commonOpponentsWinPct(a.teamId, b.teamId, teams, games, picks, records);
  const bCommon = commonOpponentsWinPct(b.teamId, a.teamId, teams, games, picks, records);
  if (bCommon !== aCommon) return bCommon - aCommon;

  return a.teamId.localeCompare(b.teamId);
}

function sortDivisionTeams(
  divisionTeams: Team[],
  records: Map<string, TeamRecord>,
  teams: Team[],
  games: Game[],
  picks: SeasonPicks,
): StandingEntry[] {
  const sorted = [...divisionTeams].sort((ta, tb) => {
    const ra = records.get(ta.id)!;
    const rb = records.get(tb.id)!;
    return compareTeams(ra, rb, teams, games, picks, records, true);
  });

  return sorted.map((team, i) => {
    const rec = records.get(team.id)!;
    return {
      ...rec,
      team,
      rank: i + 1,
      isDivisionWinner: i === 0,
      seed: null,
    };
  });
}

export function computeStandings(
  teams: Team[],
  games: Game[],
  picks: SeasonPicks,
): { afc: ConferenceStandings; nfc: ConferenceStandings } {
  const records = buildRecords(teams, games, picks);

  function buildConference(conf: Conference): ConferenceStandings {
    const confTeams = teams.filter((t) => t.conference === conf);
    const divisions = [...new Set(confTeams.map((t) => t.division))].sort();

    const divisionStandings = divisions.map((division) => {
      const divTeams = confTeams.filter((t) => t.division === division);
      return {
        division,
        teams: sortDivisionTeams(divTeams, records, teams, games, picks),
      };
    });

    const divisionWinners = divisionStandings.map((d) => d.teams[0]);
    const wildCardCandidates = confTeams
      .filter((t) => !divisionWinners.some((w) => w.team.id === t.id))
      .map((t) => records.get(t.id)!)
      .sort((a, b) => compareTeams(a, b, teams, games, picks, records, false));

    const wildCards = wildCardCandidates.slice(0, 3).map((rec, i) => ({
      ...rec,
      team: teams.find((t) => t.id === rec.teamId)!,
      rank: i + 1,
      isDivisionWinner: false,
      seed: null as number | null,
    }));

    const allSeeds = [...divisionWinners, ...wildCards].sort((a, b) =>
      compareTeams(
        records.get(a.team.id)!,
        records.get(b.team.id)!,
        teams,
        games,
        picks,
        records,
        a.team.division === b.team.division,
      ),
    );

    const seeded = allSeeds.map((entry, i) => ({
      ...entry,
      seed: i + 1,
    }));

    for (const div of divisionStandings) {
      for (const t of div.teams) {
        const seedEntry = seeded.find((s) => s.team.id === t.team.id);
        t.seed = seedEntry?.seed ?? null;
        t.isDivisionWinner = seedEntry ? seedEntry.isDivisionWinner : t.rank === 1;
      }
    }

    return {
      conference: conf,
      divisions: divisionStandings,
      seeds: seeded,
    };
  }

  return {
    afc: buildConference('AFC'),
    nfc: buildConference('NFC'),
  };
}

export function countPickedGames(games: Game[], picks: SeasonPicks): number {
  return games.filter((g) => picks[g.id]).length;
}
