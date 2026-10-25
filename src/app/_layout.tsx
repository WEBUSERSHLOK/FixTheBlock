// _layout.tsx (root)
// The outermost layout. Expo Router loads this first, before any screen.

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { ReportsProvider } from '../lib/ReportsContext';
import { TownshipProvider } from '../lib/TownshipContext';
import AIInfoButton from '../components/AIInfoButton';

// ReportsProvider goes around everything so every screen can share reports.
// The Stack holds the tab screens, with the default header hidden since
// each screen draws its own title. TownshipProvider handles the township's
// email for sending reports. AIInfoButton sits on top of every screen.
export default function RootLayout() {
  return (
    <ReportsProvider>
      <TownshipProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          <AIInfoButton />
        </View>
      </TownshipProvider>
    </ReportsProvider>
  );
}