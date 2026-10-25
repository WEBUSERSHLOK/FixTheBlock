// TownshipContext.tsx
// Lets each person type in their own township's email, since FixMyBlock works
// in any town. The email is saved on the phone, so it's only asked for once.
// Any screen can call sendReport(report): it asks for (or confirms) the email
// in a popup, then opens the filled-out email.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../constants/fmb';
import { Report, useReports } from './ReportsContext';
import { sendToTown } from './sendToTown';

const STORAGE_KEY = 'townshipEmail';

type Ctx = {
  townshipEmail: string;
  sendReport: (r: Report) => void; // ask for the email if needed, then send
  editEmail: () => void; // just change the saved email
};

const TownshipContext = createContext<Ctx | null>(null);

// A quick check that it looks like an email (something@something.something).
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function TownshipProvider({ children }: { children: React.ReactNode }) {
  const { setStatus } = useReports();
  const [townshipEmail, setTownshipEmail] = useState('');
  const [draft, setDraft] = useState(''); // what's typed in the popup
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Report | null>(null); // report waiting to be sent

  // Load the saved email when the app starts.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => saved && setTownshipEmail(saved))
      .catch(() => {});
  }, []);

  const openPopup = (r: Report | null) => {
    setPending(r);
    setDraft(townshipEmail);
    setOpen(true);
  };

  // "Save" or "Open email" in the popup: remember the email, then send if a
  // report is waiting.
  const confirm = async () => {
    const email = draft.trim();
    setTownshipEmail(email);
    AsyncStorage.setItem(STORAGE_KEY, email).catch(() => {});
    setOpen(false);
    if (pending) {
      const r = pending;
      setPending(null);
      await sendToTown(r, email, () => setStatus(r.id, 'reported'));
    }
  };

  return (
    <TownshipContext.Provider value={{ townshipEmail, sendReport: openPopup, editEmail: () => openPopup(null) }}>
      {children}

      {/* The popup that asks for the township's email */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.card}>
            <Text style={s.h1}>Your township's email</Text>
            <Text style={s.body}>
              Reports go to your local public works or road department. You can usually find their email on your
              township's website. We'll remember it for next time.
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="publicworks@yourtownship.gov"
              placeholderTextColor="#7A828A"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
            />
            {draft.length > 0 && !looksLikeEmail(draft) && <Text style={s.error}>That doesn't look like an email yet.</Text>}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={s.secondary} onPress={() => setOpen(false)}>
                <Text style={s.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.primary, !looksLikeEmail(draft) && { opacity: 0.5 }]}
                disabled={!looksLikeEmail(draft)}
                onPress={confirm}
              >
                <Text style={s.primaryText}>{pending ? 'Open email' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 20, fontWeight: '800', color: C.ink },
  body: { fontSize: 14, lineHeight: 20, color: C.muted },
  input: { height: 48, borderWidth: 1, borderColor: '#CDD1C9', borderRadius: 12, paddingHorizontal: 12, fontSize: 15, color: C.ink, backgroundColor: '#FAFBF8' },
  error: { fontSize: 13, color: C.orangeText },
  primary: { flex: 1, height: 48, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { height: 48, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#CDD1C9', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: C.ink, fontSize: 16, fontWeight: '700' },
});