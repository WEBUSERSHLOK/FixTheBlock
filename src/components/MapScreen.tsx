// MapScreen.tsx (phone version)
// Shows every report as a pin on a real map. Tap a pin to see details and upvote.
// The browser uses MapScreen.web.tsx instead, since this map only works on phones.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { C, REPORT_ZOOM, STATUS, Status, TYPE_LABELS, US_REGION } from '../constants/fmb';
import { timeAgo, useReports } from '../lib/ReportsContext';
import { confirmAction } from '../lib/confirm';

// The filter buttons above the map.
const FILTERS: { id: 'all' | Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'reported', label: 'Sent to town' },
  { id: 'fixed', label: 'Fixed' },
];

export default function MapScreen() {
  const { reports, toggleVote, removeReport } = useReports();
  const params = useLocalSearchParams<{ id?: string }>();
  const [filter, setFilter] = useState<'all' | Status>('all'); // which filter is on
  const [selectedId, setSelectedId] = useState<number | null>(null); // which pin was tapped
  const mapRef = useRef<MapView>(null); // lets us move the map from code

  // When Home or Scan sends us here with an id, select that report.
  useEffect(() => {
    if (params.id) {
      setSelectedId(Number(params.id));
      setFilter('all');
    }
  }, [params.id]);

  // Only reports with a location that match the current filter get pins.
  const visible = useMemo(
    () => reports.filter((r) => r.located && (filter === 'all' || r.status === filter)),
    [reports, filter]
  );
  // The full report for the tapped pin, used by the details card at the bottom.
  const sel = reports.find((r) => r.id === selectedId);

  // When a report is selected (tapped pin, or opened from Home or Scan),
  // zoom the map in to it.
  useEffect(() => {
    if (sel?.located) {
      mapRef.current?.animateToRegion({ latitude: sel.latitude, longitude: sel.longitude, ...REPORT_ZOOM }, 600);
    }
  }, [selectedId]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Text style={s.h1}>Community map</Text>
        <Text style={s.sub}>Tap a pin to see details and upvote.</Text>
        <View style={s.chips}>
          {FILTERS.map((f) => (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[s.chip, filter === f.id && s.chipOn]}>
              <Text style={[s.chipText, filter === f.id && { color: '#fff' }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* The map. Tapping empty space closes the details card.
          Each report becomes a pin colored by its status. */}
      <MapView
        style={{ flex: 1 }}
        showsUserLocation
        ref={mapRef}
        initialRegion={US_REGION}
        onPress={() => setSelectedId(null)}
      >
        {visible.map((r) => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.latitude, longitude: r.longitude }}
            pinColor={STATUS[r.status].pin}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedId(r.id);
            }}
          />
        ))}
      </MapView>

      {/* Details card for the selected report, with the upvote button */}
      {sel && (
        <View style={s.sheet}>
          <View style={s.sheetTop}>
            <Text style={[s.pill, { backgroundColor: STATUS[sel.status].bg, color: STATUS[sel.status].fg }]}>
              {STATUS[sel.status].label}
            </Text>
            <Text style={s.sub}>{timeAgo(sel.createdAt)}</Text>
          </View>
          <Text style={s.title}>{sel.title}</Text>
          <Text style={s.sub}>
            {sel.street}. Detected as {TYPE_LABELS[sel.type]} ({sel.conf}% confidence)
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable onPress={() => toggleVote(sel.id)} style={[s.voteBtn, sel.voted && s.voteBtnOn]}>
              <Ionicons name="arrow-up" size={18} color={sel.voted ? '#fff' : C.blue} />
              <Text style={[s.voteBtnText, sel.voted && { color: '#fff' }]}>I see this too ({sel.votes})</Text>
            </Pressable>
            <Pressable onPress={() => setSelectedId(null)} style={s.closeBtn}>
              <Text style={s.closeText}>Close</Text>
            </Pressable>
          </View>
          {/* Only the person who made a report can remove it, for example if the
              AI picked the wrong issue type. */}
          {sel.mine && (
            <Pressable
              style={s.removeBtn}
              onPress={() =>
                confirmAction('Remove this report?', 'It will be taken off the map for everyone.', 'Remove', () => {
                  removeReport(sel.id);
                  setSelectedId(null);
                })
              }
            >
              <Ionicons name="trash-outline" size={18} color={C.orangeText} />
              <Text style={s.removeText}>Remove report</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// Styles for this screen
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ground },
  header: { padding: 20, paddingBottom: 12, gap: 4 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#CDD1C9', backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, fontWeight: '700', color: C.ink },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '800', color: C.ink },
  voteBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  voteBtnOn: { backgroundColor: C.blue },
  voteBtnText: { fontSize: 15, fontWeight: '700', color: C.blue },
  closeBtn: { height: 48, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#DADDD6', justifyContent: 'center' },
  removeBtn: { height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  removeText: { fontSize: 15, fontWeight: '700', color: C.orangeText },
  closeText: { fontSize: 15, fontWeight: '700', color: C.ink },
});