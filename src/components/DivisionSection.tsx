import type { Game, Team } from '../data/types';
import { TeamSchedule } from './TeamSchedule';

interface DivisionSectionProps {
  division: string;
  teams: Team[];
  games: Game[];
  teamsById: Map<string, Team>;
}

export function DivisionSection({ division, teams, games, teamsById }: DivisionSectionProps) {
  return (
    <section className="division-section">
      <h3>{division}</h3>
      <div className="division-grid">
        {teams.map((team) => (
          <TeamSchedule key={team.id} team={team} games={games} teamsById={teamsById} />
        ))}
      </div>
    </section>
  );
}
