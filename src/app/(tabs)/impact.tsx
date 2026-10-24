import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, ISSUE_TYPES, TYPE_LABELS } from '../../constants/fmb';
import { useReports } from '../../lib/ReportsContext';

export default function Impact() {
  const { reports } = useReports();
  const [summaryReady, setSummaryReady] = useState(false);

  const fixed = reports.filter((r) => r.status === 'fixed').length;
  const byType = ISSUE_TYPES.filter((t) => t !== 'none').map((t) => ({
    t,
    n: reports.filter((r) => r.type === t).length,
  }));
  const max = Math.max(1, ...byType.map((x) => x.n));

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View>
          <Text style={s.h1}>Community impact</Text>
          <Text style={s.sub}>What your neighborhood has reported so far.</Text>
        </View>

        <View style={s.hero}>
          <Text style={s.heroN}>{fixed}</Text>
          <Text style={s.heroText}>problems fixed out of {reports.length} reported by neighbors</Text>
        </View>

        <View style={s.card}>
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
          <Text style={s.h2}>Send a monthly summary</Text>
          <Text style={s.sub}>
            A one-page report of open issues, ranked by upvotes, for your township and your representative's office.
          </Text>
          {/* TODO: generate a PDF with expo-print and share it with expo-sharing */}
          <Pressable
            onPress={() => setSummaryReady(true)}
            style={[s.btn, summaryReady && { backgroundColor: C.greenSoft }]}
          >
            <Text style={[s.btnText, summaryReady && { color: C.green }]}>
              {summaryReady ? 'Summary ready to send' : 'Create summary'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ground },
  content: { padding: 20, gap: 16 },
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
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});