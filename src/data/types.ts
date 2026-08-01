export type Conference = 'AFC' | 'NFC';

export interface Team {
  id: string;
  abbr: string;
  name: string;
  conference: Conference;
  division: string;
  color: string;
}

export interface Game {
  id: string;
  week: number;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface ScheduleData {
  season: number;
  teams: Team[];
  games: Game[];
}

export type SeasonPicks = Record<string, string | null>;
export type BracketPicks = Record<string, string | null>;

export interface TeamRecord {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  divWins: number;
  divLosses: number;
  confWins: number;
  confLosses: number;
}

export interface StandingEntry extends TeamRecord {
  team: Team;
  rank: number;
  isDivisionWinner: boolean;
  seed: number | null;
}

export interface ConferenceStandings {
  conference: Conference;
  divisions: Array<{
    division: string;
    teams: StandingEntry[];
  }>;
  seeds: StandingEntry[];
}

export interface BracketMatchup {
  slotId: string;
  round: 'wc' | 'div' | 'conf' | 'sb';
  conference?: Conference;
  teamA: Team | null;
  teamB: Team | null;
  seedA?: number;
  seedB?: number;
  winnerId: string | null;
}

export interface BracketState {
  afc: BracketMatchup[];
  nfc: BracketMatchup[];
  superBowl: BracketMatchup;
}

export interface StoredPicks {
  seasonPicks: SeasonPicks;
  bracketPicks: BracketPicks;
  savedAt: string;
}
