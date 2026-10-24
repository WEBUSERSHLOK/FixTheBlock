// scan.tsx (Scan tab)
// The main feature: take or upload a photo, let the AI figure out what the
// problem is, then send it as a report pinned to a location.

import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { C, ISSUE_TYPES, IssueType, MAP_CENTER, TYPE_LABELS } from '../../constants/fmb';
import { useReports } from '../../lib/ReportsContext';
import TMClassifier from '../../components/TMClassifier';
import type { ClassifierHandle } from '../../lib/classifier';

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

// Phone photos usually store where they were taken. This pulls out those
// coordinates so an uploaded photo gets pinned in the right place.
// Returns null if the photo has none (screenshots, web images, or location
// tagging turned off).
function gpsFromExif(exif: Record<string, any> | null | undefined) {
  if (!exif) return null;
  let lat = Number(exif.GPSLatitude);
  let lng = Number(exif.GPSLongitude);
  if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (exif.GPSLatitudeRef === 'S' && lat > 0) lat = -lat;
  if (exif.GPSLongitudeRef === 'W' && lng > 0) lng = -lng;
  return { latitude: lat, longitude: lng };
}

export default function Scan() {
  // Camera permission, plus a ref so we can tell the camera to take a picture.
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  // The Teachable Machine model (see components/TMClassifier).
  const tmRef = useRef<ClassifierHandle>(null);
  const { addReport } = useReports();

  // Everything this screen keeps track of while making a report.

  const [step, setStep] = useState<Step>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [conf, setConf] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [newId, setNewId] = useState<number | null>(null);
  const [usedGps, setUsedGps] = useState(true);
  // Where an uploaded photo was taken (from the photo's GPS data), if available.
  const [photoCoords, setPhotoCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // The AI's best guess: whichever issue type got the highest score.
  const topIdx = conf.length ? conf.indexOf(Math.max(...conf)) : 0;
  const topType: IssueType = ISSUE_TYPES[topIdx];

  // Clears everything and goes back to the camera.
  const reset = () => {
    setStep('camera');
    setPhoto(null);
    setConf([]);
    setNote('');
    setPhotoCoords(null);
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
    setPhotoCoords(null);
    await analyze(pic.uri, toImageSrc(pic.base64, pic.uri));
  };

  // "Upload a photo instead": lets people pick a photo they took earlier.
  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true, // so the AI can read it
      exif: true, // read only to find where the photo was taken
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setPhotoCoords(gpsFromExif(asset.exif));
    await analyze(asset.uri, toImageSrc(asset.base64, asset.uri));
  };

  // Send report button. Figures out the location, then saves the report.
  // Location is only read here, once, and only with permission. We never
  // track anyone. An uploaded photo uses the spot where it was taken instead
  // of where you are now.
  const send = async () => {
    setSending(true);
    let coords = MAP_CENTER;
    let street = 'Location not shared';
    if (photoCoords) {
      coords = photoCoords;
      street = 'Where the photo was taken';
      setUsedGps(true);
    } else {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        street = 'Your location';
        setUsedGps(true);
      } else {
        setUsedGps(false); // TODO: let the user drop a pin or type an address instead
      }
    }
    // Save the report so it shows up on every tab.
    const id = addReport({
      type: topType,
      title: `${TYPE_LABELS[topType]} reported`,
      street,
      conf: conf[topIdx],
      note: note.trim() || undefined,
      photoUri: photo ?? undefined,
      ...coords,
    });
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
      <ScrollView contentContainerStyle={s.content}>
        {/* STEP 1: live camera, shutter button, and upload option */}
        {step === 'camera' && (
          <>
            <Text style={s.h1}>Report a problem</Text>
            <Text style={s.sub}>Point at the issue and tap the shutter.</Text>
            <View style={s.viewfinder}>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
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
                <View style={s.card}>
                  <Text style={s.barLabel}>Add a note (optional)</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="e.g. About 2 ft wide, cars swerving around it"
                    placeholderTextColor="#7A828A"
                    multiline
                    style={s.input}
                  />
                  <Text style={s.small}>
                    {photoCoords
                      ? "We'll pin this where the photo was taken."
                      : 'Your location is attached only when you tap Send. We never track you.'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable style={s.secondary} onPress={reset}>
                    <Text style={s.secondaryText}>Retake</Text>
                  </Pressable>
                  <Pressable style={[s.primary, { flex: 1 }]} onPress={send} disabled={sending}>
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
            <Text style={s.big}>Report sent</Text>
            <Text style={[s.sub, { textAlign: 'center' }]}>
              {usedGps
                ? 'Your report is on the community map. Neighbors can upvote it.'
                : 'Report saved without your location. You can add the spot from the map.'}
            </Text>
            <Pressable
              style={[s.primary, { alignSelf: 'stretch', marginTop: 8 }]}
              onPress={() => {
                reset();
                router.push({ pathname: '/map', params: { id: String(newId) } });
              }}
            >
              <Text style={s.primaryText}>View on map</Text>
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
  fine: { backgroundColor: C.greenSoft, color: '#1E4D2E', padding: 16, borderRadius: 18, overflow: 'hidden', fontSize: 15, fontWeight: '600' },
  primary: { height: 52, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#CDD1C9', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryText: { color: C.ink, fontSize: 16, fontWeight: '700' },
  check: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
});