// AIInfoButton.tsx
// The small round "i" button that floats on every screen. Tapping it explains
// how the AI works and its limits, so people know a result can be wrong.

import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/fmb';

// Each point shown in the popup: an icon, a heading, and a short explanation.
const POINTS: { icon: ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  {
    icon: 'sparkles-outline',
    title: 'The AI can make mistakes',
    body: 'FixTheBlock uses an AI model to guess the type of problem in your photo. It is usually right, but not always, so check the result before you send a report.',
  },
  {
    icon: 'images-outline',
    title: 'It only knows a few things',
    body: 'The model was trained on potholes, damaged sidewalks, dumping, graffiti, and fallen trees. Photos of anything else (like people, pets, food, or the inside of a building) can get a wrong label, because the model will pick whichever category looks closest.',
  },
  {
    icon: 'speedometer-outline',
    title: 'Watch the confidence score',
    body: 'The percentage shows how sure the AI is. A low score means it is guessing. Try retaking the photo closer to the problem, in good light, with the issue in the center.',
  },
  {
    icon: 'location-outline',
    title: 'Use a real, accurate address',
    body: "When you upload a photo, the address you type decides where the report is pinned. A wrong or made-up address can put the pin in the wrong place, or the address may not be found at all and the report won't get a pin. Always double-check it, and include the town.",
  },
  {
    icon: 'trash-outline',
    title: 'You can remove a report',
    body: 'If a report you sent has the wrong issue type, open it on the Map tab and tap Remove report. Then scan it again.',
  },
];

export default function AIInfoButton() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      {/* The floating button. It sits above the tab bar in the bottom right corner. */}
      <Pressable
        accessibilityLabel="About the AI"
        onPress={() => setOpen(true)}
        style={[s.fab, { bottom: 96 + insets.bottom }]}
      >
        <Ionicons name="information" size={24} color="#fff" />
      </Pressable>

      {/* The popup with the information */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          {/* Stops taps inside the card from closing the popup */}
          <Pressable style={s.card} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <Text style={s.h1}>About the AI</Text>
              {POINTS.map((p) => (
                <View key={p.title} style={s.point}>
                  <View style={s.iconWrap}>
                    <Ionicons name={p.icon} size={20} color={C.blue} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.title}>{p.title}</Text>
                    <Text style={s.body}>{p.body}</Text>
                  </View>
                </View>
              ))}
              <Pressable style={s.btn} onPress={() => setOpen(false)}>
                <Text style={s.btnText}>Got it</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, maxHeight: '85%', maxWidth: 480, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 22, fontWeight: '800', color: C.ink },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: C.ink },
  body: { fontSize: 14, lineHeight: 20, color: C.muted },
  btn: { height: 48, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});