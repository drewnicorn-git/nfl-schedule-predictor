import { describe, expect, it } from 'vitest';
import type { BracketPicks, ConferenceStandings, StandingEntry, Team } from '../data/types';
import { buildBracket } from './playoffs';

function team(id: string, abbr: string): Team {
  return {
    id,
    abbr,
    name: abbr,
    conference: 'AFC',
    division: 'AFC East',
    color: '#000',
  };
}

function seedEntry(teamObj: Team, seed: number): StandingEntry {
  return {
    teamId: teamObj.id,
    team: teamObj,
    wins: 0,
    losses: 0,
    ties: 0,
    winPct: 0,
    divWins: 0,
    divLosses: 0,
    confWins: 0,
    confLosses: 0,
    rank: seed,
    isDivisionWinner: seed <= 4,
    seed,
  };
}

function afcSeeds(entries: StandingEntry[]): ConferenceStandings {
  return { conference: 'AFC', divisions: [], seeds: entries };
}

function emptyNfc(): ConferenceStandings {
  return { conference: 'NFC', divisions: [], seeds: [] };
}

describe('divisional reseeding', () => {
  it('pits the #1 seed against the lowest remaining wild-card winner', () => {
    const t1 = team('1', 'ONE');
    const t2 = team('2', 'TWO');
    const t3 = team('3', 'THREE');
    const t4 = team('4', 'FOUR');
    const t5 = team('5', 'FIVE');
    const t6 = team('6', 'SIX');
    const t7 = team('7', 'SEVEN');

    const seeds = [
      seedEntry(t1, 1),
      seedEntry(t2, 2),
      seedEntry(t3, 3),
      seedEntry(t4, 4),
      seedEntry(t5, 5),
      seedEntry(t6, 6),
      seedEntry(t7, 7),
    ];

    const picks: BracketPicks = {
      'afc-wc-2v7': '2',
      'afc-wc-3v6': '6',
      'afc-wc-4v5': '4',
    };

    const bracket = buildBracket(afcSeeds(seeds), emptyNfc(), picks);
    const div1 = bracket.afc.find((m) => m.slotId === 'afc-div-1vLow')!;
    const divOther = bracket.afc.find((m) => m.slotId === 'afc-div-other')!;

    expect(div1.teamA?.id).toBe('1');
    expect(div1.teamB?.id).toBe('6');
    expect(div1.seedB).toBe(6);

    expect(divOther.teamA?.id).toBe('2');
    expect(divOther.teamB?.id).toBe('4');
    expect(divOther.teamA?.id).not.toBe('1');
    expect(divOther.teamB?.id).not.toBe('1');
  });

  it('never matches the #1 seed against the #2 seed in the divisional round', () => {
    const teams = Array.from({ length: 7 }, (_, i) => team(String(i + 1), `T${i + 1}`));
    const seeds = teams.map((t, i) => seedEntry(t, i + 1));

    const picks: BracketPicks = {
      'afc-wc-2v7': '2',
      'afc-wc-3v6': '3',
      'afc-wc-4v5': '5',
    };

    const bracket = buildBracket(afcSeeds(seeds), emptyNfc(), picks);
    const div1 = bracket.afc.find((m) => m.slotId === 'afc-div-1vLow')!;
    const divOther = bracket.afc.find((m) => m.slotId === 'afc-div-other')!;

    expect(div1.teamB?.id).toBe('5');
    expect(divOther.teamA?.id).toBe('2');
    expect(divOther.teamB?.id).toBe('3');
  });
});
