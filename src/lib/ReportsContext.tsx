// Shared report data so a new report from Scan shows up on Home, Map, and Impact.
// Later, swap the useState for Firebase or Supabase so everyone sees the same reports.
import React, { createContext, useContext, useState } from 'react';
import { IssueType, Status } from '../constants/fmb';

export type Report = {
  id: number;
  type: IssueType;
  title: string;
  street: string;
  createdAt: number;
  votes: number;
  voted: boolean;
  status: Status;
  conf: number;
  latitude: number;
  longitude: number;
  note?: string;
  photoUri?: string;
};

type Ctx = {
  reports: Report[];
  toggleVote: (id: number) => void;
  addReport: (r: Omit<Report, 'id' | 'createdAt' | 'votes' | 'voted' | 'status'>) => number;
};

const ReportsContext = createContext<Ctx | null>(null);

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<Report[]>([]);

  const toggleVote = (id: number) =>
    setReports((rs) =>
      rs.map((r) => (r.id === id ? { ...r, voted: !r.voted, votes: r.votes + (r.voted ? -1 : 1) } : r))
    );

  const addReport: Ctx['addReport'] = (r) => {
    const id = Date.now();
    setReports((rs) => [{ ...r, id, createdAt: Date.now(), votes: 1, voted: true, status: 'open' }, ...rs]);
    return id;
  };

  return <ReportsContext.Provider value={{ reports, toggleVote, addReport }}>{children}</ReportsContext.Provider>;
}

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('useReports must be used inside ReportsProvider');
  return ctx;
}

export function timeAgo(ts: number) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days}d ago` : `${Math.round(days / 7)}w ago`;
}