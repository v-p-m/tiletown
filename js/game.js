// game.js
// Main entry point: constants, grid state, camera, undo/redo, UI, game loop.
const GAME_VERSION = "0.0.5";
// ── Imports ───────────────────────────────────────────────────────────────────
import { COLS, ROWS, TW, TH, WALL, ZONES, ZONE_MAP } from "./constants.js";
import { drawGrid, initRenderer } from "./renderer.js";
import { attachInput, isValid } from "./input.js";
import {
  beginStroke,
  recordCell,
  commitStroke,
  undo,
  redo,
  historyState,
} from "./history.js";
import { generateTerrain } from "./terrain.js";

// ── Canvas (WebGL2) ───────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = null; // WebGL renderer manages its own gl context

const camera = { zoom: 1, panX: 0, panY: 0 };
const ZOOM_MIN = 0.15,
  ZOOM_MAX = 6,
  ZOOM_STEP = 0.12;

const dims = { canvasW: 0, canvasH: 0, camera };

// WebGL redraws every frame (time uniform drives future animations)
// dirty flag still used to skip CPU work (instance buffer build) when nothing changed
let dirty = true;
export function markDirty() {
  dirty = true;
}

function resizeCanvas() {
  const sidebar = 200,
    padding = 32;
  dims.canvasW = Math.max(
    Math.min(window.innerWidth - sidebar - padding, 1100),
    400,
  );
  dims.canvasH = Math.max(Math.min(window.innerHeight - 80, 700), 300);
  canvas.width = dims.canvasW;
  canvas.height = dims.canvasH;
  dirty = true;
}
resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  fitCamera();
});

// Initialise WebGL renderer (must happen after canvas is sized)
initRenderer(canvas);

// ── Grid ──────────────────────────────────────────────────────────────────────
const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("empty"));
let hovered = null;
let currentZone = "grass";

// ── Camera helpers ────────────────────────────────────────────────────────────

/** Fit the entire map into the viewport at startup. */
function fitCamera() {
  // Map world extents in isometric space (base coords, zoom=1)
  // Rightmost point: gx=COLS-1, gy=0  → x = baseX + (COLS-1)*(TW/2)
  // Leftmost point:  gx=0, gy=ROWS-1  → x = baseX - (ROWS-1)*(TW/2)
  // Bottom point:    gx=COLS-1,gy=ROWS-1 → y = baseY + (COLS+ROWS-2)*(TH/2)
  const mapSpanX = (COLS + ROWS) * (TW / 2);
  const mapSpanY = (COLS + ROWS) * (TH / 2) + WALL;

  const fitZoom =
    Math.min(dims.canvasW / mapSpanX, dims.canvasH / mapSpanY) * 0.92; // small margin

  camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fitZoom));

  // Centre the map
  // In world space (zoom=1), the grid centre is at (baseX, baseY + (COLS+ROWS)/2*TH/2)
  // baseX = canvasW/2, baseY = 20
  const worldCentreX = dims.canvasW / 2;
  const worldCentreY = 20 + ((COLS + ROWS) / 2) * (TH / 2);

  camera.panX = dims.canvasW / 2 - worldCentreX * camera.zoom;
  camera.panY = dims.canvasH / 2 - worldCentreY * camera.zoom;

  updateZoomLabel();
  dirty = true;
}

function applyZoom(delta, cx, cy) {
  const newZoom = Math.min(
    ZOOM_MAX,
    Math.max(ZOOM_MIN, camera.zoom + delta * ZOOM_STEP),
  );
  camera.panX = cx - (cx - camera.panX) * (newZoom / camera.zoom);
  camera.panY = cy - (cy - camera.panY) * (newZoom / camera.zoom);
  camera.zoom = newZoom;
  updateZoomLabel();
  dirty = true;
}

function applyPan(dx, dy) {
  camera.panX += dx;
  camera.panY += dy;
  dirty = true;
}

function updateZoomLabel() {
  const el = document.getElementById("zoom-label");
  if (el) el.textContent = Math.round(camera.zoom * 100) + "%";
  document.getElementById("btn-zoom-in").disabled = camera.zoom >= ZOOM_MAX;
  document.getElementById("btn-zoom-out").disabled = camera.zoom <= ZOOM_MIN;
}

// ── Terrain generation ────────────────────────────────────────────────────────
function generateMap() {
  showToast("Generating terrain…");
  // Defer one frame so toast renders before the (sync) generation
  setTimeout(() => {
    const terrain = generateTerrain(COLS, ROWS);
    beginStroke();
    for (let gy = 0; gy < ROWS; gy++)
      for (let gx = 0; gx < COLS; gx++) {
        recordCell(grid, gx, gy, terrain[gy][gx]);
        grid[gy][gx] = terrain[gy][gx];
      }
    commitStroke();
    refreshHistoryButtons();
    dirty = true;
    showToast("Terrain generated");
  }, 30);
}

// ── Undo/redo ─────────────────────────────────────────────────────────────────
function refreshHistoryButtons() {
  const { canUndo, canRedo } = historyState();
  document.getElementById("btn-undo").disabled = !canUndo;
  document.getElementById("btn-redo").disabled = !canRedo;
}

// ── Paint ─────────────────────────────────────────────────────────────────────
function paint(gx, gy, erase) {
  if (!isValid(gx, gy)) return;
  const newZone = erase ? "empty" : currentZone;
  if (grid[gy][gx] === newZone) return; // no-op
  recordCell(grid, gx, gy, newZone);
  grid[gy][gx] = newZone;
  dirty = true;
}

// ── Input ─────────────────────────────────────────────────────────────────────
attachInput(canvas, dims, {
  onHover(gx, gy) {
    const prev = hovered;
    if (isValid(gx, gy)) {
      hovered = { x: gx, y: gy };
      document.getElementById("coord-display").innerHTML =
        `x: <strong>${gx}</strong><br>y: <strong>${gy}</strong><br>zone: <strong>${grid[gy][gx]}</strong>`;
    } else {
      hovered = null;
      document.getElementById("coord-display").innerHTML =
        "x: —<br>y: —<br>zone: —";
    }
    // Only dirty if hover cell changed
    if (
      !prev !== !hovered ||
      (prev && hovered && (prev.x !== hovered.x || prev.y !== hovered.y))
    )
      dirty = true;
  },
  onPaintStart() {
    beginStroke();
  },
  onPaint(gx, gy, erase) {
    paint(gx, gy, erase);
  },
  onPaintEnd() {
    commitStroke();
    refreshHistoryButtons();
  },
  onLeave() {
    hovered = null;
    document.getElementById("coord-display").innerHTML =
      "x: —<br>y: —<br>zone: —";
    dirty = true;
  },
  onZoom(delta, cx, cy) {
    applyZoom(delta, cx, cy);
  },
  onPanDelta(dx, dy) {
    applyPan(dx, dy);
  },
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "TEXTAREA") return;
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    if (undo(grid)) {
      refreshHistoryButtons();
      dirty = true;
      showToast("Undo");
    }
  }
  if (
    (e.ctrlKey || e.metaKey) &&
    (e.key === "y" || (e.key === "z" && e.shiftKey))
  ) {
    e.preventDefault();
    if (redo(grid)) {
      refreshHistoryButtons();
      dirty = true;
      showToast("Redo");
    }
  }
  if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    fitCamera();
  }
  if (e.key === "+" || e.key === "=")
    applyZoom(1, dims.canvasW / 2, dims.canvasH / 2);
  if (e.key === "-") applyZoom(-1, dims.canvasW / 2, dims.canvasH / 2);
});

// ── Zone palette ──────────────────────────────────────────────────────────────
const zoneGrid = document.getElementById("zone-grid");
ZONES.forEach((z) => {
  const btn = document.createElement("button");
  btn.className = "zone-btn" + (z.id === currentZone ? " active" : "");
  btn.dataset.id = z.id;
  btn.innerHTML = `<div class="swatch" style="background:${z.top}"></div>${z.label}`;
  btn.addEventListener("click", () => {
    currentZone = z.id;
    document
      .querySelectorAll(".zone-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
  zoneGrid.appendChild(btn);
});

// ── Stats (sampled every 2s, not every frame) ─────────────────────────────────
function updateStats() {
  const counts = {};
  ZONES.forEach((z) => {
    counts[z.id] = 0;
  });
  for (let gy = 0; gy < ROWS; gy++)
    for (let gx = 0; gx < COLS; gx++) counts[grid[gy][gx]]++;
  const el = document.getElementById("stats-display");
  const rows = ZONES.filter((z) => z.id !== "empty" && counts[z.id] > 0)
    .map(
      (z) =>
        `<div class="stat-row"><span class="k">${z.label}</span><span class="v">${counts[z.id]}</span></div>`,
    )
    .join("");
  el.innerHTML =
    rows ||
    '<div class="stat-row"><span class="k" style="font-size:10px">— paint some tiles —</span></div>';
}
setInterval(updateStats, 2000);

// ── Save / Load ───────────────────────────────────────────────────────────────
function gridToSave() {
  const rows = grid.map((row) =>
    row.map((z) => ZONES.findIndex((zz) => zz.id === z).toString(16)).join(""),
  );
  return JSON.stringify({ v: 2, cols: COLS, rows: ROWS, data: rows.join("|") });
}

function loadFromSave(str) {
  try {
    const s = JSON.parse(str);
    if (s.v !== 1 && s.v !== 2) throw new Error("Unknown version");
    const rows = s.data.split("|");
    for (let gy = 0; gy < Math.min(ROWS, rows.length); gy++)
      for (let gx = 0; gx < Math.min(COLS, rows[gy].length); gx++) {
        const idx = parseInt(rows[gy][gx], 16);
        if (ZONES[idx]) grid[gy][gx] = ZONES[idx].id;
      }
    dirty = true;
    return true;
  } catch {
    return false;
  }
}

function autosave() {
  try {
    localStorage.setItem("tiletown_autosave", gridToSave());
  } catch {}
}
function autoload() {
  // Clear old small-map save if it exists (v1 was 28×28)
  try {
    const raw = localStorage.getItem("tiletown_autosave");
    if (raw) {
      const s = JSON.parse(raw);
      if (s.v === 2 && loadFromSave(raw)) return;
    }
  } catch {}
  generateMap();
}
autoload();
setInterval(autosave, 5000);

// ── Header buttons ────────────────────────────────────────────────────────────
document
  .getElementById("btn-zoom-in")
  .addEventListener("click", () =>
    applyZoom(1, dims.canvasW / 2, dims.canvasH / 2),
  );
document
  .getElementById("btn-zoom-out")
  .addEventListener("click", () =>
    applyZoom(-1, dims.canvasW / 2, dims.canvasH / 2),
  );
document.getElementById("btn-zoom-reset").addEventListener("click", fitCamera);
document.getElementById("btn-generate").addEventListener("click", generateMap);

document.getElementById("btn-undo").addEventListener("click", () => {
  if (undo(grid)) {
    refreshHistoryButtons();
    dirty = true;
    showToast("Undo");
  }
});
document.getElementById("btn-redo").addEventListener("click", () => {
  if (redo(grid)) {
    refreshHistoryButtons();
    dirty = true;
    showToast("Redo");
  }
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Clear the entire map?")) return;
  beginStroke();
  for (let gy = 0; gy < ROWS; gy++)
    for (let gx = 0; gx < COLS; gx++) {
      recordCell(grid, gx, gy, "empty");
      grid[gy][gx] = "empty";
    }
  commitStroke();
  refreshHistoryButtons();
  dirty = true;
  showToast("Map cleared");
});

document.getElementById("btn-export").addEventListener("click", () => {
  document.getElementById("export-text").value = gridToSave();
  document.getElementById("modal-export").classList.add("open");
});
document
  .getElementById("btn-export-close")
  .addEventListener("click", () =>
    document.getElementById("modal-export").classList.remove("open"),
  );
document.getElementById("btn-copy-save").addEventListener("click", () => {
  const ta = document.getElementById("export-text");
  ta.select();
  navigator.clipboard
    .writeText(ta.value)
    .then(() => showToast("Copied!"))
    .catch(() => showToast("Select all and copy manually"));
});

document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-text").value = "";
  document.getElementById("modal-import").classList.add("open");
});
document
  .getElementById("btn-import-close")
  .addEventListener("click", () =>
    document.getElementById("modal-import").classList.remove("open"),
  );
document.getElementById("btn-do-import").addEventListener("click", () => {
  const str = document.getElementById("import-text").value.trim();
  if (loadFromSave(str)) {
    document.getElementById("modal-import").classList.remove("open");
    showToast("Map loaded!");
  } else {
    showToast("Invalid save code");
  }
});

document.querySelectorAll(".modal-bg").forEach((bg) =>
  bg.addEventListener("click", (e) => {
    if (e.target === bg) bg.classList.remove("open");
  }),
);

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
fitCamera();
updateZoomLabel();
refreshHistoryButtons();

// ── Game loop ─────────────────────────────────────────────────────────────────
// WebGL redraws every frame (cheap — GPU does the work).
// dirty flag still gates the CPU-side instance buffer rebuild.
function loop() {
  drawGrid(ctx, grid, hovered, dims, dirty);
  dirty = false;
  requestAnimationFrame(loop);
}
loop();
