# bgremoved

A fully offline, on-device background remover Android app built with Vite, React, TypeScript, Capacitor 6, and onnxruntime-web running U²-Netp in a Web Worker.

Zero server dependencies. Zero API keys. Operates 100% offline in airplane mode.

## Features

- **Auto Remove**: Instant on-device neural network background removal with progress tracking.
- **Custom Editing Tools**:
  - **Erase & Restore Brush**: Adjustable size (6–120px) and softness (0–100%) to refine or restore details from the full-resolution source image.
  - **Magic Wand**: Tap to erase contiguous color regions with a configurable tolerance slider.
  - **Undo / Redo**: History tracking supporting up to 30 steps.
  - **Pinch-to-zoom & Pan**: Precise inspection and editing gestures.
- **Backdrop Compositing**:
  - Transparent canvas (with checkerboard preview).
  - Solid colors (hex picker + curated flat palette).
  - Custom image background from photo gallery.
  - Move, scale, and rotate cutout over the new backdrop.
- **Export**:
  - Export **Cutout Only** (transparent PNG), **Composed Image** (PNG or JPG), or **Backdrop Only**.
  - Save directly to device storage / gallery via Capacitor Filesystem.
  - System Share sheet via Capacitor Share.
- **Local Recents**: On-device edit history stored locally via IndexedDB with delete functionality.

## Design Philosophy

- **Near-black (#0B0B0C)** canvas with off-white typography and a single sharp lime accent (`#C6FF3D`).
- **No gradients** anywhere; flat colors, 12px radii, and 1px hairline borders (`#27272A`).
- **Space Grotesk** typography bundled locally for offline rendering.
- Thumb-reachable bottom toolbar and native-feeling touch gestures.

## Architecture & Performance

- **Model**: Bundled quantized U²-Netp ONNX model (~4.36 MB) stored in `/public/models/u2netp.onnx`.
- **WASM Backend**: Bundled local ONNX Runtime WebAssembly binaries in `/public/onnx/` loaded without any CDN or external network requests.
- **Web Worker**: Neural network execution runs off the main thread in a dedicated Web Worker to prevent UI lockup.
- **Session Reuse**: ONNX session is initialized once and reused across all subsequent background removals.
- **High Resolution Masking**: Inputs are scaled to 320×320 for U²-Netp inference, after which the predicted mask is upscaled and applied directly to the full-resolution source image.

## How to Build Locally

### Prerequisites
- Node.js 20+
- JDK 17
- Android SDK (command-line tools or Android Studio)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Build the web app
npm run build

# 3. Sync web assets with Capacitor Android
npx cap sync android

# 4. Build the Android debug APK
cd android
./gradlew assembleDebug
```

The compiled APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Where to Download the APK

1. **GitHub Releases**: Download pre-built release APKs from [GitHub Releases](https://github.com/apreezofficial/bgremoved/releases).
2. **GitHub Actions Artifacts**: For the latest commits, download the `bgremoved-apk` artifact from the **Actions** tab on [GitHub Actions](https://github.com/apreezofficial/bgremoved/actions).
