// _layout.tsx (tabs)
// Builds the tab bar at the bottom of the app. Each Tabs.Screen below
// matches a file in this folder: index.tsx, map.tsx, scan.tsx, impact.tsx, badges.tsx.

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/fmb';

export default function TabsLayout() {
  return (
    <Tabs
      // Styling shared by every tab: blue when selected, gray otherwise.
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, height: 84, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => <Ionicons name="camera-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: 'Impact',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="badges"
        options={{
          title: 'Badges',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}