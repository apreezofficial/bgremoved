import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime to load WASM binaries locally from the app's own origin
(ort.env.wasm as any).wasmPaths = {
  'ort-wasm-simd-threaded.wasm': `${location.origin}/onnx/ort-wasm-simd-threaded.wasm`,
};
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

let session: ort.InferenceSession | null = null;
let isInitializing = false;
let initPromise: Promise<ort.InferenceSession> | null = null;

const MODEL_PATH = '/models/u2netp.onnx';
const TARGET_SIZE = 320;

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

async function getOrCreateSession(): Promise<ort.InferenceSession> {
  if (session) return session;
  if (initPromise) return initPromise;

  isInitializing = true;
  postMessage({
    type: 'PROGRESS',
    stage: 'loading_model',
    percent: 15,
    message: 'Loading neural network model...',
  });

  initPromise = (async () => {
    try {
      const response = await fetch(MODEL_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load model file: ${response.statusText}`);
      }
      const modelBuffer = await response.arrayBuffer();
      const sess = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      session = sess;
      isInitializing = false;
      return sess;
    } catch (err) {
      isInitializing = false;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, imageData, width, height } = e.data;

  if (type === 'INIT') {
    try {
      await getOrCreateSession();
      postMessage({ type: 'INIT_DONE' });
    } catch (err: any) {
      postMessage({ type: 'ERROR', error: err.message || 'Failed to initialize session' });
    }
    return;
  }

  if (type === 'PROCESS') {
    try {
      const sess = await getOrCreateSession();

      postMessage({
        type: 'PROGRESS',
        id,
        stage: 'preprocessing',
        percent: 30,
        message: 'Preparing image...',
      });

      // 1. Resize input to 320x320 for U²-Netp
      const offscreenSmall = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
      const ctxSmall = offscreenSmall.getContext('2d')!;
      
      const offscreenOrig = new OffscreenCanvas(width, height);
      const ctxOrig = offscreenOrig.getContext('2d')!;
      ctxOrig.putImageData(imageData, 0, 0);

      ctxSmall.drawImage(offscreenOrig, 0, 0, TARGET_SIZE, TARGET_SIZE);
      const smallImgData = ctxSmall.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
      const smallPixels = smallImgData.data;

      // 2. Normalize and format to [1, 3, 320, 320] NCHW Float32Array
      const inputTensorData = new Float32Array(3 * TARGET_SIZE * TARGET_SIZE);
      const planeSize = TARGET_SIZE * TARGET_SIZE;

      for (let i = 0; i < planeSize; i++) {
        const r = smallPixels[i * 4] / 255.0;
        const g = smallPixels[i * 4 + 1] / 255.0;
        const b = smallPixels[i * 4 + 2] / 255.0;

        inputTensorData[i] = (r - MEAN[0]) / STD[0];
        inputTensorData[planeSize + i] = (g - MEAN[1]) / STD[1];
        inputTensorData[planeSize * 2 + i] = (b - MEAN[2]) / STD[2];
      }

      postMessage({
        type: 'PROGRESS',
        id,
        stage: 'inferring',
        percent: 60,
        message: 'Removing background...',
      });

      // 3. Inference
      const inputTensor = new ort.Tensor('float32', inputTensorData, [1, 3, TARGET_SIZE, TARGET_SIZE]);
      const feeds: Record<string, ort.Tensor> = {};
      feeds[sess.inputNames[0]] = inputTensor;

      const results = await sess.run(feeds);
      const outputTensor = results[sess.outputNames[0]];
      const maskData = outputTensor.data as Float32Array;

      postMessage({
        type: 'PROGRESS',
        id,
        stage: 'postprocessing',
        percent: 85,
        message: 'Refining cutout edges...',
      });

      // 4. Min-max normalize mask to [0, 1]
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = 0; i < maskData.length; i++) {
        const val = maskData[i];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
      const range = maxVal - minVal || 1.0;

      // Create 320x320 grayscale mask image
      const maskImgData = ctxSmall.createImageData(TARGET_SIZE, TARGET_SIZE);
      const maskPixels = maskImgData.data;

      for (let i = 0; i < maskData.length; i++) {
        const norm = (maskData[i] - minVal) / range;
        const gray = Math.round(norm * 255);
        const idx = i * 4;
        maskPixels[idx] = gray;
        maskPixels[idx + 1] = gray;
        maskPixels[idx + 2] = gray;
        maskPixels[idx + 3] = 255; // fully opaque mask canvas
      }

      ctxSmall.putImageData(maskImgData, 0, 0);

      // 5. Upscale mask back to original resolution
      const offscreenMaskLarge = new OffscreenCanvas(width, height);
      const ctxMaskLarge = offscreenMaskLarge.getContext('2d')!;
      ctxMaskLarge.imageSmoothingEnabled = true;
      ctxMaskLarge.imageSmoothingQuality = 'high';
      ctxMaskLarge.drawImage(offscreenSmall, 0, 0, width, height);

      const upscaledMaskData = ctxMaskLarge.getImageData(0, 0, width, height);
      const upscaledMaskPixels = upscaledMaskData.data;

      // 6. Apply upscaled mask as alpha channel to full-res original
      const resultImageData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        width,
        height
      );
      const resultPixels = resultImageData.data;

      for (let i = 0; i < resultPixels.length; i += 4) {
        // Red channel of upscaled mask holds the gray value (0-255)
        const maskAlpha = upscaledMaskPixels[i] / 255.0;
        // Multiply original alpha by mask alpha
        resultPixels[i + 3] = Math.round(resultPixels[i + 3] * maskAlpha);
      }

      postMessage({
        type: 'PROGRESS',
        id,
        stage: 'done',
        percent: 100,
        message: 'Complete',
      });

      postMessage(
        {
          type: 'SUCCESS',
          id,
          resultImageData,
          width,
          height,
        },
        [resultImageData.data.buffer]
      );
    } catch (err: any) {
      postMessage({
        type: 'ERROR',
        id,
        error: err.message || 'Inference failed',
      });
    }
  }
};
