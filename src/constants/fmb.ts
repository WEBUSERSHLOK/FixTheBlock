// fmb.ts
// Shared settings for the whole app: colors, the issue types the AI can
// detect, and the report statuses. Other files import from here instead of
// repeating these values.

// App color palette. Every screen pulls colors from here so the look stays
// consistent, and changing a color in one place updates the whole app.
export const C = {
  ground: '#F5F6F3',
  card: '#FFFFFF',
  border: '#E3E5DF',
  ink: '#1B1F23',
  muted: '#555D66',
  blue: '#1A4E8A',
  blueSoft: '#E3ECF7',
  orange: '#C2560E',
  orangeText: '#9A3A07',
  orangeSoft: '#FDECDF',
  green: '#1E6B3A',
  greenPin: '#4E9A68',
  greenSoft: '#E2F1E6',
  track: '#ECEEE9',
};

// The kinds of problems the AI model can detect. These line up with the
// classes in the Teachable Machine model (Pothole, Sidewalk, Dumping,
// Graffiti, Tree, None). 'none' means the photo doesn't show a problem.
export const ISSUE_TYPES = ['pothole', 'sidewalk', 'dumping', 'graffiti', 'tree', 'none'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

// The friendly names shown to users for each issue type.
export const TYPE_LABELS: Record<IssueType, string> = {
  pothole: 'Pothole',
  sidewalk: 'Damaged sidewalk',
  dumping: 'Illegal dumping',
  graffiti: 'Graffiti',
  tree: 'Fallen tree',
  none: 'No issue',
};

// Every report moves through three stages:
// open (just posted) -> reported (sent to the township) -> fixed.
export type Status = 'open' | 'reported' | 'fixed';

// Label and colors for each stage, used for the status pills and map pins.
export const STATUS: Record<Status, { label: string; bg: string; fg: string; pin: string }> = {
  open: { label: 'Open', bg: C.orangeSoft, fg: C.orangeText, pin: C.orange },
  reported: { label: 'Sent to town', bg: C.blueSoft, fg: C.blue, pin: C.blue },
  fixed: { label: 'Fixed', bg: C.greenSoft, fg: C.green, pin: C.greenPin },
};

// Link to the trained Teachable Machine model. Must end with a slash.
// Either the link from Teachable Machine's "Upload my model" button, or the
// folder where model.json, metadata.json, and weights.bin are hosted.
export const MODEL_URL = 'https://raw.githubusercontent.com/WEBUSERSHLOK/FixTheBlock/main/model/';

// Where the map starts. Fallback spot for reports when location isn't shared.
// TODO: set this to the center of your town so the map opens in the right place.
export const MAP_CENTER = { latitude: 39.8283, longitude: -98.5795 };