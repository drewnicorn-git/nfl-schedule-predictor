import { useMemo } from 'react';
import type { ScheduleData, Team } from './data/types';
import { PicksProvider, usePicksContext } from './context/PicksContext';
import { StandingsPanel } from './components/StandingsPanel';
import { ProgressToolbar } from './components/ProgressToolbar';
import { PlayoffBracket } from './components/PlayoffBracket';
import { DivisionSection } from './components/DivisionSection';
import scheduleData from '../public/schedule-2026.json';
import './index.css';

const schedule = scheduleData as ScheduleData;

function AppContent() {
  const { standings, bracket, pickedCount, clearAll } = usePicksContext();

  const teamsById = useMemo(
    () => new Map<string, Team>(schedule.teams.map((t) => [t.id, t])),
    [],
  );

  const divisionsByConf = useMemo(() => {
    const map = new Map<string, Map<string, Team[]>>();
    for (const team of schedule.teams) {
      if (!map.has(team.conference)) map.set(team.conference, new Map());
      const conf = map.get(team.conference)!;
      if (!conf.has(team.division)) conf.set(team.division, []);
      conf.get(team.division)!.push(team);
    }
    for (const conf of map.values()) {
      for (const teams of conf.values()) {
        teams.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    return map;
  }, []);

  if (!standings || !bracket) return null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>NFL 2026 Schedule Predictor</h1>
        <p>Pick winners on any team schedule — picks sync across both teams automatically.</p>
      </header>

      <ProgressToolbar
        pickedCount={pickedCount}
        totalGames={schedule.games.length}
        onClearAll={clearAll}
      />

      <div className="top-panel">
        <StandingsPanel afc={standings.afc} nfc={standings.nfc} />
        <PlayoffBracket bracket={bracket} />
      </div>

      <main className="schedules">
        {(['AFC', 'NFC'] as const).map((conf) => (
          <section key={conf} className="conference-section">
            <h2>{conf}</h2>
            {Array.from(divisionsByConf.get(conf)?.entries() ?? []).map(([division, teams]) => (
              <DivisionSection
                key={division}
                division={division}
                teams={teams}
                games={schedule.games}
                teamsById={teamsById}
              />
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <PicksProvider schedule={schedule}>
      <AppContent />
    </PicksProvider>
  );
}
