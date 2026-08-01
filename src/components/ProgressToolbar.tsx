interface ProgressToolbarProps {
  pickedCount: number;
  totalGames: number;
  onClearAll: () => void;
}

export function ProgressToolbar({ pickedCount, totalGames, onClearAll }: ProgressToolbarProps) {
  const pct = totalGames > 0 ? Math.round((pickedCount / totalGames) * 100) : 0;

  return (
    <div className="sticky-toolbar">
      <div className="progress">
        <span>
          {pickedCount}/{totalGames} games picked ({pct}%)
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button type="button" className="clear-btn" onClick={onClearAll}>
        Clear All
      </button>
    </div>
  );
}
