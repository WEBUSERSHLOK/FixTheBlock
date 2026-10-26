// scan.tsx (Scan tab)
// The main feature: take or upload a photo, let the AI figure out what the
// problem is, then send it as a report pinned to a location.

import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { C, ISSUE_TYPES, IssueType, TYPE_LABELS } from '../../constants/fmb';
import { useReports } from '../../lib/ReportsContext';
import { addressNear, findAddress } from '../../lib/address';
import { useTownship } from '../../lib/TownshipContext';
import { newlyUnlocked } from '../../lib/achievements';
import TMClassifier from '../../components/TMClassifier';
import type { ClassifierHandle } from '../../lib/classifier';
import type { ComponentRef } from 'react';

// The screen moves through four steps:
// camera (take or upload a photo) -> analyzing (AI is thinking)
// -> result (review and send) -> done (confirmation).
type Step = 'camera' | 'analyzing' | 'result' | 'done';

// Builds an image source the AI can read. On phones we ask for the photo as
// base64 text (a data URL), since the hidden WebView can't open app files.
// In the browser, the uri already works.
function toImageSrc(base64: string | null | undefined, uri: string) {
  if (!base64) return uri;
  return base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
}

export default function Scan() {
  // Camera permission, plus a ref so we can tell the camera to take a picture.
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  // The Teachable Machine model (see components/TMClassifier).
  const tmRef = useRef<ClassifierHandle>(null);

  // When someone taps a text box, the keyboard covers the bottom half of the
  // screen. These remember where the note and address boxes are, so the screen
  // can scroll them up above the keyboard.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const noteY = useRef(0);
  const addressY = useRef(0);
  const scrollToBox = (y: number) =>
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }), 250);
  // Which camera is on: 'back' (default, for photographing problems) or 'front'.
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const { reports, addReport } = useReports();
  const { sendReport, hasTown, editTownship } = useTownship();

  // Everything this screen keeps track of while making a report.

  const [step, setStep] = useState<Step>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [conf, setConf] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [newId, setNewId] = useState<number | null>(null);
  // Camera photos use the phone's location, since you're standing at the problem.
  // Uploaded photos could have been taken anywhere (and you might be at home),
  // so for those the person types the nearest address instead.
  const [isUpload, setIsUpload] = useState(false);
  const [address, setAddress] = useState(''); // typed address, for uploads
  const [pinned, setPinned] = useState(true); // whether the report got a map pin
  const [sentStreet, setSentStreet] = useState(''); // address shown on the confirmation screen
  // The AI's best guess: whichever issue type got the highest score.
  const topIdx = conf.length ? conf.indexOf(Math.max(...conf)) : 0;
  const topType: IssueType = ISSUE_TYPES[topIdx];

  // Clears everything and goes back to the camera.
  const reset = () => {
    setStep('camera');
    setPhoto(null);
    setConf([]);
    setNote('');
    setAddress('');
    setIsUpload(false);
  };

  // Runs the AI on a photo. Used by both the camera and the upload button.
  // uri is for showing the photo, src is the version the AI reads.
  const analyze = async (uri: string, src: string) => {
    setPhoto(uri);
    setStep('analyzing');
    try {
      if (!tmRef.current) throw new Error('The AI model is still loading.');
      setConf(await tmRef.current.classify(src));
      setStep('result');
    } catch (e) {
      // Most likely no internet, since the model loads online.
      Alert.alert("Couldn't analyze the photo", 'Check your internet connection and try again.');
      reset();
    }
  };

  // Shutter button: takes a picture and analyzes it. exif: false means the
  // photo's extra data (time, device info) isn't kept.
  const shoot = async () => {
    const pic = await cameraRef.current?.takePictureAsync({ quality: 0.5, exif: false, base64: true });
    if (!pic) return;
    setIsUpload(false);
    await analyze(pic.uri, toImageSrc(pic.base64, pic.uri));
  };

  // "Upload a photo instead": lets people pick a photo they took earlier.
  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true, // so the AI can read it
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setIsUpload(true);
    await analyze(asset.uri, toImageSrc(asset.base64, asset.uri));
  };

  // Send report button. Figures out where the problem is, then saves the report.
  //   Uploaded photo: look up the address the person typed.
  //   Camera photo: read the phone's location once (with permission), then
  //   find the nearest street address for the label. We never track anyone.
  // If no location is available, the report still saves, just without a pin.
  const send = async () => {
    // Reports belong to a town, so the town has to be set first.
    if (!hasTown) {
      editTownship();
      return;
    }
    setSending(true);
    let coords: { latitude: number; longitude: number } | null = null;
    let street = 'Location not shared';

    if (isUpload) {
      street = address.trim();
      coords = await findAddress(street);
    } else {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        street = (await addressNear(coords)) ?? 'Your location';
      }
    }
    setPinned(!!coords);
    setSentStreet(street);

    // Save the report to the community database so it shows up for everyone.
    const id = await addReport({
      type: topType,
      title: `${TYPE_LABELS[topType]} reported`,
      street,
      conf: conf[topIdx],
      note: note.trim() || undefined,
      photoUri: photo ?? undefined,
      latitude: coords?.latitude ?? 0,
      longitude: coords?.longitude ?? 0,
      located: !!coords,
    });
    if (id === null) {
      setSending(false);
      Alert.alert("Couldn't post the report", 'Check your internet connection and try again.');
      return;
    }
    setNewId(id);
    setSending(false);
    setStep('done');
  };

  // Still checking camera permission, so show a blank screen for a moment.
  if (!permission) return <View style={s.screen} />;

  // No camera access yet: ask for it, or let them upload a photo instead.
  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.screen, s.center]}>
        <TMClassifier ref={tmRef} />
        <Ionicons name="camera-outline" size={40} color={C.blue} />
        <Text style={s.h1}>Camera access needed</Text>
        <Text style={[s.sub, { textAlign: 'center' }]}>
          FixMyBlock uses the camera to photograph the problem. Photos are only sent when you tap Send report.
        </Text>
        <Pressable style={s.primary} onPress={requestPermission}>
          <Text style={s.primaryText}>Allow camera</Text>
        </Pressable>
        <Pressable style={s.secondary} onPress={upload}>
          <Text style={s.secondaryText}>Upload a photo instead</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Invisible: loads the AI model in the background */}
      <TMClassifier ref={tmRef} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.content}
        // Leaves room for the keyboard so the bottom of the form can scroll into view
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* STEP 1: live camera, shutter button, and upload option */}
        {step === 'camera' && (
          <>
            <Text style={s.h1}>Report a problem</Text>
            <Text style={s.sub}>Point at the issue and tap the shutter.</Text>
            <View style={s.viewfinder}>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
              {/* Switches between the back and front (selfie) camera */}
              <Pressable
                accessibilityLabel="Switch camera"
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                style={s.flip}
              >
                <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
              </Pressable>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Pressable accessibilityLabel="Take photo and analyze" onPress={shoot} style={s.shutter}>
                <View style={s.shutterInner} />
              </Pressable>
            </View>
            <Pressable style={s.secondary} onPress={upload}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="images-outline" size={20} color={C.ink} />
                <Text style={s.secondaryText}>Upload a photo instead</Text>
              </View>
            </Pressable>
          </>
        )}

        {/* STEP 2: shows the photo with a spinner while the AI works */}
        {step === 'analyzing' && (
          <>
            <Text style={s.h1}>Report a problem</Text>
            <Text style={s.sub}>Identifying the issue type...</Text>
            <View style={s.viewfinder}>
              {photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />}
              <View style={s.analyzingBadge}>
                <ActivityIndicator color="#fff" />
                <Text style={s.analyzingText}>Analyzing on-device</Text>
              </View>
            </View>
          </>
        )}

        {/* STEP 3: the AI result with a bar for every issue type, then either
            a form to send the report or a "nothing wrong" message */}
        {step === 'result' && (
          <>
            <Text style={s.h1}>Review your report</Text>
            <Text style={s.sub}>Check the AI result and send it.</Text>
            {photo && <Image source={{ uri: photo }} style={s.thumb} />}

            <View style={s.card}>
              <View style={s.rowBetween}>
                <View>
                  <Text style={s.kicker}>Detected</Text>
                  <Text style={s.big}>{topType === 'none' ? 'Nothing wrong' : TYPE_LABELS[topType]}</Text>
                </View>
                <Text style={[s.badge, topType === 'none' && { backgroundColor: C.greenSoft, color: C.green }]}>
                  {conf[topIdx]}%
                </Text>
              </View>
              {ISSUE_TYPES.map((t, i) => (
                <View key={t} style={{ gap: 4 }}>
                  <View style={s.rowBetween}>
                    <Text style={s.barLabel}>{TYPE_LABELS[t]}</Text>
                    <Text style={s.barLabel}>{conf[i]}%</Text>
                  </View>
                  <View style={s.track}>
                    <View style={[s.bar, { width: `${conf[i]}%`, backgroundColor: i === topIdx ? C.blue : '#A9B0B8' }]} />
                  </View>
                </View>
              ))}
              {/* Warn people when the AI isn't sure, since it might be wrong */}
              {conf[topIdx] < 60 ? (
                <Text style={s.warn}>
                  The AI isn't very sure about this one. Try a closer photo with the problem in the center.
                </Text>
              ) : (
                <Text style={s.small}>AI results can be wrong. Tap the "i" button to learn more.</Text>
              )}
            </View>

            {topType === 'none' ? (
              <>
                <Text style={s.fine}>No problem detected, so there's nothing to report.</Text>
                <Pressable style={s.primary} onPress={reset}>
                  <Text style={s.primaryText}>Scan something else</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={s.card} onLayout={(e) => (noteY.current = e.nativeEvent.layout.y)}>
                  <Text style={s.barLabel}>Add a note (optional)</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    onFocus={() => scrollToBox(noteY.current)}
                    placeholder="e.g. About 2 ft wide, cars swerving around it"
                    placeholderTextColor="#7A828A"
                    multiline
                    style={s.input}
                  />
                </View>

                {/* Uploads: the person types the nearest address (required).
                    Camera: just a note that the phone's location will be used. */}
                {isUpload ? (
                <View style={s.card} onLayout={(e) => (addressY.current = e.nativeEvent.layout.y)}>
                  <Text style={s.barLabel}>Where was this photo taken?</Text>
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    onFocus={() => scrollToBox(addressY.current)}
                    placeholder="e.g. 120 Main St, or Main St & 3rd Ave"
                    placeholderTextColor="#7A828A"
                    style={[s.input, { minHeight: 48 }]}
                  />
                  <Text style={s.small}>
                    Type the nearest address or cross streets, plus the town, since you might not be there now.
                  </Text>
                </View>
                ) : (
                  <View style={s.card}>
                    <Text style={s.barLabel}>Location</Text>
                    <Text style={s.small}>
                      We'll use your current location when you tap Send, since you're at the problem. It's only read
                      once, and we never track you.
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable style={s.secondary} onPress={reset}>
                    <Text style={s.secondaryText}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={[s.primary, { flex: 1 }, isUpload && !address.trim() && { opacity: 0.5 }]}
                    onPress={send}
                    disabled={sending || (isUpload && !address.trim())}
                  >
                    {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Send report</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}

        {/* STEP 4: confirmation, with buttons to view it on the map or start over */}
        {step === 'done' && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
            <View style={s.check}>
              <Ionicons name="checkmark" size={36} color={C.green} />
            </View>
            <Text style={s.big}>Report posted</Text>
            {/* Celebrate any badge this report just unlocked */}
            {newlyUnlocked(
              reports.filter((x) => x.id !== newId),
              reports
            ).map((b) => (
              <View key={b.id} style={s.unlockBadge}>
                <Ionicons name="trophy" size={18} color={C.green} />
                <Text style={s.unlockText}>New badge: {b.title}</Text>
              </View>
            ))}
            <Text style={[s.sub, { textAlign: 'center' }]}>
              {pinned
                ? `Pinned ${sentStreet.startsWith('Near ') ? 'near' + sentStreet.slice(4) : 'near ' + sentStreet}. Neighbors can now see and upvote it.`
                : isUpload
                  ? "We couldn't find that address on the map, so the report is saved without a pin. It still shows on Home."
                  : 'Report saved without a location, so it shows on Home but not as a map pin.'}
            </Text>
            {/* Opens a filled-out email to the township. Once it's sent, the
                report changes to "Sent to town". */}
            <Pressable
              style={[s.primary, { alignSelf: 'stretch', marginTop: 8, flexDirection: 'row', gap: 8 }]}
              onPress={() => {
                const r = reports.find((x) => x.id === newId);
                if (r) sendReport(r);
              }}
            >
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={s.primaryText}>
                {reports.find((x) => x.id === newId)?.status === 'reported' ? 'Sent to township' : 'Email it to the township'}
              </Text>
            </Pressable>
            <Pressable
              style={[s.secondary, { alignSelf: 'stretch' }]}
              onPress={() => {
                reset();
                router.push({ pathname: '/map', params: { id: String(newId) } });
              }}
            >
              <Text style={s.secondaryText}>View on map</Text>
            </Pressable>
            <Pressable style={[s.secondary, { alignSelf: 'stretch' }]} onPress={reset}>
              <Text style={s.secondaryText}>Report another</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles for this screen
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ground },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  content: { padding: 20, gap: 14 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, lineHeight: 20 },
  viewfinder: { height: 360, borderRadius: 22, overflow: 'hidden', backgroundColor: '#20262C' },
  flip: { position: 'absolute', top: 14, right: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16,20,24,0.6)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue },
  analyzingBadge: { position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(16,20,24,0.85)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  analyzingText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  thumb: { height: 160, borderRadius: 16 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 16, gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 13, fontWeight: '700', color: C.muted },
  big: { fontSize: 22, fontWeight: '800', color: C.ink },
  badge: { backgroundColor: C.blueSoft, color: C.blue, fontSize: 18, fontWeight: '800', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
  barLabel: { fontSize: 13, fontWeight: '600', color: '#3F464D' },
  track: { height: 8, borderRadius: 4, backgroundColor: C.track, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  input: { minHeight: 64, borderWidth: 1, borderColor: '#CDD1C9', borderRadius: 12, padding: 12, fontSize: 15, color: C.ink, backgroundColor: '#FAFBF8', textAlignVertical: 'top' },
  small: { fontSize: 12, color: C.muted },
  warn: { fontSize: 13, fontWeight: '600', color: C.orangeText, backgroundColor: C.orangeSoft, padding: 10, borderRadius: 10, overflow: 'hidden' },
  fine: { backgroundColor: C.greenSoft, color: '#1E4D2E', padding: 16, borderRadius: 18, overflow: 'hidden', fontSize: 15, fontWeight: '600' },
  primary: { height: 52, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#CDD1C9', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryText: { color: C.ink, fontSize: 16, fontWeight: '700' },
  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  unlockText: { fontSize: 14, fontWeight: '700', color: C.green },
  check: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
});