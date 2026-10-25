// summary.ts
// Builds the monthly summary: a one-page PDF of the community's open problems,
// ranked by how many neighbors upvoted them, for the township and the
// representative's office. It's written as a small web page (HTML) and then
// turned into a PDF.

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { APP_NAME, ISSUE_TYPES, STATUS, TYPE_LABELS } from '../constants/fmb';
import { Report } from './ReportsContext';

// Makes typed text safe to put inside the page (so a note with < or & in it
// can't break the layout).
const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The month name for the title, like "October 2026".
export function monthLabel(d = new Date()) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Writes the summary page.
export function buildSummaryHtml(reports: Report[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // The numbers at the top of the page.
  const open = reports.filter((r) => r.status !== 'fixed');
  const newThisMonth = reports.filter((r) => r.createdAt >= monthStart).length;
  const sent = reports.filter((r) => r.status === 'reported').length;
  const fixed = reports.filter((r) => r.status === 'fixed').length;

  // Open problems, most upvoted first, so the biggest issues are at the top.
  const ranked = [...open].sort((a, b) => b.votes - a.votes);

  const rows = ranked
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${esc(TYPE_LABELS[r.type])}</b>${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}</td>
        <td>${esc(r.street)}${r.located ? `<div class="note"><a href="https://maps.google.com/?q=${r.latitude},${r.longitude}">View on map</a></div>` : ''}</td>
        <td class="num">${r.votes}</td>
        <td>${esc(STATUS[r.status].label)}</td>
        <td>${new Date(r.createdAt).toLocaleDateString('en-US')}</td>
      </tr>`
    )
    .join('');

  // How many reports of each type, as a simple list.
  const typeCounts = ISSUE_TYPES.filter((t) => t !== 'none')
    .map((t) => ({ t, n: reports.filter((r) => r.type === t).length }))
    .filter((x) => x.n > 0)
    .map((x) => `<li>${esc(TYPE_LABELS[x.t])}: <b>${x.n}</b></li>`)
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1B1F23; margin: 32px; font-size: 12px; }
  h1 { font-size: 22px; margin: 0; }
  .sub { color: #555D66; margin: 4px 0 20px; }
  .stats { display: flex; gap: 10px; margin-bottom: 20px; }
  .stat { flex: 1; border: 1px solid #E3E5DF; border-radius: 8px; padding: 10px; }
  .stat b { display: block; font-size: 22px; }
  h2 { font-size: 15px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #F5F6F3; font-size: 11px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #E3E5DF; vertical-align: top; }
  .num { text-align: center; font-weight: bold; }
  .note { color: #555D66; font-size: 11px; margin-top: 2px; }
  a { color: #1A4E8A; }
  .foot { color: #555D66; font-size: 10px; margin-top: 24px; border-top: 1px solid #E3E5DF; padding-top: 8px; }
</style></head>
<body>
  <h1>Community Issues Summary: ${esc(monthLabel(now))}</h1>
  <div class="sub">Reported by residents using ${APP_NAME}. Prepared ${now.toLocaleDateString('en-US')}.</div>

  <div class="stats">
    <div class="stat"><b>${open.length}</b>Still open</div>
    <div class="stat"><b>${newThisMonth}</b>New this month</div>
    <div class="stat"><b>${sent}</b>Sent to township</div>
    <div class="stat"><b>${fixed}</b>Fixed</div>
  </div>

  <h2>Open issues, ranked by neighbor upvotes</h2>
  ${
    ranked.length
      ? `<table>
    <tr><th>#</th><th>Issue</th><th>Location</th><th>Upvotes</th><th>Status</th><th>Reported</th></tr>
    ${rows}
  </table>`
      : '<p>No open issues right now.</p>'
  }

  ${typeCounts ? `<h2>All reports by type</h2><ul>${typeCounts}</ul>` : ''}

  <div class="foot">
    Issue types were identified by an AI image model and confirmed by the resident who reported them.
    Upvotes show how many neighbors confirmed each issue.
  </div>
</body></html>`;
}

// Makes the PDF and opens the share menu (email, messages, save to Files...).
// In a web browser, it opens the print window instead, where "Save as PDF" works.
export async function shareSummary(reports: Report[]) {
  const html = buildSummaryHtml(reports);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share summary' });
}

// Makes the PDF and opens an email to the township with it attached.
// Returns false if email isn't available (browser, or no email account set up),
// so the screen can fall back to sharing.
export async function emailSummary(reports: Report[], townshipEmail: string) {
  if (Platform.OS === 'web' || !(await MailComposer.isAvailableAsync())) return false;
  const { uri } = await Print.printToFileAsync({ html: buildSummaryHtml(reports) });
  const open = reports.filter((r) => r.status !== 'fixed').length;
  await MailComposer.composeAsync({
    recipients: townshipEmail ? [townshipEmail] : [],
    subject: `Community issues summary: ${monthLabel()}`,
    body: `Hello,\n\nAttached is this month's summary of community-reported issues, with ${open} still open, ranked by how many neighbors confirmed each one.\n\nThank you,\nSent with ${APP_NAME}`,
    attachments: [uri],
  });
  return true;
}