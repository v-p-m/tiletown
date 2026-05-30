# TileTown 🏙️

An isometric grid-based city painter built with vanilla JavaScript and HTML5 Canvas.

## Files

```
tiletown/
tiletown/
├── index.html    ← Entry point, HTML structure, modals
├── css/
│   └── style.css     ← All styles and layout
└── js/
    ├── game.js       ← Main logic, constants, game loop, UI wiring
    ├── renderer.js   ← Canvas drawing (tiles, grid, hover)
    └── input.js      ← Mouse & touch handling, screen-to-grid math
```

## Run locally

Just open `index.html` in any modern browser. No build step, no dependencies.

## Deploy to GitHub Pages

1. Create a new repo on GitHub (e.g. `tiletown`)
2. Push all 5 files to the `main` branch
3. Go to **Settings → Pages → Source** → set branch to `main`, folder to `/ (root)`
4. Your game will be live at:
   `https://yourusername.github.io/tiletown`

> Note: The files use ES modules (`type="module"`), so they must be served over HTTP — opening `index.html` directly from disk works in most browsers but not all. GitHub Pages always serves over HTTP so it works perfectly there.

## Controls

| Action | How |
|---|---|
| Paint a tile | Click or drag |
| Erase a tile | Shift + click/drag |
| Save progress | Click **Export Save**, copy the code |
| Restore progress | Click **Import Save**, paste the code |
| Clear map | Click **Clear** |

## Zones

Empty · Water · Grass · Road · Sand · Forest · Rock · Snow

## Saving between sessions

- **Auto-save**: Map is saved to `localStorage` every 5 seconds automatically (persists across page refreshes, same browser)
- **Export/Import**: Use the buttons to get a portable save code you can store anywhere and reload later
