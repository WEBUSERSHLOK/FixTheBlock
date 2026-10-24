import { Stack } from 'expo-router';
import { ReportsProvider } from '../lib/ReportsContext';

export default function RootLayout() {
  return (
    <ReportsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ReportsProvider>
  );
}