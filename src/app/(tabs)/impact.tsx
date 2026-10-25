// impact.tsx (Impact tab)
// Shows what the community has accomplished: problems fixed, reports by type,
// the township's email, and a monthly PDF summary for local government.

import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, ISSUE_TYPES, TYPE_LABELS } from '../../constants/fmb';
import { useReports } from '../../lib/ReportsContext';
import { useTownship } from '../../lib/TownshipContext';
import { emailSummary, monthLabel, shareSummary } from '../../lib/summary';

export default function Impact() {
  const { reports } = useReports();
  const [busy, setBusy] = useState(false); // true while the PDF is being made
  const { townshipEmail, editEmail } = useTownship();

  // How many problems have been fixed so far.
  const fixed = reports.filter((r) => r.status === 'fixed').length;
  // Counts reports for each issue type (skipping 'none'). max is the biggest
  // count, used to size the bars so the largest one fills the full width.
  const byType = ISSUE_TYPES.filter((t) => t !== 'none').map((t) => ({
    t,
    n: reports.filter((r) => r.type === t).length,
  }));
  const max = Math.max(1, ...byType.map((x) => x.n));

  // Open problems, most upvoted first. The top 3 are previewed on screen.
  const ranked = reports.filter((r) => r.status !== 'fixed').sort((a, b) => b.votes - a.votes);

  // Runs one of the summary actions, showing a loading state and catching errors.
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      Alert.alert("Couldn't create the summary", 'Please try again.');
    }
    setBusy(false);
  };

  // Email the PDF to the township. Asks for the email first if it isn't set,
  // and falls back to the share menu if email isn't available on this device.
  const onEmail = () => {
    if (!townshipEmail) return editEmail();
    run(async () => {
      const ok = await emailSummary(reports, townshipEmail);
      if (!ok) await shareSummary(reports);
    });
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View>
          <Text style={s.h1}>Community impact</Text>
          <Text style={s.sub}>What your neighborhood has reported so far.</Text>
        </View>

        {/* Green banner with the number of fixed problems */}
        <View style={s.hero}>
          <Text style={s.heroN}>{fixed}</Text>
          <Text style={s.heroText}>problems fixed out of {reports.length} reported by neighbors</Text>
        </View>

        <View style={s.card}>
          {/* Bar chart: one bar per issue type */}
          <Text style={s.h2}>Reports by type</Text>
          {byType.map(({ t, n }) => (
            <View key={t} style={{ gap: 4 }}>
              <View style={s.rowBetween}>
                <Text style={s.label}>{TYPE_LABELS[t]}</Text>
                <Text style={s.label}>{n}</Text>
              </View>
              <View style={s.track}>
                <View style={[s.bar, { width: `${Math.round((n / max) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>

        <View style={s.card}>
          {/* Where reports get emailed. Each person sets their own township. */}
          <Text style={s.h2}>Your township</Text>
          <Text style={s.sub}>{townshipEmail || 'No email set yet. You\'ll be asked the first time you send a report.'}</Text>
          <Pressable onPress={editEmail} style={[s.btn, { backgroundColor: C.blueSoft }]}>
            <Text style={[s.btnText, { color: C.blue }]}>{townshipEmail ? 'Change email' : 'Add email'}</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          {/* Monthly summary: a PDF of open problems, ranked by upvotes, for the
              township and the representative's office. */}
          <Text style={s.h2}>Monthly summary: {monthLabel()}</Text>
          <Text style={s.sub}>
            A one-page PDF of open problems, ranked by how many neighbors upvoted them, plus totals for the month.
          </Text>

          {/* Preview of the top issues that will lead the summary */}
          {ranked.length === 0 ? (
            <Text style={s.empty}>No open problems to include yet. Reports you post will show up here.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={s.label}>Top issues</Text>
              {ranked.slice(0, 3).map((r, i) => (
                <View key={r.id} style={s.previewRow}>
                  <Text style={s.rank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.previewTitle}>{TYPE_LABELS[r.type]}</Text>
                    <Text style={s.previewMeta} numberOfLines={1}>
                      {r.street}
                    </Text>
                  </View>
                  <Text style={s.previewVotes}>{r.votes} ▲</Text>
                </View>
              ))}
              {ranked.length > 3 && <Text style={s.previewMeta}>+ {ranked.length - 3} more in the PDF</Text>}
            </View>
          )}

          {Platform.OS !== 'web' && (
            <Pressable
              onPress={onEmail}
              disabled={busy || ranked.length === 0}
              style={[s.btn, (busy || ranked.length === 0) && { opacity: 0.5 }]}
            >
              <Text style={s.btnText}>{busy ? 'Creating PDF...' : 'Email PDF to township'}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => run(() => shareSummary(reports))}
            disabled={busy || ranked.length === 0}
            style={[s.btn, s.btnLight, (busy || ranked.length === 0) && { opacity: 0.5 }]}
          >
            <Text style={[s.btnText, { color: C.blue }]}>
              {Platform.OS === 'web' ? 'Print or save as PDF' : 'Share PDF (save, text, or email anyone)'}
            </Text>
          </Pressable>

          {/* Representatives usually take messages through a contact form, so
              this links to the official site for finding yours. */}
          <Pressable onPress={() => Linking.openURL('https://www.house.gov/representatives/find-your-representative')}>
            <Text style={s.link}>Find your U.S. Representative to share it with their office</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles for this screen
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ground },
  content: { padding: 20, gap: 16, paddingBottom: 120 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  h2: { fontSize: 16, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, lineHeight: 20, marginTop: 2 },
  hero: { backgroundColor: C.green, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroN: { color: '#fff', fontSize: 48, fontWeight: '800' },
  heroText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', lineHeight: 21 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '600', color: '#3F464D' },
  track: { height: 10, borderRadius: 5, backgroundColor: C.track, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5, backgroundColor: C.blue },
  btn: { height: 48, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  btnLight: { backgroundColor: C.blueSoft },
  link: { fontSize: 14, fontWeight: '700', color: C.blue, textAlign: 'center', paddingVertical: 6 },
  empty: { fontSize: 14, color: C.muted, fontStyle: 'italic' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  rank: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.blueSoft, color: C.blue, fontWeight: '800', textAlign: 'center', lineHeight: 24, overflow: 'hidden' },
  previewTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  previewMeta: { fontSize: 12, color: C.muted },
  previewVotes: { fontSize: 13, fontWeight: '800', color: C.blue },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});