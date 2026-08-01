import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../public/schedule-2026.json');
const SEASON = 2026;

const ABBR_MAP: Record<string, string> = {
  WSH: 'WAS',
  ARZ: 'ARI',
  JAX: 'JAC',
};

function normalizeAbbr(abbr: string): string {
  const upper = abbr.toUpperCase();
  return ABBR_MAP[upper] ?? upper;
}

interface EspnTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  color?: string;
}

interface EspnGroupTeam {
  id: string;
  abbreviation: string;
  displayName: string;
}

interface ScheduleData {
  season: number;
  teams: Array<{
    id: string;
    abbr: string;
    name: string;
    conference: 'AFC' | 'NFC';
    division: string;
    color: string;
  }>;
  games: Array<{
    id: string;
    week: number;
    date: string;
    homeTeamId: string;
    awayTeamId: string;
  }>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchTeamColors(): Promise<Map<string, string>> {
  const data = await fetchJson<{
    sports: Array<{
      leagues: Array<{ teams: Array<{ team: EspnTeam }> }>;
    }>;
  }>('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=32');

  const colors = new Map<string, string>();
  for (const entry of data.sports[0].leagues[0].teams) {
    const t = entry.team;
    colors.set(t.id, t.color ? `#${t.color}` : '#333333');
  }
  return colors;
}

async function fetchGroups(): Promise<
  Map<string, { conference: 'AFC' | 'NFC'; division: string; abbr: string; name: string }>
> {
  const data = await fetchJson<{
    groups: Array<{
      abbreviation: string;
      children: Array<{
        name: string;
        teams: EspnGroupTeam[];
      }>;
    }>;
  }>('https://site.api.espn.com/apis/site/v2/sports/football/nfl/groups');

  const map = new Map<
    string,
    { conference: 'AFC' | 'NFC'; division: string; abbr: string; name: string }
  >();

  for (const conf of data.groups) {
    const conference = conf.abbreviation as 'AFC' | 'NFC';
    for (const div of conf.children) {
      for (const team of div.teams) {
        map.set(team.id, {
          conference,
          division: div.name,
          abbr: normalizeAbbr(team.abbreviation),
          name: team.displayName,
        });
      }
    }
  }
  return map;
}

async function fetchWeek(week: number): Promise<
  Array<{
    id: string;
    week: number;
    date: string;
    homeTeamId: string;
    awayTeamId: string;
  }>
> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${SEASON}`;
  const data = await fetchJson<{
    events?: Array<{
      id: string;
      date: string;
      week?: { number: number };
      competitions?: Array<{
        competitors: Array<{ homeAway: string; team: { id: string } }>;
      }>;
    }>;
  }>(url);

  const games: Array<{
    id: string;
    week: number;
    date: string;
    homeTeamId: string;
    awayTeamId: string;
  }> = [];

  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors.find((c) => c.homeAway === 'home');
    const away = comp.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;
    games.push({
      id: event.id,
      week: event.week?.number ?? week,
      date: event.date,
      homeTeamId: home.team.id,
      awayTeamId: away.team.id,
    });
  }
  return games;
}

async function main() {
  console.log('Fetching team metadata...');
  const [groupMap, colors] = await Promise.all([fetchGroups(), fetchTeamColors()]);

  console.log('Fetching schedule weeks 1-18...');
  const allGames: ScheduleData['games'] = [];
  const gameIds = new Set<string>();

  for (let week = 1; week <= 18; week++) {
    const games = await fetchWeek(week);
    for (const g of games) {
      if (!gameIds.has(g.id)) {
        gameIds.add(g.id);
        allGames.push(g);
      }
    }
    console.log(`  Week ${week}: ${games.length} games`);
  }

  allGames.sort((a, b) => a.week - b.week || a.date.localeCompare(b.date));

  const teams: ScheduleData['teams'] = [];
  for (const [id, info] of groupMap) {
    teams.push({
      id,
      abbr: info.abbr,
      name: info.name,
      conference: info.conference,
      division: info.division,
      color: colors.get(id) ?? '#333333',
    });
  }
  teams.sort((a, b) => a.conference.localeCompare(b.conference) || a.division.localeCompare(b.division) || a.name.localeCompare(b.name));

  const schedule: ScheduleData = { season: SEASON, teams, games: allGames };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(schedule, null, 2));

  console.log(`\nDone: ${teams.length} teams, ${allGames.length} games`);
  console.log(`Written to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
