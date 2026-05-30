// game.js
// Main entry point: constants, grid state, UI wiring, game loop.
const GAME_VERSION = "0.0.1";
// ── Constants (exported for use in renderer.js and input.js) ──────────────────
export const COLS = 28;
export const ROWS = 28;
export const TW = 36; // tile width
export const TH = 18; // tile height
export const WALL = 8; // side wall height

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

// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Reactive dimensions object — renderer and input read from this each frame/event
const dims = { canvasW: 0, canvasH: 0, offsetX: 0, offsetY: 40 };

function resizeCanvas() {
  const sidebar = 200;
  const padding = 32;
  const maxW = Math.min(window.innerWidth - sidebar - padding, 900);
  const maxH = Math.min(window.innerHeight - 100, 580);
  dims.canvasW = Math.max(maxW, 400);
  dims.canvasH = Math.max(maxH, 300);
  dims.offsetX = dims.canvasW / 2;
  canvas.width = dims.canvasW;
  canvas.height = dims.canvasH;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── Grid state ────────────────────────────────────────────────────────────────
const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("empty"));

let hovered = null;
let currentZone = "grass";

// ── Paint helper ──────────────────────────────────────────────────────────────
function paint(gx, gy, erase) {
  if (!isValid(gx, gy)) return;
  grid[gy][gx] = erase ? "empty" : currentZone;
}

// ── Input ─────────────────────────────────────────────────────────────────────
attachInput(
  canvas,
  dims,
  // onHover
  (gx, gy) => {
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
  // onPaint
  (gx, gy, erase) => paint(gx, gy, erase),
  // onLeave
  () => {
    hovered = null;
    document.getElementById("coord-display").innerHTML =
      "x: —<br>y: —<br>zone: —";
  },
);

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

// ── Stats panel ───────────────────────────────────────────────────────────────
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
    for (let gy = 0; gy < Math.min(ROWS, rows.length); gy++) {
      for (let gx = 0; gx < Math.min(COLS, rows[gy].length); gx++) {
        const idx = parseInt(rows[gy][gx], 16);
        if (ZONES[idx]) grid[gy][gx] = ZONES[idx].id;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Auto-save / auto-load via localStorage
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

// ── UI: Clear ─────────────────────────────────────────────────────────────────
document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Clear the entire map?")) return;
  for (let gy = 0; gy < ROWS; gy++)
    for (let gx = 0; gx < COLS; gx++) grid[gy][gx] = "empty";
  showToast("Map cleared");
});

// ── UI: Export modal ──────────────────────────────────────────────────────────
document.getElementById("btn-export").addEventListener("click", () => {
  document.getElementById("export-text").value = gridToSave();
  document.getElementById("modal-export").classList.add("open");
});
document.getElementById("btn-export-close").addEventListener("click", () => {
  document.getElementById("modal-export").classList.remove("open");
});
document.getElementById("btn-copy-save").addEventListener("click", () => {
  const ta = document.getElementById("export-text");
  ta.select();
  navigator.clipboard
    .writeText(ta.value)
    .then(() => showToast("Copied to clipboard!"))
    .catch(() => showToast("Select all and copy manually"));
});

// ── UI: Import modal ──────────────────────────────────────────────────────────
document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-text").value = "";
  document.getElementById("modal-import").classList.add("open");
});
document.getElementById("btn-import-close").addEventListener("click", () => {
  document.getElementById("modal-import").classList.remove("open");
});
document.getElementById("btn-do-import").addEventListener("click", () => {
  const str = document.getElementById("import-text").value.trim();
  if (loadFromSave(str)) {
    document.getElementById("modal-import").classList.remove("open");
    showToast("Map loaded!");
  } else {
    showToast("Invalid save code — check and try again");
  }
});

// Close modals on backdrop click
document.querySelectorAll(".modal-bg").forEach((bg) => {
  bg.addEventListener("click", (e) => {
    if (e.target === bg) bg.classList.remove("open");
  });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function loop() {
  drawGrid(
    ctx,
    grid,
    hovered,
    dims.offsetX,
    dims.offsetY,
    dims.canvasW,
    dims.canvasH,
  );
  requestAnimationFrame(loop);
}
loop();
