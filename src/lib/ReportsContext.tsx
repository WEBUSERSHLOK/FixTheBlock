// ReportsContext.tsx
// The app's shared data. Reports and upvotes live in the online database
// (see supabase.ts), so everyone in your town sees the same map. The database
// only sends reports from your own town (see TownshipContext). This
// file loads them, listens for live changes from other phones, and gives
// every screen functions to post, upvote, remove, and update reports.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IssueType, Status } from '../constants/fmb';
import { supabase } from './supabase';

// What one report looks like inside the app.
export type Report = {
  id: number;
  type: IssueType;
  title: string;
  street: string;
  createdAt: number;
  votes: number; // how many people upvoted it
  voted: boolean; // whether you upvoted it
  status: Status;
  conf: number; // how confident the AI was, 0 to 100
  latitude: number;
  longitude: number;
  located: boolean; // false if no location was shared, so there's no pin
  note?: string;
  photoUri?: string; // only on the phone that took it (photos aren't uploaded)
  mine?: boolean; // true if you posted it, so you can remove it
  prevStatus?: Status; // the status before the last change, so it can be undone
};

// How a report row is stored in the database (snake_case column names).
type Row = {
  id: number;
  author_id: string;
  type: IssueType;
  title: string;
  street: string;
  note: string | null;
  conf: number;
  latitude: number;
  longitude: number;
  located: boolean;
  status: Status;
  prev_status: Status | null;
  created_at: string;
};
type Vote = { report_id: number; user_id: string };

// What a screen passes in when posting a new report.
export type NewReport = Pick<Report, 'type' | 'title' | 'street' | 'conf' | 'latitude' | 'longitude' | 'located'> & {
  note?: string;
  photoUri?: string;
};

// Everything the screens can use from this file.
type Ctx = {
  reports: Report[];
  loading: boolean; // true until the first load finishes
  error: string | null; // a problem connecting, shown on Home
  toggleVote: (id: number) => void;
  addReport: (r: NewReport) => Promise<number | null>; // returns the new id, or null if it failed
  removeReport: (id: number) => void;
  setStatus: (id: number, status: Status) => void;
  refresh: () => Promise<void>;
  userId: string | null; // your anonymous id, once signed in
};

// A React Context is like a shared storage box. Any screen inside the
// provider below can read from it without passing data screen to screen.
const ReportsContext = createContext<Ctx | null>(null);

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Photos stay on the phone that took them, matched to reports by id.
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Downloads every report and upvote from the database.
  const refresh = useCallback(async () => {
    const [r, v] = await Promise.all([
      supabase.from('reports').select('*').order('created_at', { ascending: false }),
      supabase.from('votes').select('report_id, user_id'),
    ]);
    if (r.error || v.error) {
      setError("Can't reach the server right now. Check your internet connection.");
    } else {
      setRows(r.data as Row[]);
      setVotes(v.data as Vote[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  // When the app starts: sign in anonymously (or reuse the saved sign-in),
  // load everything, then listen for live changes from other phones.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      let uid = data.session?.user.id ?? null;
      if (!uid) {
        const res = await supabase.auth.signInAnonymously();
        uid = res.data.user?.id ?? null;
        if (res.error) {
          setError("Couldn't sign in to the community server.");
          setLoading(false);
          return;
        }
      }
      setUserId(uid);
      await refresh();

      // Whenever anyone adds, changes, or removes a report or upvote, reload.
      // A short wait groups several quick changes into one reload.
      const reloadSoon = () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(refresh, 300);
      };
      channel = supabase
        .channel('community')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, reloadSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, reloadSoon)
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Turns database rows into the Report shape the screens use: counts
  // upvotes, and marks which reports are yours and which you upvoted.
  const reports = useMemo<Report[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        street: row.street,
        note: row.note ?? undefined,
        conf: row.conf,
        latitude: row.latitude,
        longitude: row.longitude,
        located: row.located,
        status: row.status,
        prevStatus: row.prev_status ?? undefined,
        createdAt: Date.parse(row.created_at),
        votes: votes.filter((v) => v.report_id === row.id).length,
        voted: votes.some((v) => v.report_id === row.id && v.user_id === userId),
        mine: row.author_id === userId,
        photoUri: photos[row.id],
      })),
    [rows, votes, userId, photos]
  );

  // Upvote or un-upvote. The screen updates right away (so it feels instant),
  // then the database is updated. If that fails, it reloads the real data.
  const toggleVote = (id: number) => {
    if (!userId) return;
    const already = votes.some((v) => v.report_id === id && v.user_id === userId);
    setVotes((vs) =>
      already ? vs.filter((v) => !(v.report_id === id && v.user_id === userId)) : [...vs, { report_id: id, user_id: userId }]
    );
    const request = already
      ? supabase.from('votes').delete().eq('report_id', id).eq('user_id', userId)
      : supabase.from('votes').insert({ report_id: id });
    request.then(({ error: e }) => e && refresh());
  };

  // Posts a new report, then adds your own upvote to it.
  const addReport = async (r: NewReport) => {
    const { data, error: e } = await supabase
      .from('reports')
      .insert({
        type: r.type,
        title: r.title,
        street: r.street,
        note: r.note ?? null,
        conf: r.conf,
        latitude: r.latitude,
        longitude: r.longitude,
        located: r.located,
      })
      .select()
      .single();
    if (e || !data) return null;
    const row = data as Row;
    await supabase.from('votes').insert({ report_id: row.id });
    if (r.photoUri) setPhotos((p) => ({ ...p, [row.id]: r.photoUri! }));
    // Show it right away, without waiting for the live update.
    setRows((rs) => [row, ...rs.filter((x) => x.id !== row.id)]);
    if (userId) setVotes((vs) => [...vs, { report_id: row.id, user_id: userId }]);
    return row.id;
  };

  // Deletes a report (the database only allows this for your own reports).
  const removeReport = (id: number) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    supabase
      .from('reports')
      .delete()
      .eq('id', id)
      .then(({ error: e }) => e && refresh());
  };

  // Moves a report to a new stage, remembering the old one so it can be undone.
  const setStatus = (id: number, status: Status) => {
    const current = rows.find((r) => r.id === id);
    if (!current) return;
    const prev_status = current.status;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status, prev_status } : r)));
    supabase
      .from('reports')
      .update({ status, prev_status })
      .eq('id', id)
      .then(({ error: e }) => e && refresh());
  };

  return (
    <ReportsContext.Provider value={{ reports, loading, error, toggleVote, addReport, removeReport, setStatus, refresh, userId }}>
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