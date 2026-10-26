// supabase.ts
// Connects the app to its online database (Supabase), so every phone shares
// the same reports and upvotes. People are signed in automatically and
// anonymously: no account, email, or password needed.

import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// The project's address and its publishable key. The publishable key is meant
// to be in the app: the database's security rules decide what it can do.
const SUPABASE_URL = 'https://wjbmddxzkdygmemlpkcx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_s5EQcd9y5_OHuQcfVlU00w_IDdTStMd';

// Where the sign-in is remembered between app launches. Phones use
// AsyncStorage. In the browser it's localStorage, and while Expo prepares the
// web page on the computer there's no storage at all, so it's skipped.
const storage =
  Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.localStorage : undefined) : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keeps the sign-in fresh only while the app is open, as Supabase recommends.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}