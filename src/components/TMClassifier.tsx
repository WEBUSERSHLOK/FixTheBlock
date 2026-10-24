// TMClassifier.tsx (phone version)
// React Native can't run the Teachable Machine library directly, since it needs
// a web browser. So this hides a tiny invisible browser (a WebView) in the
// screen, loads the model inside it, and passes photos back and forth.
// The browser version of the app uses TMClassifier.web.tsx instead.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ComponentType, Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { MODEL_URL } from '../constants/fmb';
import { ClassifierHandle, PREP_IMAGE_JS, Prediction, TM_SCRIPTS, toIssueScores } from '../lib/classifier';

// The page that runs inside the WebView. It loads the model once, then waits
// for photos. Results go back to the app with postMessage.
const html = `<!doctype html><html><head><meta charset="utf-8">
${TM_SCRIPTS.map((src) => `<script src="${src}"></script>`).join('\n')}
</head><body><script>
const URL = ${JSON.stringify(MODEL_URL)};
function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
${PREP_IMAGE_JS}
const ready = tmImage.load(URL + 'model.json', URL + 'metadata.json')
  .then((m) => { post({ type: 'ready' }); return m; })
  .catch((e) => { post({ type: 'error', message: String(e) }); throw e; });
window.classify = async (id, src) => {
  try {
    const model = await ready;
    const preds = await model.predict(await prepImage(src));
    post({ type: 'result', id, predictions: preds.map((p) => ({ className: p.className, probability: p.probability })) });
  } catch (e) {
    post({ type: 'error', id, message: String(e) });
  }
};
</script></body></html>`;

// The WebView package's built-in types don't work with newer React versions
// (every prop shows up as 'never'), so we describe the parts we use ourselves.
// This only affects TypeScript checking, not how the app runs.
type WebViewHandle = { injectJavaScript: (js: string) => void };
const HiddenWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

type Pending = { resolve: (s: number[]) => void; reject: (e: Error) => void };

const TMClassifier = forwardRef<ClassifierHandle>(function TMClassifier(_props, ref) {
  const webRef = useRef<WebViewHandle>(null);
  // Photos waiting for an answer, matched up by id.
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);

  // Gives scan.tsx a classify(photo) function it can call.
  useImperativeHandle(ref, () => ({
    classify: (imageSrc: string) =>
      new Promise<number[]>((resolve, reject) => {
        const id = nextId.current++;
        pending.current.set(id, { resolve, reject });
        webRef.current?.injectJavaScript(`window.classify(${id}, ${JSON.stringify(imageSrc)}); true;`);
        // Give up if the model doesn't answer (for example, no internet).
        setTimeout(() => {
          if (pending.current.delete(id)) reject(new Error('The AI model took too long to respond.'));
        }, 25000);
      }),
  }));

  // Handles messages coming back from the WebView.
  const onMessage = (e: WebViewMessageEvent) => {
    const msg = JSON.parse(e.nativeEvent.data);
    if (msg.type === 'ready') return;
    const job = msg.id ? pending.current.get(msg.id) : undefined;
    if (msg.type === 'result' && job) {
      pending.current.delete(msg.id);
      job.resolve(toIssueScores(msg.predictions as Prediction[]));
    } else if (msg.type === 'error') {
      console.warn('Teachable Machine error:', msg.message);
      if (job) {
        pending.current.delete(msg.id);
        job.reject(new Error(msg.message));
      }
    }
  };

  return (
    <View style={s.hidden} pointerEvents="none">
      <HiddenWebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost/' }}
        onMessage={onMessage}
        javaScriptEnabled
      />
    </View>
  );
});

export default TMClassifier;

// Keeps the WebView on screen (so it keeps running) but invisible.
const s = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
});