// ReportsContext.tsx
// The app's shared data. Every report lives here, so a report sent from the
// Scan tab instantly shows up on Home, Map, and Impact.

import React, { createContext, useContext, useState } from 'react';
import { IssueType, Status } from '../constants/fmb';

// What one report looks like. Every report in the app has these fields.
export type Report = {
  id: number;
  type: IssueType;
  title: string;
  street: string;
  createdAt: number;
  votes: number;
  voted: boolean;
  status: Status;
  conf: number; // how confident the AI was, 0 to 100
  latitude: number;
  longitude: number;
  located: boolean; // false if the person didn't share a location, so there's no pin
  note?: string;
  photoUri?: string;
  mine?: boolean;
  prevStatus?: Status; // the status before the last change, so it can be undone // true if this person made the report, so they can remove it
};

// Everything the screens can use from this file: the list of reports,
// plus functions to upvote, add, remove, and change a report's status.
type Ctx = {
  reports: Report[];
  toggleVote: (id: number) => void;
  addReport: (r: Omit<Report, 'id' | 'createdAt' | 'votes' | 'voted' | 'status' | 'mine'>) => number;
  removeReport: (id: number) => void;
  setStatus: (id: number, status: Status) => void;
};

// A React Context is like a shared storage box. Any screen inside the
// provider below can read from it without passing data screen to screen.
const ReportsContext = createContext<Ctx | null>(null);

// Wraps the whole app (see app/_layout.tsx) and holds the actual report list.
export function ReportsProvider({ children }: { children: React.ReactNode }) {
  // Reports start empty and live in memory, so they reset when the app restarts.
  // Later this can be swapped for a database like Supabase or Firebase so
  // everyone in the community sees the same reports.
  const [reports, setReports] = useState<Report[]>([]);

  // Upvote or un-upvote a report. Tapping again removes your vote.
  const toggleVote = (id: number) =>
    setReports((rs) =>
      rs.map((r) => (r.id === id ? { ...r, voted: !r.voted, votes: r.votes + (r.voted ? -1 : 1) } : r))
    );

  // Adds a new report to the top of the list and returns its id so the app
  // can jump to it on the map. New reports start as 'open' with your own upvote.
  const addReport: Ctx['addReport'] = (r) => {
    const id = Date.now();
    setReports((rs) => [{ ...r, id, createdAt: Date.now(), votes: 1, voted: true, status: 'open', mine: true }, ...rs]);
    return id;
  };

  // Deletes a report, for example if the AI picked the wrong issue type.
  const removeReport = (id: number) => setReports((rs) => rs.filter((r) => r.id !== id));

  // Moves a report to a new stage, like 'reported' after it's emailed to the
  // township, or 'fixed' once the problem is repaired.
  // Also remembers the old status in prevStatus, so a mistake can be undone.
  const setStatus = (id: number, status: Status) =>
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, prevStatus: r.status, status } : r)));

  return (
    <ReportsContext.Provider value={{ reports, toggleVote, addReport, removeReport, setStatus }}>
      {children}
    </ReportsContext.Provider>
  );
}

// Screens call useReports() to get the reports and functions above.
export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('useReports must be used inside ReportsProvider');
  return ctx;
}

// Turns a timestamp into something readable like "5m ago" or "2d ago".
export function timeAgo(ts: number) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days}d ago` : `${Math.round(days / 7)}w ago`;
}