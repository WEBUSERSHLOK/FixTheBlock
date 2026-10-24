import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { C, STATUS } from '../../constants/fmb';
import { timeAgo, useReports } from '../../lib/ReportsContext';

export default function Home() {
  const { reports, toggleVote } = useReports();
  const count = (s: string) => reports.filter((r) => r.status === s).length;
  const top = [...reports].filter((r) => r.status !== 'fixed').sort((a, b) => b.votes - a.votes).slice(0, 4);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.brandRow}>
          <View style={s.logo}>
            <Ionicons name="construct-outline" size={20} color="#fff" />
          </View>
          <Text style={s.brand}>FixMyBlock</Text>
        </View>

        <View style={s.hero}>
          <Text style={s.heroKicker}>Your neighborhood</Text>
          <Text style={s.heroTitle}>See a problem?{'\n'}Snap it in 10 seconds.</Text>
          <Text style={s.heroBody}>
            AI identifies the issue, tags the spot, and sends a ready report to your township.
          </Text>
          <Pressable style={s.heroBtn} onPress={() => router.push('/scan')}>
            <Ionicons name="camera-outline" size={20} color={C.blue} />
            <Text style={s.heroBtnText}>Report a problem</Text>
          </Pressable>
        </View>

        <View style={s.stats}>
          <Stat n={count('open')} label="Open" color={STATUS.open.fg} />
          <Stat n={count('reported')} label="Sent to town" color={STATUS.reported.fg} />
          <Stat n={count('fixed')} label="Fixed" color={STATUS.fixed.fg} />
        </View>

        <View style={s.sectionRow}>
          <Text style={s.h2}>Most upvoted nearby</Text>
          <Pressable onPress={() => router.push('/map')} hitSlop={12}>
            <Text style={s.link}>See map</Text>
          </Pressable>
        </View>

        {top.length === 0 && (
          <View style={s.empty}>
            <Text style={s.cardTitle}>No open reports yet</Text>
            <Text style={s.cardMeta}>When you or a neighbor reports a problem, it shows up here.</Text>
          </View>
        )}

        {top.map((r) => (
          <View key={r.id} style={s.card}>
            <Pressable
              style={{ flex: 1, gap: 6 }}
              onPress={() => router.push({ pathname: '/map', params: { id: String(r.id) } })}
            >
              <Text style={[s.pill, { backgroundColor: STATUS[r.status].bg, color: STATUS[r.status].fg }]}>
                {STATUS[r.status].label}
              </Text>
              <Text style={s.cardTitle}>{r.title}</Text>
              <Text style={s.cardMeta}>
                {r.street}, {timeAgo(r.createdAt)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Upvote"
              onPress={() => toggleVote(r.id)}
              style={[s.vote, r.voted && s.voteOn]}
            >
              <Ionicons name="arrow-up" size={18} color={r.voted ? '#fff' : C.ink} />
              <Text style={[s.voteText, r.voted && { color: '#fff' }]}>{r.votes}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statN, { color }]}>{n}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ground },
  content: { padding: 20, gap: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 20, fontWeight: '800', color: C.ink },
  hero: { backgroundColor: C.blue, borderRadius: 20, padding: 22, gap: 12 },
  heroKicker: { color: '#C9DAF0', fontSize: 13, fontWeight: '600' },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 30 },
  heroBody: { color: '#DCE7F5', fontSize: 14, lineHeight: 20 },
  heroBtn: { marginTop: 4, height: 52, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroBtnText: { color: C.blue, fontSize: 16, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12 },
  statN: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 13, fontWeight: '600', color: C.muted },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  h2: { fontSize: 18, fontWeight: '800', color: C.ink },
  link: { fontSize: 14, fontWeight: '700', color: C.blue },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  cardMeta: { fontSize: 13, color: C.muted },
  empty: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 16, padding: 18, gap: 4 },
  vote: { width: 52, height: 56, borderRadius: 14, borderWidth: 1, borderColor: '#DADDD6', alignItems: 'center', justifyContent: 'center' },
  voteOn: { backgroundColor: C.blue, borderColor: C.blue },
  voteText: { fontSize: 14, fontWeight: '800', color: C.ink },
});