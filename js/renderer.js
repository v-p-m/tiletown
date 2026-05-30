// renderer.js
// All canvas drawing with camera (zoom + pan) support.

import { ZONE_MAP, COLS, ROWS, TW, TH, WALL } from "./game.js";

export const HOVER_COLOR = {
  top: "#f0d060",
  left: "#c8a830",
  right: "#a88818",
  wall: true,
};

/**
 * Grid cell → world-space screen position (before camera transform).
 * The camera transform is applied via ctx.setTransform, so this just
 * returns the untransformed isometric position.
 */
export function gridToWorld(gx, gy, baseX, baseY) {
  return {
    x: baseX + (gx - gy) * (TW / 2),
    y: baseY + (gx + gy) * (TH / 2),
  };
}

/**
 * Draw one isometric tile at world coords (sx, sy).
 */
export function drawTile(ctx, sx, sy, color) {
  const hw = TW / 2;
  const hh = TH / 2;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx, sy + TH);
  ctx.lineTo(sx - hw, sy + hh);
  ctx.closePath();
  ctx.fillStyle = color.top;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
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
 * Draw the full grid, applying the camera transform.
 */
export function drawGrid(ctx, grid, hovered, dims) {
  const { canvasW, canvasH, camera } = dims;
  // Base world origin (grid centre before camera)
  const baseX = canvasW / 2;
  const baseY = 40;

  // Clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Apply camera: pan then zoom around (0,0)
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.panX, camera.panY);

  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const isHov = hovered && hovered.x === gx && hovered.y === gy;
      const color = isHov ? HOVER_COLOR : ZONE_MAP[grid[gy][gx]];
      const { x, y } = gridToWorld(gx, gy, baseX, baseY);
      drawTile(ctx, x, y, color);
    }
  }

  // Reset transform for any HUD drawing
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
