import type { ConferenceStandings, StandingEntry } from '../data/types';

interface StandingsPanelProps {
  afc: ConferenceStandings;
  nfc: ConferenceStandings;
}

export function StandingsPanel({ afc, nfc }: StandingsPanelProps) {
  return (
    <div className="standings-panel">
      <div className="standings-grid">
        <ConferenceStandingsTable standings={afc} />
        <ConferenceStandingsTable standings={nfc} />
      </div>

      <p className="tiebreaker-note" title="Simplified tiebreakers: win pct → head-to-head → division record → conference record → common opponents → fallback">
        Tiebreakers: win pct → H2H → div record → conf record → common opponents → fallback
      </p>
    </div>
  );
}

function ConferenceStandingsTable({ standings }: { standings: ConferenceStandings }) {
  return (
    <div className="conf-standings">
      <h3>{standings.conference}</h3>
      {standings.divisions.map((div) => (
        <div key={div.division} className="div-standings">
          <h4>{div.division.replace(`${standings.conference} `, '')}</h4>
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>Pct</th>
                <th>Seed</th>
              </tr>
            </thead>
            <tbody>
              {div.teams.map((entry) => (
                <StandingRow key={entry.team.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function StandingRow({ entry }: { entry: StandingEntry }) {
  const isPlayoff = entry.seed !== null && entry.seed <= 7;
  return (
    <tr className={isPlayoff ? 'playoff-team' : ''}>
      <td>
        <span className="team-dot" style={{ backgroundColor: entry.team.color }} />
        {entry.team.abbr}
        {entry.isDivisionWinner && entry.rank === 1 && <span className="div-champ">*</span>}
      </td>
      <td>{entry.wins}</td>
      <td>{entry.losses}</td>
      <td>{entry.winPct.toFixed(3).replace(/^0/, '')}</td>
      <td>{entry.seed ?? '—'}</td>
    </tr>
  );
}
