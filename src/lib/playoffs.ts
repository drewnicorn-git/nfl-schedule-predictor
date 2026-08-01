import type {
  BracketMatchup,
  BracketPicks,
  BracketState,
  Conference,
  ConferenceStandings,
  StandingEntry,
  Team,
} from '../data/types';

function getSeedTeam(seeds: StandingEntry[], seed: number): Team | null {
  return seeds.find((s) => s.seed === seed)?.team ?? null;
}

function resolveWinner(
  slotId: string,
  teamA: Team | null,
  teamB: Team | null,
  picks: BracketPicks,
): string | null {
  const pick = picks[slotId];
  if (!pick) return null;
  if (teamA?.id === pick || teamB?.id === pick) return pick;
  return null;
}

function buildWildCard(
  conf: Conference,
  seeds: StandingEntry[],
  picks: BracketPicks,
): BracketMatchup[] {
  const matchups: Array<[number, number]> = [
    [2, 7],
    [3, 6],
    [4, 5],
  ];

  return matchups.map(([sA, sB]) => {
    const slotId = `${conf.toLowerCase()}-wc-${sA}v${sB}`;
    const teamA = getSeedTeam(seeds, sA);
    const teamB = getSeedTeam(seeds, sB);
    return {
      slotId,
      round: 'wc' as const,
      conference: conf,
      teamA,
      teamB,
      seedA: sA,
      seedB: sB,
      winnerId: resolveWinner(slotId, teamA, teamB, picks),
    };
  });
}

function getWcWinners(wc: BracketMatchup[]): Array<{ team: Team; seed: number }> {
  const winners: Array<{ team: Team; seed: number }> = [];
  for (const m of wc) {
    if (!m.winnerId) continue;
    const winner = m.teamA?.id === m.winnerId ? m.teamA : m.teamB;
    const seed = m.teamA?.id === m.winnerId ? m.seedA! : m.seedB!;
    if (winner) winners.push({ team: winner, seed });
  }
  return winners;
}

function buildDivisional(
  conf: Conference,
  seeds: StandingEntry[],
  wc: BracketMatchup[],
  picks: BracketPicks,
): BracketMatchup[] {
  const oneSeed = getSeedTeam(seeds, 1);
  const wcWinners = getWcWinners(wc).sort((a, b) => a.seed - b.seed);

  if (wcWinners.length === 0) {
    return [
      {
        slotId: `${conf.toLowerCase()}-div-1vLow`,
        round: 'div',
        conference: conf,
        teamA: oneSeed,
        teamB: null,
        seedA: 1,
        winnerId: null,
      },
      {
        slotId: `${conf.toLowerCase()}-div-other`,
        round: 'div',
        conference: conf,
        teamA: null,
        teamB: null,
        winnerId: null,
      },
    ];
  }

  const lowest = wcWinners[0];
  const others = wcWinners.slice(1);
  const div1Slot = `${conf.toLowerCase()}-div-1vLow`;
  const divOtherSlot = `${conf.toLowerCase()}-div-other`;

  const div1: BracketMatchup = {
    slotId: div1Slot,
    round: 'div',
    conference: conf,
    teamA: oneSeed,
    teamB: lowest.team,
    seedA: 1,
    seedB: lowest.seed,
    winnerId: resolveWinner(div1Slot, oneSeed, lowest.team, picks),
  };

  let teamA: Team | null = null;
  let teamB: Team | null = null;
  let seedA: number | undefined;
  let seedB: number | undefined;

  if (others.length >= 2) {
    teamA = others[0].team;
    teamB = others[1].team;
    seedA = others[0].seed;
    seedB = others[1].seed;
  } else if (others.length === 1) {
    teamA = others[0].team;
    seedA = others[0].seed;
  }

  const divOther: BracketMatchup = {
    slotId: divOtherSlot,
    round: 'div',
    conference: conf,
    teamA,
    teamB,
    seedA,
    seedB,
    winnerId: resolveWinner(divOtherSlot, teamA, teamB, picks),
  };

  return [div1, divOther];
}

function buildConference(
  conf: Conference,
  div: BracketMatchup[],
  picks: BracketPicks,
): BracketMatchup {
  const slotId = `${conf.toLowerCase()}-conf`;
  const teamA = div[0].winnerId
    ? div[0].teamA?.id === div[0].winnerId
      ? div[0].teamA
      : div[0].teamB
    : null;
  const teamB = div[1].winnerId
    ? div[1].teamA?.id === div[1].winnerId
      ? div[1].teamA
      : div[1].teamB
    : null;

  return {
    slotId,
    round: 'conf',
    conference: conf,
    teamA,
    teamB,
    winnerId: resolveWinner(slotId, teamA, teamB, picks),
  };
}

export function buildBracket(
  afcStandings: ConferenceStandings,
  nfcStandings: ConferenceStandings,
  picks: BracketPicks,
): BracketState {
  const afcWc = buildWildCard('AFC', afcStandings.seeds, picks);
  const nfcWc = buildWildCard('NFC', nfcStandings.seeds, picks);

  const afcDiv = buildDivisional('AFC', afcStandings.seeds, afcWc, picks);
  const nfcDiv = buildDivisional('NFC', nfcStandings.seeds, nfcWc, picks);

  const afcConf = buildConference('AFC', afcDiv, picks);
  const nfcConf = buildConference('NFC', nfcDiv, picks);

  const sbSlot = 'super-bowl';
  const teamA = afcConf.winnerId
    ? afcConf.teamA?.id === afcConf.winnerId
      ? afcConf.teamA
      : afcConf.teamB
    : null;
  const teamB = nfcConf.winnerId
    ? nfcConf.teamA?.id === nfcConf.winnerId
      ? nfcConf.teamA
      : nfcConf.teamB
    : null;

  const superBowl: BracketMatchup = {
    slotId: sbSlot,
    round: 'sb',
    teamA,
    teamB,
    winnerId: resolveWinner(sbSlot, teamA, teamB, picks),
  };

  return { afc: [...afcWc, ...afcDiv, afcConf], nfc: [...nfcWc, ...nfcDiv, nfcConf], superBowl };
}

export function getDownstreamSlots(slotId: string): string[] {
  const conf = slotId.startsWith('afc') ? 'afc' : slotId.startsWith('nfc') ? 'nfc' : null;

  if (slotId.includes('-wc-')) {
    return conf ? [`${conf}-div-1vLow`, `${conf}-div-other`, `${conf}-conf`, 'super-bowl'] : [];
  }
  if (slotId.includes('-div-')) {
    return conf ? [`${conf}-conf`, 'super-bowl'] : [];
  }
  if (slotId.endsWith('-conf')) {
    return ['super-bowl'];
  }
  return [];
}

export function sanitizeBracketPicks(
  bracket: BracketState,
  picks: BracketPicks,
): BracketPicks {
  const allMatchups = [...bracket.afc, ...bracket.nfc, bracket.superBowl];
  const valid: BracketPicks = {};

  for (const m of allMatchups) {
    const pick = picks[m.slotId];
    if (pick && (m.teamA?.id === pick || m.teamB?.id === pick)) {
      valid[m.slotId] = pick;
    }
  }
  return valid;
}

export function roundLabel(round: BracketMatchup['round']): string {
  switch (round) {
    case 'wc':
      return 'Wild Card';
    case 'div':
      return 'Divisional';
    case 'conf':
      return 'Conference';
    case 'sb':
      return 'Super Bowl';
  }
}
