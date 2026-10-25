// sendToTown.ts
// Emails a report to the township. The app fills out the whole email (and
// attaches the photo on phones), and the person sends it from their own email
// app. Townships already accept reports by email, so no server is needed.
// The township's address comes from the person (see TownshipContext).

import { Linking, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import { APP_NAME, TYPE_LABELS } from '../constants/fmb';
import { Report } from './ReportsContext';
import { confirmAction } from './confirm';

// Writes the subject and body of the email.
function buildEmail(r: Report) {
  const label = TYPE_LABELS[r.type];
  // "near 120 Main St" for detected addresses, "at ..." for typed ones, and
  // nothing if no location was shared.
  const noLocation = r.street === 'Location not shared';
  const place = noLocation ? '' : r.street.startsWith('Near ') ? `near ${r.street.slice(5)}` : `at ${r.street}`;
  const lines = [
    'Hello,',
    '',
    `I'd like to report a ${label.toLowerCase()}${place ? ' ' + place : ''}.`,
    '',
    `Issue: ${label}`,
    `Location: ${noLocation ? 'Not provided' : r.street}`,
    // A map link lets the crew find the exact spot, if we have one.
    r.located ? `Map: https://maps.google.com/?q=${r.latitude},${r.longitude}` : null,
    r.note ? `Details: ${r.note}` : null,
    `Neighbors who confirmed it: ${r.votes}`,
    `Reported: ${new Date(r.createdAt).toLocaleString()}`,
    '',
    `The issue type was identified by ${APP_NAME}'s AI (${r.conf}% confidence) and checked by me before sending.`,
    '',
    'Thank you,',
    `Sent with ${APP_NAME}`,
  ];
  return {
    subject: `Community report: ${label}${place ? ' ' + place : ''}`,
    body: lines.filter((l) => l !== null).join('\n'),
  };
}

// Opens the email. Calls onSent once the report was sent, so the app can
// change its status to "Sent to town".
export async function sendToTown(r: Report, townshipEmail: string, onSent: () => void) {
  const { subject, body } = buildEmail(r);

  // On phones with an email account set up, open a full email with the photo attached.
  if (Platform.OS !== 'web' && (await MailComposer.isAvailableAsync())) {
    const result = await MailComposer.composeAsync({
      recipients: [townshipEmail],
      subject,
      body,
      attachments: r.photoUri ? [r.photoUri] : [],
    });
    // iPhones tell us if it was really sent. Android doesn't, so assume it was
    // unless they cancelled.
    if (result.status === 'sent' || (Platform.OS === 'android' && result.status !== 'cancelled')) onSent();
    return;
  }

  // Otherwise (browser, or no email account on the phone), open a plain email
  // link. Photos can't be attached this way, and we can't tell if it was sent,
  // so we ask afterward.
  const url = `mailto:${townshipEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  await Linking.openURL(url);
  setTimeout(
    () => confirmAction('Did you send the email?', 'We\'ll mark the report as "Sent to town".', 'Yes, I sent it', onSent),
    1500
  );
}