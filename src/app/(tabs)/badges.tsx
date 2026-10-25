// badges.tsx (Badges tab)
// Shows the person's level, points, and every badge with a progress bar,
// so helping the community feels rewarding.

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/fmb';
import { useReports } from '../../lib/ReportsContext';
import { ACHIEVEMENTS, getLevel, getPoints, getStats } from '../../lib/achievements';

export default function Badges() {
  const { reports } = useReports();
  const stats = getStats(reports);
  const points = getPoints(stats);
  const level = getLevel(points);
  const unlocked = ACHIEVEMENTS.filter((a) => a.stat(stats) >= a.goal).length;

  // Divided the actual by goal to get percentage of achievements 
  const sorted = [...ACHIEVEMENTS].sort((a, b) => {
    const pa = Math.min(a.stat(stats) / a.goal, 1);
    const pb = Math.min(b.stat(stats) / b.goal, 1);
    return pb - pa;
  });

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View>
          <Text style={s.h1}>Badges</Text>
          <Text style={s.sub}>Earn badges and level up by helping fix your community.</Text>
        </View>

        {/* Level card: current level, points, and progress to the next level */}
        <View style={s.levelCard}>
          <View style={s.levelRow}>
            <View style={s.levelBadge}>
              <Text style={s.levelNum}>{level.level}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.levelName}>{level.name}</Text>
              <Text style={s.levelPts}>{points} points</Text>
            </View>
          </View>
          <View style={s.levelTrack}>
            <View style={[s.levelBar, { width: `${Math.round(level.progress * 100)}%` }]} />
          </View>
          <Text style={s.levelNext}>
            {level.next ? `${level.next.points - points} points to ${level.next.name}` : 'Top level reached!'}
          </Text>
        </View>

        <Text style={s.h2}>
          {unlocked} of {ACHIEVEMENTS.length} unlocked
        </Text>

        {/* One card per badge, with a progress bar */}
        {sorted.map((a) => {
          const current = Math.min(a.stat(stats), a.goal);
          const done = current >= a.goal;
          return (
            <View key={a.id} style={[s.card, done && s.cardDone]}>
              <View style={[s.icon, done ? s.iconDone : s.iconLocked]}>
                <Ionicons name={done ? a.icon : 'lock-closed-outline'} size={22} color={done ? '#fff' : C.muted} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.rowBetween}>
                  <Text style={s.title}>{a.title}</Text>
                  <Text style={[s.count, done && { color: C.green }]}>
                    {current}/{a.goal}
                  </Text>
                </View>
                <Text style={s.desc}>{a.description}</Text>
                <View style={s.track}>
                  <View style={[s.bar, { width: `${(current / a.goal) * 100}%` }, done && { backgroundColor: C.green }]} />
                </View>
              </View>
            </View>
          );
        })}

        <Text style={s.small}>
          Points: 10 per report, 5 more when it's sent to the township, 20 more when it's fixed, and 2 per upvote you
          give a neighbor.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ground },
  content: { padding: 20, gap: 12, paddingBottom: 120 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  h2: { fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 6 },
  sub: { fontSize: 14, color: C.muted, marginTop: 2 },
  levelCard: { backgroundColor: C.blue, borderRadius: 20, padding: 20, gap: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  levelNum: { fontSize: 24, fontWeight: '800', color: C.blue },
  levelName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  levelPts: { fontSize: 14, color: '#DCE7F5', fontWeight: '600' },
  levelTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  levelBar: { height: '100%', borderRadius: 5, backgroundColor: '#fff' },
  levelNext: { fontSize: 13, color: '#DCE7F5', fontWeight: '600' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardDone: { borderColor: C.green, backgroundColor: '#F4FAF6' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: C.green },
  iconLocked: { backgroundColor: C.track },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: C.ink },
  count: { fontSize: 13, fontWeight: '700', color: C.muted },
  desc: { fontSize: 13, color: C.muted },
  track: { height: 6, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden', marginTop: 2 },
  bar: { height: '100%', borderRadius: 3, backgroundColor: C.blue },
  small: { fontSize: 12, color: C.muted, marginTop: 4 },
});