# Pixel Map Studio

[Open the live tool](https://talal-aswaeer.github.io/Pixel-Map-Studio/)

A separate, local-first edition of Pixel Map Generator for Andrei Visuals. The original published project remains independent.

Serve this directory with `python3 -m http.server 8769 --bind 127.0.0.1`, then visit http://127.0.0.1:8769/. For static hosting, upload `index.html`, `studio.css`, `studio.js`, and the `images` directory together. No account is required. The included `standalone/Pixel-Map-Studio.html` (or regenerated `outputs/Pixel-Map-Studio.html`) is a standalone version with scripts, styles, and the logo embedded: you can open it directly or upload it as a single HTML file. Regenerate it after source edits with `python3 build-standalone.py`.

## Screens and layers

The existing LED-wall and custom-resolution screen calculations, placement, and test-card design are retained. The interface uses `#2596be` to match the screen labels.

Choose **Layers** to upload an image or add a red hatch mask. Each layer has its own size, position, visibility, and opacity. Drag a layer in the preview or enter X/Y positions in exported pixels, measured from the top left of the entire test card. Layers can cross screen boundaries. The list's top item is drawn last, on top of the others. Pixels are supported in both map modes; LED-wall mode also supports centimetres and metres using the first screen's export pixel density. A 0.5 cm size is literal, so it may be smaller than two pixels at a typical LED pitch.

Mask fill transparency is independent of the stroke and hatch lines. **Number of hatch lines** controls the amount from 0 to 2000; 0 keeps only the red fill and border. Once entered, this count stays fixed when the mask is resized. Older project files retain their original hatch spacing until the count is edited. Uploaded image layers and hatch masks snap to a 0.5 m grid while dragging in LED-wall mode. Disable **Snap movement to 0.5 m** or hold Shift to move freely; typed positions and exact sizes remain available. Snap preferences and hatch settings are preserved in `.tcmap` files and undo history. Fit card width preserves the layer's aspect ratio; height can then be set independently for a strip. Align bottom places it at the card's bottom edge. Layers are included in PNG and SVG output, clipped to the original card bounds.

## Undo and redo

Undo/redo restore document edits, deleted screens, deleted layers, and image assets. A drag or slider interaction is one edit. Use the buttons or Ctrl/Command+Z and Ctrl/Command+Shift+Z (Ctrl/Command+Y also redoes). Text inputs keep their normal text undo while focused. History keeps up to 80 document states; reopening the page starts a new history.

## Editable projects

**Save project** downloads a `.tcmap` file. **Open project** restores it for further editing. The version 1 format contains both LED and custom-resolution screen setups, layout settings, layers, labels, colors, opacity, and embedded image/logo assets. Shared images are embedded once. PNG/SVG exports are final images; `.tcmap` files retain the editable structure.

The format is JSON with `format: "andrei-test-card"`, `version: 1`, a `document`, and an `assets` table. Files are validated and all images decoded before the current document is changed. Unsupported versions and invalid files leave the current work intact. Opening a project can be undone. Project files do not include undo history or preview pan/zoom; the restored map is fitted to the preview.

Keep the `.tcmap` file to preserve your work: refreshing or closing the page does not automatically save a project.

## Local verification

Run `node tests/layers.cjs`, `node tests/history.cjs`, `node tests/projects.cjs`, and `node tests/mask-controls.cjs`. They verify original screen rendering and layer-free exports, overlay geometry and opacity in both modes, literal centimetre sizes, deletion recovery, redo, file round trips, embedded assets, and invalid-file handling.

Run `node tests/create-example.cjs` to create the `outputs/stage-example.tcmap` example mirrors the supplied three-screen layout: C 4096 × 1408, A 7424 × 1408, B 4096 × 1408, with a 7424 × 205 mask at X 4096 / Y 1203. Browser-generated `.tcmap`, PNG, and SVG files were saved and checked locally; the PNG and SVG dimensions are 15616 × 1408.
