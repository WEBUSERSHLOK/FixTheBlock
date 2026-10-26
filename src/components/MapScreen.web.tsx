// MapScreen.web.tsx (browser version)
// The phone map library doesn't run in a web browser, so the browser uses
// Leaflet instead: a free web map library that draws OpenStreetMap maps, with
// no account or key needed. Below the map is the same list of reports, with
// all the buttons. Phones use MapScreen.tsx.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { C, STATUS, Status, TYPE_LABELS, US_REGION } from '../constants/fmb';
import { timeAgo, useReports } from '../lib/ReportsContext';
import { confirmAction } from '../lib/confirm';
import { useTownship } from '../lib/TownshipContext';

// The filter buttons above the list.
const FILTERS: { id: 'all' | Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'reported', label: 'Sent to town' },
  { id: 'fixed', label: 'Fixed' },
];

// Leaflet is loaded from the internet the first time the Map tab opens: its
// style sheet (so the map looks right) and its code. It's only loaded once.
const LEAFLET_VERSION = '1.9.4';
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
      js.onload = () => resolve((window as any).L);
      js.onerror = () => {
        leafletPromise = null; // allow another try next time
        reject(new Error("Couldn't load the map"));
      };
      document.head.appendChild(js);
    });
  }
  return leafletPromise;
}

export default function MapScreenWeb() {
  const { reports, toggleVote, removeReport, setStatus } = useReports();
  const { sendReport } = useTownship();
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
  const visible = useMemo(() => reports.filter((r) => filter === 'all' || r.status === filter), [reports, filter]);

  // The map lives in a plain web <div>. These refs hold the div, the Leaflet
  // map, and the layer the pins are drawn on, so the code can update them.
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const pinsRef = useRef<any>(null);
  const [L, setL] = useState<any>(null); // the Leaflet library, once loaded
  const [mapFailed, setMapFailed] = useState(false);

  // Load Leaflet when the screen opens.
  useEffect(() => {
    loadLeaflet().then(setL).catch(() => setMapFailed(true));
  }, []);

  // Create the map once Leaflet is ready: start zoomed out on the whole US,
  // with OpenStreetMap's street tiles (credit to OpenStreetMap is required).
  useEffect(() => {
    if (!L || !mapDiv.current || mapRef.current) return;
    const map = L.map(mapDiv.current).setView([US_REGION.latitude, US_REGION.longitude], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    pinsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [L]);

  // Redraw the pins whenever the reports, filter, or selection change.
  // Each pin is a circle in its status color; the selected one is bigger.
  useEffect(() => {
    if (!L || !pinsRef.current) return;
    pinsRef.current.clearLayers();
    for (const r of visible) {
      if (!r.located) continue;
      L.circleMarker([r.latitude, r.longitude], {
        radius: r.id === selectedId ? 12 : 8,
        color: '#ffffff',
        weight: 3,
        fillColor: STATUS[r.status].pin,
        fillOpacity: 1,
      })
        .bindTooltip(`${TYPE_LABELS[r.type]}: ${r.street}`)
        .on('click', () => setSelectedId(r.id))
        .addTo(pinsRef.current);
    }
  }, [L, visible, selectedId]);

  // Fly to a report when it's selected (tapped pin, card, or opened from Home).
  useEffect(() => {
    const sel = reports.find((r) => r.id === selectedId);
    if (mapRef.current && sel?.located) mapRef.current.flyTo([sel.latitude, sel.longitude], 16, { duration: 0.8 });
  }, [selectedId, L]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1}>Community map</Text>
      <Text style={s.sub}>Click a pin or a report to see details.</Text>

      <View style={s.chips}>
        {FILTERS.map((f) => (
          <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[s.chip, filter === f.id && s.chipOn]}>
            <Text style={[s.chipText, filter === f.id && { color: '#fff' }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* The map. On the web, a plain <div> works here, and Leaflet draws into it. */}
      <View style={s.mapBox}>
        <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />
        {mapFailed && <Text style={s.mapError}>Couldn't load the map. The reports are still listed below.</Text>}
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
            {/* Email it to the township, or mark it fixed once it's repaired */}
            {/* Marked fixed by mistake? Put it back to what it was before. */}
            {isSel && r.status === 'fixed' && (
              <View style={{ flexDirection: 'row' }}>
              <Pressable
                style={s.stepBtn}
                onPress={() => setStatus(r.id, r.prevStatus && r.prevStatus !== 'fixed' ? r.prevStatus : 'open')}
              >
                <Ionicons name="arrow-undo-outline" size={18} color={C.ink} />
                <Text style={s.stepText}>Undo: not fixed yet</Text>
              </Pressable>
              </View>
            )}
            {isSel && r.status !== 'fixed' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {r.status === 'open' && (
                  <Pressable style={s.stepBtn} onPress={() => sendReport(r)}>
                    <Ionicons name="mail-outline" size={18} color={C.ink} />
                    <Text style={s.stepText}>Send to township</Text>
                  </Pressable>
                )}
                <Pressable
                  style={s.stepBtn}
                  onPress={() =>
                    confirmAction('Mark as fixed?', 'Only do this once the problem has actually been repaired.', 'Mark fixed', () =>
                      setStatus(r.id, 'fixed')
                    )
                  }
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={C.green} />
                  <Text style={[s.stepText, { color: C.green }]}>Mark as fixed</Text>
                </Pressable>
              </View>
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
  mapBox: { height: 420, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: '#E6E9E1' },
  mapError: { position: 'absolute', top: 16, left: 16, right: 16, fontSize: 14, color: C.muted },
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
  stepBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#DADDD6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  stepText: { fontSize: 14, fontWeight: '700', color: C.ink },
  removeBtn: { height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  removeText: { fontSize: 15, fontWeight: '700', color: C.orangeText },
  voteBtnOn: { backgroundColor: C.blue },
  voteBtnText: { fontSize: 15, fontWeight: '700', color: C.blue },
});