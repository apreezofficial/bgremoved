# bgremoved-web

Desktop web version of bgremoved (the mobile app in `../bgremoved` is untouched).
Same offline U²-Netp engine (ONNX WASM in a Web Worker), same dark + lime design language,
with a desktop editor layout modelled on the Erase BG Editor shot: top nav, tool list,
Background panel (colours, custom colour picker with gradients, textures), and a canvas stage
with Undo / Redo / Compare and a zoom slider.

- Drag & drop, click to browse, or paste (⌘/Ctrl+V) an image
- Add BG, Erase, Brush (restore), Wand, Crop, Rotate, Flip, Pan, Zoom; Compare slider
- Undo / redo (⌘Z / ⇧⌘Z) including crop/rotate/flip, scroll to zoom, hold Space to pan; keys G E B W C R F H Z, `[` `]` brush size
- Export composed / cutout / backdrop as PNG or JPG
- Recents stored locally in IndexedDB. Nothing is uploaded.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — host anywhere
```
