import type { Game, Team } from '../data/types';
import { usePicksContext } from '../context/PicksContext';

interface TeamScheduleProps {
  team: Team;
  games: Game[];
  teamsById: Map<string, Team>;
}

export function TeamSchedule({ team, games, teamsById }: TeamScheduleProps) {
  const { seasonPicks, setSeasonPick } = usePicksContext();

  const teamGames = games
    .filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id)
    .sort((a, b) => a.week - b.week);

  return (
    <div className="team-schedule">
      <div className="team-schedule-header" style={{ borderColor: team.color }}>
        <span className="team-abbr" style={{ backgroundColor: team.color }}>
          {team.abbr}
        </span>
        <span className="team-name">{team.name}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Wk</th>
            <th>Opp</th>
            <th>H/A</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {teamGames.map((game) => {
            const isHome = game.homeTeamId === team.id;
            const oppId = isHome ? game.awayTeamId : game.homeTeamId;
            const opponent = teamsById.get(oppId);
            if (!opponent) return null;

            const pick = seasonPicks[game.id];

            return (
              <tr key={game.id} className={pick ? 'picked' : ''}>
                <td>{game.week}</td>
                <td>{isHome ? opponent.abbr : `@ ${opponent.abbr}`}</td>
                <td>{isHome ? 'Home' : 'Away'}</td>
                <td className="pick-cell">
                  <PickButton
                    team={team}
                    selected={pick === team.id}
                    onClick={() => setSeasonPick(game.id, team.id)}
                  />
                  <PickButton
                    team={opponent}
                    selected={pick === opponent.id}
                    onClick={() => setSeasonPick(game.id, opponent.id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PickButton({
  team,
  selected,
  onClick,
}: {
  team: Team;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`pick-btn ${selected ? 'selected' : ''}`}
      style={
        selected
          ? { backgroundColor: team.color, borderColor: team.color, color: '#fff' }
          : { borderColor: team.color, color: team.color }
      }
      onClick={onClick}
      title={team.name}
    >
      {team.abbr}
      {selected && ' ✓'}
    </button>
  );
}
