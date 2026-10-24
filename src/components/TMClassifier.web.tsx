// TMClassifier.web.tsx (browser version)
// In a web browser the Teachable Machine library can run directly on the page,
// so no hidden WebView is needed. Phones use TMClassifier.tsx instead.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MODEL_URL } from '../constants/fmb';
import { ClassifierHandle, PREP_IMAGE_JS, Prediction, TM_SCRIPTS, toIssueScores } from '../lib/classifier';

// Adds a script tag to the page and waits for it to load.
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Couldn't load ${src}`));
    document.head.appendChild(el);
  });
}

// prepImage comes from a shared string so both versions crop photos the same way.
const prepImage: (src: string) => Promise<HTMLCanvasElement> = new Function(
  `${PREP_IMAGE_JS}; return prepImage;`
)();

const TMClassifier = forwardRef<ClassifierHandle>(function TMClassifier(_props, ref) {
  const modelPromise = useRef<Promise<any> | null>(null);

  // Loads the libraries and the model once, when the Scan screen opens.
  const getModel = () => {
    if (!modelPromise.current) {
      modelPromise.current = (async () => {
        for (const src of TM_SCRIPTS) await loadScript(src); // tf.js must load first
        return (window as any).tmImage.load(MODEL_URL + 'model.json', MODEL_URL + 'metadata.json');
      })();
      // If loading fails, allow another try next time.
      modelPromise.current.catch(() => (modelPromise.current = null));
    }
    return modelPromise.current;
  };

  useEffect(() => {
    getModel().catch((e) => console.warn('Teachable Machine error:', e));
  }, []);

  // Gives scan.tsx a classify(photo) function it can call.
  useImperativeHandle(ref, () => ({
    classify: async (imageSrc: string) => {
      const model = await getModel();
      const preds: Prediction[] = await model.predict(await prepImage(imageSrc));
      return toIssueScores(preds);
    },
  }));

  return null; // nothing to show on screen
});

export default TMClassifier;