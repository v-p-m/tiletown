// renderer.js
// Draws the isometric grid with camera transform and viewport culling.
// Only tiles visible within the current canvas viewport are drawn.

import { ZONE_MAP, COLS, ROWS, TW, TH, WALL } from "./game.js";

export const HOVER_COLOR = {
  top: "#f0d060",
  left: "#c8a830",
  right: "#a88818",
  wall: true,
};

/** Grid cell → world position (before camera). */
export function gridToWorld(gx, gy, baseX, baseY) {
  return {
    x: baseX + (gx - gy) * (TW / 2),
    y: baseY + (gx + gy) * (TH / 2),
  };
}

/** Draw one isometric tile. */
function drawTile(ctx, sx, sy, color) {
  const hw = TW / 2,
    hh = TH / 2;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx, sy + TH);
  ctx.lineTo(sx - hw, sy + hh);
  ctx.closePath();
  ctx.fillStyle = color.top;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  if (!color.wall) return;

  ctx.beginPath();
  ctx.moveTo(sx - hw, sy + hh);
  ctx.lineTo(sx, sy + TH);
  ctx.lineTo(sx, sy + TH + WALL);
  ctx.lineTo(sx - hw, sy + hh + WALL);
  ctx.closePath();
  ctx.fillStyle = color.left;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(sx, sy + TH);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx + hw, sy + hh + WALL);
  ctx.lineTo(sx, sy + TH + WALL);
  ctx.closePath();
  ctx.fillStyle = color.right;
  ctx.fill();
  ctx.stroke();
}

/**
 * Compute the visible grid cell range given the current camera.
 * We invert the camera transform to find which world coords map to the
 * canvas corners, then clamp to grid bounds.
 *
 * Isometric inverse (world → grid):
 *   wx = baseX + (gx - gy) * TW/2  →  gx - gy = (wx - baseX) / (TW/2)
 *   wy = baseY + (gx + gy) * TH/2  →  gx + gy = (wy - baseY) / (TH/2)
 *   gx = ((gx-gy) + (gx+gy)) / 2
 *   gy = ((gx+gy) - (gx-gy)) / 2
 */
function getVisibleRange(canvasW, canvasH, camera, baseX, baseY) {
  // Canvas corners in world space
  const corners = [
    [0, 0],
    [canvasW, 0],
    [0, canvasH],
    [canvasW, canvasH],
  ].map(([px, py]) => ({
    wx: (px - camera.panX) / camera.zoom,
    wy: (py - camera.panY) / camera.zoom,
  }));

  let minGx = Infinity,
    maxGx = -Infinity;
  let minGy = Infinity,
    maxGy = -Infinity;

  for (const { wx, wy } of corners) {
    const rx = wx - baseX,
      ry = wy - baseY;
    const sum = ry / (TH / 2);
    const diff = rx / (TW / 2);
    const gx = (sum + diff) / 2;
    const gy = (sum - diff) / 2;
    minGx = Math.min(minGx, gx);
    maxGx = Math.max(maxGx, gx);
    minGy = Math.min(minGy, gy);
    maxGy = Math.max(maxGy, gy);
  }

  // Add padding of 2 tiles so edges don't pop in/out
  const pad = 2;
  return {
    gxMin: Math.max(0, Math.floor(minGx) - pad),
    gxMax: Math.min(COLS - 1, Math.ceil(maxGx) + pad),
    gyMin: Math.max(0, Math.floor(minGy) - pad),
    gyMax: Math.min(ROWS - 1, Math.ceil(maxGy) + pad),
  };
}

/** Draw the visible portion of the grid. */
export function drawGrid(ctx, grid, hovered, dims) {
  const { canvasW, canvasH, camera } = dims;
  const baseX = canvasW / 2;
  const baseY = 20;

  // Clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Apply camera
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.panX, camera.panY);

  // Cull to visible range
  const { gxMin, gxMax, gyMin, gyMax } = getVisibleRange(
    canvasW,
    canvasH,
    camera,
    baseX,
    baseY,
  );

  // Draw painter's order: top-left → bottom-right in iso space (gy then gx)
  for (let gy = gyMin; gy <= gyMax; gy++) {
    for (let gx = gxMin; gx <= gxMax; gx++) {
      const isHov = hovered && hovered.x === gx && hovered.y === gy;
      const color = isHov ? HOVER_COLOR : ZONE_MAP[grid[gy][gx]];
      const { x, y } = gridToWorld(gx, gy, baseX, baseY);
      drawTile(ctx, x, y, color);
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
