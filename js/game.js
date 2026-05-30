// game.js
// Main entry point: constants, grid state, camera, undo/redo, UI, game loop.

// ── Constants (exported for renderer.js and input.js) ────────────────────────
export const COLS = 28;
export const ROWS = 28;
export const TW = 36;
export const TH = 18;
export const WALL = 8;

export const ZONES = [
  {
    id: "empty",
    label: "Empty",
    top: "#3a3a4a",
    left: "#28282f",
    right: "#202028",
    wall: false,
  },
  {
    id: "water",
    label: "Water",
    top: "#5a8eaf",
    left: "#3d6e8f",
    right: "#2d5473",
    wall: true,
  },
  {
    id: "grass",
    label: "Grass",
    top: "#6b9e4d",
    left: "#4d7d33",
    right: "#3a6025",
    wall: true,
  },
  {
    id: "road",
    label: "Road",
    top: "#5c5855",
    left: "#3e3c3a",
    right: "#2e2c2a",
    wall: true,
  },
  {
    id: "sand",
    label: "Sand",
    top: "#c8a84e",
    left: "#a88a38",
    right: "#8a7028",
    wall: true,
  },
  {
    id: "forest",
    label: "Forest",
    top: "#3a6e30",
    left: "#275020",
    right: "#1c3a18",
    wall: true,
  },
  {
    id: "rock",
    label: "Rock",
    top: "#7a7068",
    left: "#5a5250",
    right: "#42403e",
    wall: true,
  },
  {
    id: "snow",
    label: "Snow",
    top: "#d8dce8",
    left: "#b0b8c8",
    right: "#9098a8",
    wall: true,
  },
];

export const ZONE_MAP = {};
ZONES.forEach((z) => {
  ZONE_MAP[z.id] = z;
});

// ── Imports ───────────────────────────────────────────────────────────────────
import { drawGrid } from "./renderer.js";
import { attachInput, isValid } from "./input.js";
import {
  beginStroke,
  recordCell,
  commitStroke,
  undo,
  redo,
  historyState,
} from "./history.js";

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Camera: zoom and pan in canvas-pixel space
const camera = { zoom: 1, panX: 0, panY: 0 };
const ZOOM_MIN = 0.3,
  ZOOM_MAX = 3,
  ZOOM_STEP = 0.15;

// dims is passed to input and renderer — they read it reactively
const dims = { canvasW: 0, canvasH: 0, camera };

function resizeCanvas() {
  const sidebar = 200,
    padding = 32;
  dims.canvasW = Math.max(
    Math.min(window.innerWidth - sidebar - padding, 900),
    400,
  );
  dims.canvasH = Math.max(Math.min(window.innerHeight - 100, 580), 300);
  canvas.width = dims.canvasW;
  canvas.height = dims.canvasH;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── Grid ──────────────────────────────────────────────────────────────────────
const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("empty"));
let hovered = null;
let currentZone = "grass";

// ── Zoom / pan helpers ────────────────────────────────────────────────────────
function applyZoom(delta, cx, cy) {
  const newZoom = Math.min(
    ZOOM_MAX,
    Math.max(ZOOM_MIN, camera.zoom + delta * ZOOM_STEP),
  );
  // Zoom around canvas point (cx, cy)
  camera.panX = cx - (cx - camera.panX) * (newZoom / camera.zoom);
  camera.panY = cy - (cy - camera.panY) * (newZoom / camera.zoom);
  camera.zoom = newZoom;
  updateZoomLabel();
}

function applyPan(dx, dy) {
  camera.panX += dx;
  camera.panY += dy;
}

function resetCamera() {
  camera.zoom = 1;
  camera.panX = 0;
  camera.panY = 0;
  updateZoomLabel();
}

function updateZoomLabel() {
  const el = document.getElementById("zoom-label");
  if (el) el.textContent = Math.round(camera.zoom * 100) + "%";
  document.getElementById("btn-zoom-in").disabled = camera.zoom >= ZOOM_MAX;
  document.getElementById("btn-zoom-out").disabled = camera.zoom <= ZOOM_MIN;
}

// ── Undo/redo UI refresh ──────────────────────────────────────────────────────
function refreshHistoryButtons() {
  const { canUndo, canRedo } = historyState();
  document.getElementById("btn-undo").disabled = !canUndo;
  document.getElementById("btn-redo").disabled = !canRedo;
}

// ── Paint ─────────────────────────────────────────────────────────────────────
function paint(gx, gy, erase) {
  if (!isValid(gx, gy)) return;
  const newZone = erase ? "empty" : currentZone;
  recordCell(grid, gx, gy, newZone);
  grid[gy][gx] = newZone;
}

// ── Input ─────────────────────────────────────────────────────────────────────
attachInput(canvas, dims, {
  onHover(gx, gy) {
    if (isValid(gx, gy)) {
      hovered = { x: gx, y: gy };
      document.getElementById("coord-display").innerHTML =
        `x: <strong>${gx}</strong><br>y: <strong>${gy}</strong><br>zone: <strong>${grid[gy][gx]}</strong>`;
    } else {
      hovered = null;
      document.getElementById("coord-display").innerHTML =
        "x: —<br>y: —<br>zone: —";
    }
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
  // Don't fire if user is typing in a textarea
  if (e.target.tagName === "TEXTAREA") return;
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    if (undo(grid)) {
      refreshHistoryButtons();
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
      showToast("Redo");
    }
  }
  if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    resetCamera();
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

// ── Stats ─────────────────────────────────────────────────────────────────────
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
setInterval(updateStats, 800);

// ── Save / Load ───────────────────────────────────────────────────────────────
function gridToSave() {
  const rows = grid.map((row) =>
    row.map((z) => ZONES.findIndex((zz) => zz.id === z).toString(16)).join(""),
  );
  return JSON.stringify({ v: 1, cols: COLS, rows: ROWS, data: rows.join("|") });
}

function loadFromSave(str) {
  try {
    const s = JSON.parse(str);
    if (s.v !== 1) throw new Error("Unknown version");
    const rows = s.data.split("|");
    for (let gy = 0; gy < Math.min(ROWS, rows.length); gy++)
      for (let gx = 0; gx < Math.min(COLS, rows[gy].length); gx++) {
        const idx = parseInt(rows[gy][gx], 16);
        if (ZONES[idx]) grid[gy][gx] = ZONES[idx].id;
      }
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
  try {
    const s = localStorage.getItem("tiletown_autosave");
    if (s) loadFromSave(s);
  } catch {}
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
document
  .getElementById("btn-zoom-reset")
  .addEventListener("click", resetCamera);

document.getElementById("btn-undo").addEventListener("click", () => {
  if (undo(grid)) {
    refreshHistoryButtons();
    showToast("Undo");
  }
});
document.getElementById("btn-redo").addEventListener("click", () => {
  if (redo(grid)) {
    refreshHistoryButtons();
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
    .then(() => showToast("Copied to clipboard!"))
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
    showToast("Invalid save code — check and try again");
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

// ── Init UI state ─────────────────────────────────────────────────────────────
updateZoomLabel();
refreshHistoryButtons();

// ── Game loop ─────────────────────────────────────────────────────────────────
function loop() {
  drawGrid(ctx, grid, hovered, dims);
  requestAnimationFrame(loop);
}
loop();
