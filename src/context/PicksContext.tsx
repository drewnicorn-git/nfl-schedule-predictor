import { createContext, useContext, type ReactNode } from 'react';
import type { ScheduleData } from '../data/types';
import { usePicks, type PicksState } from '../hooks/usePicks';

const PicksContext = createContext<PicksState | null>(null);

export function PicksProvider({
  schedule,
  children,
}: {
  schedule: ScheduleData;
  children: ReactNode;
}) {
  const picks = usePicks(schedule);
  return <PicksContext.Provider value={picks}>{children}</PicksContext.Provider>;
}

export function usePicksContext(): PicksState {
  const ctx = useContext(PicksContext);
  if (!ctx) throw new Error('usePicksContext must be used within PicksProvider');
  return ctx;
}
