// input.js
// Mouse, touch, and keyboard input — including zoom/pan and paint.

import { COLS, ROWS, TW, TH } from "./game.js";

export function isValid(gx, gy) {
  return gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
}

/**
 * Convert raw canvas pixel coords → world coords (accounting for camera).
 * @param {number} px  Canvas pixel X
 * @param {number} py  Canvas pixel Y
 * @param {{ zoom, panX, panY }} camera
 */
export function canvasToWorld(px, py, camera) {
  return {
    x: (px - camera.panX) / camera.zoom,
    y: (py - camera.panY) / camera.zoom,
  };
}

/**
 * Convert world coords → grid cell.
 * Isometric formula: world coords are already in the "base" tile space.
 */
export function worldToGrid(wx, wy) {
  const gx = (wx / (TW / 2) + wy / (TH / 2)) / 2;
  const gy = (wy / (TH / 2) - wx / (TW / 2)) / 2;
  return { x: Math.floor(gx), y: Math.floor(gy) };
}

/**
 * Full pipeline: raw event → grid cell.
 * The renderer draws the grid with:
 *   ctx.setTransform(zoom, 0, 0, zoom, panX, panY)
 * and tile origins at (baseX + iso_offset, baseY + iso_offset)
 * where baseX = canvasW/2, baseY = 40.
 * To invert: canvas px → un-camera → subtract base origin → isometric inverse.
 */
export function eventToGrid(e, canvas, dims) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = dims.canvasW / rect.width;
  const scaleY = dims.canvasH / rect.height;
  const src = e.touches ? e.touches[0] : e;
  const px = (src.clientX - rect.left) * scaleX;
  const py = (src.clientY - rect.top) * scaleY;

  // 1. Undo camera transform
  const wx = (px - dims.camera.panX) / dims.camera.zoom;
  const wy = (py - dims.camera.panY) / dims.camera.zoom;

  // 2. Subtract base grid origin (must match renderer's baseX/baseY)
  const baseX = dims.canvasW / 2;
  const baseY = 40;
  const rx = wx - baseX;
  const ry = wy - baseY;

  // 3. Isometric inverse
  return worldToGrid(rx, ry);
}

/**
 * Attach all input listeners.
 *
 * Callbacks:
 *   onHover(gx, gy)          — mouse moved over a grid cell
 *   onPaintStart()            — stroke begins
 *   onPaint(gx, gy, erase)   — cell painted
 *   onPaintEnd()              — stroke ends
 *   onLeave()                 — mouse left canvas
 *   onZoom(delta, cx, cy)    — zoom request: delta>0 = in, cx/cy = canvas pivot
 *   onPanDelta(dx, dy)       — pan request in canvas pixels
 */
export function attachInput(
  canvas,
  dims,
  { onHover, onPaintStart, onPaint, onPaintEnd, onLeave, onZoom, onPanDelta },
) {
  let isPainting = false;
  let isPanning = false;
  let spaceDown = false;
  let lastPan = null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function canvasPt(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = dims.canvasW / rect.width;
    const scaleY = dims.canvasH / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function isPanTrigger(e) {
    return e.button === 1 || e.button === 2 || spaceDown;
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      spaceDown = true;
      canvas.style.cursor = "grab";
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      spaceDown = false;
      canvas.style.cursor = "crosshair";
    }
  });

  // ── Mouse ─────────────────────────────────────────────────────────────────
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", (e) => {
    if (isPanTrigger(e)) {
      isPanning = true;
      lastPan = canvasPt(e);
      canvas.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;
    isPainting = true;
    onPaintStart();
    const g = eventToGrid(e, canvas, dims);
    onPaint(g.x, g.y, e.shiftKey);
  });

  window.addEventListener("mousemove", (e) => {
    if (isPanning && lastPan) {
      const pt = canvasPt(e);
      onPanDelta(pt.x - lastPan.x, pt.y - lastPan.y);
      lastPan = pt;
      return;
    }
    const g = eventToGrid(e, canvas, dims);
    onHover(g.x, g.y);
    if (isPainting) onPaint(g.x, g.y, e.shiftKey);
  });

  window.addEventListener("mouseup", (e) => {
    if (isPanning) {
      isPanning = false;
      lastPan = null;
      canvas.style.cursor = spaceDown ? "grab" : "crosshair";
    }
    if (isPainting) {
      isPainting = false;
      onPaintEnd();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    if (!isPainting && !isPanning) onLeave();
  });

  // ── Scroll to zoom ────────────────────────────────────────────────────────
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const pt = canvasPt(e);
      const delta = e.deltaY < 0 ? 1 : -1;
      onZoom(delta, pt.x, pt.y);
    },
    { passive: false },
  );

  // ── Touch (paint) ─────────────────────────────────────────────────────────
  let lastTouchDist = null;
  let lastTouchMid = null;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch start
        const t1 = e.touches[0],
          t2 = e.touches[1];
        lastTouchDist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
        lastTouchMid = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        if (isPainting) {
          onPaintEnd();
          isPainting = false;
        }
        return;
      }
      isPainting = true;
      onPaintStart();
      const g = eventToGrid(e, canvas, dims);
      onPaint(g.x, g.y, false);
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const t1 = e.touches[0],
          t2 = e.touches[1];
        const dist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
        const mid = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        if (lastTouchDist) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = dims.canvasW / rect.width;
          const scaleY = dims.canvasH / rect.height;
          const cx = (mid.x - rect.left) * scaleX;
          const cy = (mid.y - rect.top) * scaleY;
          const ratio = dist / lastTouchDist;
          // Convert ratio to discrete steps for smooth feel
          onZoom((ratio - 1) * 5, cx, cy);
          onPanDelta(
            (mid.x - lastTouchMid.x) * scaleX,
            (mid.y - lastTouchMid.y) * scaleY,
          );
        }
        lastTouchDist = dist;
        lastTouchMid = mid;
        return;
      }
      const g = eventToGrid(e, canvas, dims);
      onHover(g.x, g.y);
      if (isPainting) onPaint(g.x, g.y, false);
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      lastTouchDist = null;
      lastTouchMid = null;
      if (isPainting) {
        onPaintEnd();
        isPainting = false;
      }
      onLeave();
    },
    { passive: false },
  );
}
