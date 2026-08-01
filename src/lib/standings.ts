import type {
  Conference,
  ConferenceStandings,
  Game,
  SeasonPicks,
  StandingEntry,
  Team,
  TeamRecord,
} from '../data/types';
import {
  createTiebreakContext,
  rankDivisionTeams,
  rankDivisionWinners,
  rankWildCardTeams,
  selectWildCardTeams,
} from './tiebreakers';

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

function toStandingEntry(
  team: Team,
  records: Map<string, TeamRecord>,
  rank: number,
  isDivisionWinner: boolean,
  seed: number | null,
): StandingEntry {
  const rec = records.get(team.id)!;
  return {
    ...rec,
    team,
    rank,
    isDivisionWinner,
    seed,
  };
}

function sortDivisionTeams(
  divisionTeams: Team[],
  records: Map<string, TeamRecord>,
  teams: Team[],
  games: Game[],
  picks: SeasonPicks,
): StandingEntry[] {
  const ctx = createTiebreakContext(teams, games, picks, records);
  const rankedIds = rankDivisionTeams(
    divisionTeams.map((t) => t.id),
    ctx,
  );

  return rankedIds.map((id, i) => {
    const team = divisionTeams.find((t) => t.id === id)!;
    return toStandingEntry(team, records, i + 1, i === 0, null);
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
    const ctx = createTiebreakContext(teams, games, picks, records);

    const divisionStandings = divisions.map((division) => {
      const divTeams = confTeams.filter((t) => t.division === division);
      return {
        division,
        teams: sortDivisionTeams(divTeams, records, teams, games, picks),
      };
    });

    const divisionWinnerIds = divisionStandings.map((d) => d.teams[0].team.id);

    const seededDivisionWinnerIds = rankDivisionWinners(divisionWinnerIds, ctx);
    const wildCardCandidateIds = confTeams
      .filter((t) => !divisionWinnerIds.includes(t.id))
      .map((t) => t.id);

    const wildCardIds = selectWildCardTeams(wildCardCandidateIds, 3, ctx);
    const seededWildCardIds = rankWildCardTeams(wildCardIds, ctx);

    const seedOrder = [...seededDivisionWinnerIds, ...seededWildCardIds];
    const seeds: StandingEntry[] = seedOrder.map((teamId, i) => {
      const isDivisionWinner = divisionWinnerIds.includes(teamId);
      const team = teams.find((t) => t.id === teamId)!;
      return toStandingEntry(team, records, i + 1, isDivisionWinner, i + 1);
    });

    for (const div of divisionStandings) {
      for (const entry of div.teams) {
        const seedEntry = seeds.find((s) => s.team.id === entry.team.id);
        entry.seed = seedEntry?.seed ?? null;
        entry.isDivisionWinner = divisionWinnerIds.includes(entry.team.id);
      }
    }

    return {
      conference: conf,
      divisions: divisionStandings,
      seeds,
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
