// TownshipContext.tsx
// Each person sets their town (and their township's email). The town decides
// which reports they can see: the database only shows reports from the same
// town, so reports stay within the community they're about. The township's
// email is used when sending a report or the monthly summary.
// Everything is saved on the phone, so it's only asked for once.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../constants/fmb';
import { Report, useReports } from './ReportsContext';
import { sendToTown } from './sendToTown';
import { supabase } from './supabase';

const STORAGE_KEY = 'township';

type Township = { town: string; state: string; email: string };

type Ctx = Township & {
  hasTown: boolean; // true once a town and state are set
  sendReport: (r: Report) => void; // ask for the email if needed, then send
  editTownship: () => void; // open the popup to change town or email
  editEmail: () => void; // same popup (kept so older screens still work)
};

const TownshipContext = createContext<Ctx | null>(null);

// Quick format checks.
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const looksLikeState = (s: string) => /^[A-Za-z]{2}$/.test(s.trim());

export function TownshipProvider({ children }: { children: React.ReactNode }) {
  const { userId, refresh, setStatus } = useReports();
  const [saved, setSaved] = useState<Township>({ town: '', state: '', email: '' });
  const [draft, setDraft] = useState<Township>({ town: '', state: '', email: '' }); // what's typed in the popup
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Report | null>(null); // report waiting to be sent
  const [saving, setSaving] = useState(false);

  const hasTown = saved.town.trim().length > 0 && looksLikeState(saved.state);

  // Load what was saved on this phone when the app starts.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setSaved({ town: '', state: '', email: '', ...JSON.parse(raw) }))
      .catch(() => {});
  }, []);

  // Tell the database which town this person is in, then reload so they see
  // that town's reports. Runs after sign-in and whenever the town changes.
  useEffect(() => {
    if (!userId || !hasTown) return;
    supabase
      .from('profiles')
      .upsert({ user_id: userId, town: saved.town.trim(), state: saved.state.trim().toUpperCase() })
      .then(() => refresh());
  }, [userId, saved.town, saved.state, hasTown, refresh]);

  const openPopup = (r: Report | null) => {
    setPending(r);
    setDraft(saved);
    setOpen(true);
  };

  // Town and state are always required. The email is only required when
  // sending a report (it's optional if they're just setting their town).
  const needEmail = !!pending;
  const valid =
    draft.town.trim().length > 0 &&
    looksLikeState(draft.state) &&
    (needEmail ? looksLikeEmail(draft.email) : draft.email.trim() === '' || looksLikeEmail(draft.email));

  // "Save" or "Open email": remember everything, then send if a report is waiting.
  const confirm = async () => {
    const next = { town: draft.town.trim(), state: draft.state.trim().toUpperCase(), email: draft.email.trim() };
    setSaving(true);
    setSaved(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    setSaving(false);
    setOpen(false);
    if (pending) {
      const r = pending;
      setPending(null);
      await sendToTown(r, next.email, () => setStatus(r.id, 'reported'));
    }
  };

  // Sending needs an email. If it's already saved, skip straight to the popup
  // with everything filled in, so they can confirm or fix it.
  const sendReport = (r: Report) => openPopup(r);

  return (
    <TownshipContext.Provider
      value={{ ...saved, hasTown, sendReport, editTownship: () => openPopup(null), editEmail: () => openPopup(null) }}
    >
      {children}

      {/* The popup for town, state, and township email */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
              <Text style={s.h1}>{pending ? 'Send to your township' : 'Your town'}</Text>
              <Text style={s.body}>
                You'll see reports from people in the same town, and they'll see yours. Reports from other towns stay
                private to them.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.label}>Town or township</Text>
                  <TextInput
                    value={draft.town}
                    onChangeText={(town) => setDraft((d) => ({ ...d, town }))}
                    placeholder="e.g. Springfield"
                    placeholderTextColor="#7A828A"
                    style={s.input}
                  />
                </View>
                <View style={{ width: 80, gap: 4 }}>
                  <Text style={s.label}>State</Text>
                  <TextInput
                    value={draft.state}
                    onChangeText={(state) => setDraft((d) => ({ ...d, state: state.toUpperCase() }))}
                    placeholder="PA"
                    placeholderTextColor="#7A828A"
                    maxLength={2}
                    autoCapitalize="characters"
                    style={s.input}
                  />
                </View>
              </View>

              <View style={{ gap: 4 }}>
                <Text style={s.label}>Township email {needEmail ? '' : '(optional for now)'}</Text>
                <TextInput
                  value={draft.email}
                  onChangeText={(email) => setDraft((d) => ({ ...d, email }))}
                  placeholder="publicworks@yourtownship.gov"
                  placeholderTextColor="#7A828A"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={s.input}
                />
                <Text style={s.hint}>Usually on your township's website, under public works or roads.</Text>
              </View>

              {draft.email.length > 0 && !looksLikeEmail(draft.email) && (
                <Text style={s.error}>That doesn't look like an email yet.</Text>
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={s.secondary} onPress={() => setOpen(false)}>
                  <Text style={s.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.primary, (!valid || saving) && { opacity: 0.5 }]} disabled={!valid || saving} onPress={confirm}>
                  <Text style={s.primaryText}>{pending ? 'Open email' : 'Save'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </TownshipContext.Provider>
  );
}

export function useTownship() {
  const ctx = useContext(TownshipContext);
  if (!ctx) throw new Error('useTownship must be used inside TownshipProvider');
  return ctx;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  center: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 20, fontWeight: '800', color: C.ink },
  body: { fontSize: 14, lineHeight: 20, color: C.muted },
  label: { fontSize: 13, fontWeight: '700', color: '#3F464D' },
  hint: { fontSize: 12, color: C.muted },
  input: { height: 48, borderWidth: 1, borderColor: '#CDD1C9', borderRadius: 12, paddingHorizontal: 12, fontSize: 15, color: C.ink, backgroundColor: '#FAFBF8' },
  error: { fontSize: 13, color: C.orangeText },
  primary: { flex: 1, height: 48, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { height: 48, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#CDD1C9', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: C.ink, fontSize: 16, fontWeight: '700' },
});