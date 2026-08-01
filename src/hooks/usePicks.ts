import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BracketPicks, SeasonPicks, StoredPicks } from '../data/types';
import { buildBracket, getDownstreamSlots, sanitizeBracketPicks } from '../lib/playoffs';
import { computeStandings } from '../lib/standings';
import type { ScheduleData } from '../data/types';

const STORAGE_KEY = 'nfl-predictor-2026';

function loadStored(): StoredPicks | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPicks;
  } catch {
    return null;
  }
}

export function usePicks(schedule: ScheduleData | null) {
  const [seasonPicks, setSeasonPicks] = useState<SeasonPicks>({});
  const [bracketPicks, setBracketPicks] = useState<BracketPicks>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      setSeasonPicks(stored.seasonPicks ?? {});
      setBracketPicks(stored.bracketPicks ?? {});
    }
  }, []);

  const standings = useMemo(() => {
    if (!schedule) return null;
    return computeStandings(schedule.teams, schedule.games, seasonPicks);
  }, [schedule, seasonPicks]);

  const bracket = useMemo(() => {
    if (!standings) return null;
    return buildBracket(standings.afc, standings.nfc, bracketPicks);
  }, [standings, bracketPicks]);

  const persist = useCallback((season: SeasonPicks, bracket: BracketPicks) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload: StoredPicks = {
        seasonPicks: season,
        bracketPicks: bracket,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 300);
  }, []);

  useEffect(() => {
    if (!standings) return;
    setBracketPicks((prev) => {
      const tempBracket = buildBracket(standings.afc, standings.nfc, prev);
      const sanitized = sanitizeBracketPicks(tempBracket, prev);
      if (JSON.stringify(sanitized) === JSON.stringify(prev)) return prev;
      persist(seasonPicks, sanitized);
      return sanitized;
    });
  }, [standings, seasonPicks, persist]);

  const setSeasonPick = useCallback(
    (gameId: string, winnerId: string | null) => {
      setSeasonPicks((prev) => {
        const current = prev[gameId];
        const next = { ...prev, [gameId]: current === winnerId ? null : winnerId };
        persist(next, bracketPicks);
        return next;
      });
    },
    [bracketPicks, persist],
  );

  const setBracketPick = useCallback(
    (slotId: string, winnerId: string | null) => {
      setBracketPicks((prev) => {
        const current = prev[slotId];
        const newWinner = current === winnerId ? null : winnerId;
        const next = { ...prev, [slotId]: newWinner };

        for (const downstream of getDownstreamSlots(slotId)) {
          delete next[downstream];
        }

        if (schedule && standings) {
          const tempBracket = buildBracket(standings.afc, standings.nfc, next);
          const sanitized = sanitizeBracketPicks(tempBracket, next);
          persist(seasonPicks, sanitized);
          return sanitized;
        }

        persist(seasonPicks, next);
        return next;
      });
    },
    [schedule, standings, seasonPicks, persist],
  );

  const clearAll = useCallback(() => {
    setSeasonPicks({});
    setBracketPicks({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const pickedCount = useMemo(() => {
    if (!schedule) return 0;
    return schedule.games.filter((g) => seasonPicks[g.id]).length;
  }, [schedule, seasonPicks]);

  return {
    seasonPicks,
    bracketPicks,
    standings,
    bracket,
    setSeasonPick,
    setBracketPick,
    clearAll,
    pickedCount,
  };
}

export type PicksState = ReturnType<typeof usePicks>;
