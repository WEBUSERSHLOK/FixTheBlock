// confirm.ts
// Shows an "Are you sure?" popup before doing something that can't be undone.
// Phones use the native Alert, but Alert doesn't show buttons in a web browser,
// so the browser uses window.confirm instead.

import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}