import { describe, expect, it } from 'vitest';
import type { Game, SeasonPicks, Team } from '../data/types';
import { buildRecords, computeStandings } from './standings';
import {
  compareDivisionWinnersForSeed,
  createTiebreakContext,
  rankDivisionWinners,
  selectWildCardTeams,
} from './tiebreakers';

const teams: Team[] = [
  { id: '1', abbr: 'A', name: 'Team A', conference: 'AFC', division: 'AFC East', color: '#000' },
  { id: '2', abbr: 'B', name: 'Team B', conference: 'AFC', division: 'AFC East', color: '#111' },
  { id: '3', abbr: 'C', name: 'Team C', conference: 'AFC', division: 'AFC North', color: '#222' },
  { id: '4', abbr: 'D', name: 'Team D', conference: 'AFC', division: 'AFC North', color: '#333' },
  { id: '5', abbr: 'E', name: 'Team E', conference: 'AFC', division: 'AFC South', color: '#444' },
  { id: '6', abbr: 'F', name: 'Team F', conference: 'AFC', division: 'AFC South', color: '#555' },
  { id: '7', abbr: 'G', name: 'Team G', conference: 'AFC', division: 'AFC West', color: '#666' },
  { id: '8', abbr: 'H', name: 'Team H', conference: 'AFC', division: 'AFC West', color: '#777' },
];

function game(id: string, home: string, away: string, week = 1): Game {
  return { id, week, date: '2026-09-01', homeTeamId: home, awayTeamId: away };
}

function picks(entries: Array<[string, string]>): SeasonPicks {
  return Object.fromEntries(entries);
}

describe('NFL seeding rules', () => {
  it('seeds division winners 1-4 and wild cards 5-7 regardless of raw win pct', () => {
    const games: Game[] = [
      game('g1', '1', '2'),
      game('g2', '3', '4'),
      game('g3', '5', '6'),
      game('g4', '7', '8'),
      game('g5', '1', '3'),
      game('g6', '5', '7'),
      game('g7', '2', '4'),
      game('g8', '6', '8'),
    ];

    const seasonPicks = picks([
      ['g1', '1'],
      ['g2', '3'],
      ['g3', '5'],
      ['g4', '8'],
      ['g5', '1'],
      ['g6', '5'],
      ['g7', '4'],
      ['g8', '6'],
    ]);

    const allTeams = [
      ...teams,
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `nfc-${i}`,
        abbr: `N${i}`,
        name: `NFC ${i}`,
        conference: 'NFC' as const,
        division: `NFC ${['East', 'North', 'South', 'West'][Math.floor(i / 6)]}`,
        color: '#999',
      })),
    ];

    const { afc } = computeStandings(allTeams, games, seasonPicks);

    const divisionWinnerSeeds = afc.seeds.filter((s) => s.isDivisionWinner).map((s) => s.seed);
    expect(divisionWinnerSeeds).toEqual([1, 2, 3, 4]);

    const wildCardSeeds = afc.seeds.filter((s) => !s.isDivisionWinner).map((s) => s.seed);
    expect(wildCardSeeds).toEqual([5, 6, 7]);
  });

  it('allows a wild-card team with a better record than a division winner to remain seed 5+', () => {
    const games: Game[] = [
      game('g1', '1', '2'),
      game('g2', '3', '4'),
      game('g3', '1', '3'),
      game('g4', '2', '4'),
    ];

    const seasonPicks = picks([
      ['g1', '1'],
      ['g2', '4'],
      ['g3', '1'],
      ['g4', '2'],
    ]);

    const subset = teams.slice(0, 4);
    const records = buildRecords(subset, games, seasonPicks);
    const ctx = createTiebreakContext(subset, games, seasonPicks, records);

    expect(records.get('2')!.winPct).toBeGreaterThan(records.get('3')!.winPct);

    const divisionWinners = rankDivisionWinners(['1', '4'], ctx);
    expect(divisionWinners[0]).toBe('1');
    expect(divisionWinners[1]).toBe('4');

    const wildCards = selectWildCardTeams(['2', '3'], 1, ctx);
    expect(wildCards[0]).toBe('2');
  });

  it('ranks division teams by win percentage in the standings overview', () => {
    const games: Game[] = [
      game('g1', '1', '2'),
      game('g2', '3', '4'),
      game('g3', '1', '3'),
      game('g4', '2', '4'),
    ];

    const seasonPicks = picks([
      ['g1', '1'],
      ['g2', '3'],
      ['g3', '1'],
      ['g4', '2'],
    ]);

    const subset = teams.slice(0, 4);
    const { afc } = computeStandings(
      [
        ...subset,
        ...teams.slice(4),
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `nfc-${i}`,
          abbr: `N${i}`,
          name: `NFC ${i}`,
          conference: 'NFC' as const,
          division: `NFC ${['East', 'North', 'South', 'West'][Math.floor(i / 6)]}`,
          color: '#999',
        })),
      ],
      games,
      seasonPicks,
    );

    const east = afc.divisions.find((d) => d.division === 'AFC East')!;
    expect(east.teams.map((t) => t.team.abbr)).toEqual(['A', 'B']);
    expect(east.teams[0].winPct).toBeGreaterThan(east.teams[1].winPct);

    const north = afc.divisions.find((d) => d.division === 'AFC North')!;
    expect(north.teams.map((t) => t.team.abbr)).toEqual(['C', 'D']);
    expect(north.teams[0].winPct).toBeGreaterThan(north.teams[1].winPct);
  });

  it('breaks division ties by head-to-head before conference record', () => {
    const games: Game[] = [
      game('g1', '1', '2'),
      game('g2', '1', '3'),
      game('g3', '2', '3'),
    ];

    const seasonPicks = picks([
      ['g1', '1'],
      ['g2', '3'],
      ['g3', '2'],
    ]);

    const subset = teams.slice(0, 3);
    const records = buildRecords(subset, games, seasonPicks);
    const ctx = createTiebreakContext(subset, games, seasonPicks, records);

    expect(compareDivisionWinnersForSeed('1', '2', ctx)).toBeLessThan(0);
  });
});
