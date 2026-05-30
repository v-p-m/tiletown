# TileTown 🏙️

An isometric grid-based city painter built with vanilla JavaScript and HTML5 Canvas.

## Files

```
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
