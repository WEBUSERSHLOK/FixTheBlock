// classifier.ts
// Turns the Teachable Machine output into scores the app understands.

import { ISSUE_TYPES, IssueType } from '../constants/fmb';

// What Teachable Machine gives back for each class.
export type Prediction = { className: string; probability: number };

// The model's class names ("Sidewalk Damage", "Fallen Tree", ...) don't match
// our ids exactly, so match on a keyword instead. This also means the class
// order in Teachable Machine doesn't matter.
function labelToType(label: string): IssueType | null {
  const l = label.toLowerCase();
  if (l.includes('pothole')) return 'pothole';
  if (l.includes('sidewalk')) return 'sidewalk';
  if (l.includes('dump')) return 'dumping';
  if (l.includes('graffiti')) return 'graffiti';
  if (l.includes('tree')) return 'tree';
  if (l.includes('none')) return 'none';
  return null;
}

// Converts predictions into a list of percentages in the same order as
// ISSUE_TYPES, which is what the Scan screen's bars expect.
export function toIssueScores(predictions: Prediction[]): number[] {
  const scores = ISSUE_TYPES.map(() => 0);
  for (const p of predictions) {
    const type = labelToType(p.className);
    if (type) scores[ISSUE_TYPES.indexOf(type)] = Math.round(p.probability * 100);
  }
  return scores;
}

// The interface both versions of the classifier share (phone and web).
export type ClassifierHandle = {
  classify: (imageSrc: string) => Promise<number[]>;
};

// The script that loads the model and runs predictions. The phone version
// runs it inside a hidden WebView, and the web version runs it in the page.
// Library versions are pinned to ones that work with Teachable Machine models.
export const TM_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js',
];

// Draws the photo onto a 224x224 square (the size the model was trained on),
// cropping from the center so the subject stays in frame.
export const PREP_IMAGE_JS = `
async function prepImage(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  const size = 224;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}
`;