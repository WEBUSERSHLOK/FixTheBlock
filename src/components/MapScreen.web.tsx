// MapScreen.web.tsx (browser version)
// The map library doesn't run in a web browser, so on web the Map tab shows
// the same reports as a list instead. Phones use MapScreen.tsx.

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { C, STATUS, Status, TYPE_LABELS } from '../constants/fmb';
import { timeAgo, useReports } from '../lib/ReportsContext';
import { confirmAction } from '../lib/confirm';

// The filter buttons above the list.
const FILTERS: { id: 'all' | Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'reported', label: 'Sent to town' },
  { id: 'fixed', label: 'Fixed' },
];

export default function MapScreenWeb() {
  const { reports, toggleVote, removeReport } = useReports();
  const params = useLocalSearchParams<{ id?: string }>();
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // If Home or Scan sent us here with a report id, highlight that report.
  useEffect(() => {
    if (params.id) {
      setSelectedId(Number(params.id));
      setFilter('all');
    }
  }, [params.id]);

  // Only the reports that match the current filter.
  const visible = reports.filter((r) => filter === 'all' || r.status === filter);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>Community map</Text>
      <Text style={s.sub}>The live map runs on phones. Here are the same reports as a list.</Text>

      <View style={s.chips}>
        {FILTERS.map((f) => (
          <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[s.chip, filter === f.id && s.chipOn]}>
            <Text style={[s.chipText, filter === f.id && { color: '#fff' }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {visible.length === 0 && (
        <View style={[s.card, { borderStyle: 'dashed' }]}>
          <Text style={s.title}>No reports here yet</Text>
          <Text style={s.sub}>Reports you send from the Scan tab will appear in this list.</Text>
        </View>
      )}

      {/* One card per report. Tapping a card selects it and shows the upvote button. */}
      {visible.map((r) => {
        const st = STATUS[r.status];
        const isSel = r.id === selectedId;
        return (
          <Pressable
            key={r.id}
            onPress={() => setSelectedId(isSel ? null : r.id)}
            style={[s.card, isSel && { borderColor: C.blue, borderWidth: 2 }]}
          >
            <View style={s.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.dot, { backgroundColor: st.pin }]} />
                <Text style={[s.pill, { backgroundColor: st.bg, color: st.fg }]}>{st.label}</Text>
              </View>
              <Text style={s.sub}>{timeAgo(r.createdAt)}</Text>
            </View>
            <Text style={s.title}>{r.title}</Text>
            <Text style={s.sub}>
              {r.street}. Detected as {TYPE_LABELS[r.type]} ({r.conf}% confidence)
            </Text>
            {isSel && (
              <Pressable onPress={() => toggleVote(r.id)} style={[s.voteBtn, r.voted && s.voteBtnOn]}>
                <Ionicons name="arrow-up" size={18} color={r.voted ? '#fff' : C.blue} />
                <Text style={[s.voteBtnText, r.voted && { color: '#fff' }]}>I see this too ({r.votes})</Text>
              </Pressable>
            )}
            {/* Only the person who made a report can remove it */}
            {isSel && r.mine && (
              <Pressable
                style={s.removeBtn}
                onPress={() =>
                  confirmAction('Remove this report?', 'It will be taken off the map for everyone.', 'Remove', () => {
                    removeReport(r.id);
                    setSelectedId(null);
                  })
                }
              >
                <Ionicons name="trash-outline" size={18} color={C.orangeText} />
                <Text style={s.removeText}>Remove report</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Styles for this screen
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ground },
  content: { padding: 20, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#CDD1C9', backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, fontWeight: '700', color: C.ink },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '800', color: C.ink },
  voteBtn: { marginTop: 6, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  removeBtn: { height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  removeText: { fontSize: 15, fontWeight: '700', color: C.orangeText },
  voteBtnOn: { backgroundColor: C.blue },
  voteBtnText: { fontSize: 15, fontWeight: '700', color: C.blue },
});