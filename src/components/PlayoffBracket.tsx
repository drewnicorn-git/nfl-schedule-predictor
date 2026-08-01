import type { BracketMatchup, BracketState, Team } from '../data/types';
import { roundLabel } from '../lib/playoffs';
import { usePicksContext } from '../context/PicksContext';

interface PlayoffBracketProps {
  bracket: BracketState;
}

export function PlayoffBracket({ bracket }: PlayoffBracketProps) {
  return (
    <div className="playoff-bracket">
      <h3>Playoff Bracket</h3>
      <div className="bracket-columns">
        <ConferenceBracket label="AFC" matchups={bracket.afc} />
        <ConferenceBracket label="NFC" matchups={bracket.nfc} />
      </div>
      <div className="super-bowl-section">
        <h4>Super Bowl</h4>
        <MatchupCard matchup={bracket.superBowl} />
      </div>
    </div>
  );
}

function ConferenceBracket({
  label,
  matchups,
}: {
  label: string;
  matchups: BracketMatchup[];
}) {
  const rounds = ['wc', 'div', 'conf'] as const;

  return (
    <div className="conf-bracket">
      <h4>{label}</h4>
      {rounds.map((round) => {
        const roundMatchups = matchups.filter((m) => m.round === round);
        if (roundMatchups.length === 0) return null;
        return (
          <div key={round} className="bracket-round">
            <h5>{roundLabel(round)}</h5>
            {roundMatchups.map((m) => (
              <MatchupCard key={m.slotId} matchup={m} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MatchupCard({ matchup }: { matchup: BracketMatchup }) {
  const { setBracketPick } = usePicksContext();

  if (!matchup.teamA && !matchup.teamB) {
    return (
      <div className="matchup-card empty">
        <span className="matchup-placeholder">TBD</span>
      </div>
    );
  }

  return (
    <div className="matchup-card">
      <MatchupTeam
        team={matchup.teamA}
        seed={matchup.seedA}
        selected={matchup.winnerId === matchup.teamA?.id}
        onClick={() =>
          matchup.teamA && setBracketPick(matchup.slotId, matchup.teamA.id)
        }
      />
      <span className="vs">vs</span>
      <MatchupTeam
        team={matchup.teamB}
        seed={matchup.seedB}
        selected={matchup.winnerId === matchup.teamB?.id}
        onClick={() =>
          matchup.teamB && setBracketPick(matchup.slotId, matchup.teamB.id)
        }
      />
    </div>
  );
}

function MatchupTeam({
  team,
  seed,
  selected,
  onClick,
}: {
  team: Team | null;
  seed?: number;
  selected: boolean;
  onClick: () => void;
}) {
  if (!team) {
    return <div className="matchup-team empty">TBD</div>;
  }

  return (
    <button
      type="button"
      className={`matchup-team ${selected ? 'selected' : ''}`}
      style={
        selected
          ? { backgroundColor: team.color, borderColor: team.color, color: '#fff' }
          : { borderColor: team.color, color: team.color }
      }
      onClick={onClick}
    >
      {seed !== undefined && <span className="seed">({seed})</span>}
      {team.abbr}
      {selected && ' ✓'}
    </button>
  );
}
