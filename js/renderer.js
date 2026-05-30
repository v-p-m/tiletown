// renderer.js
// Handles all canvas drawing: grid, tiles, hover highlight.

import { ZONES, ZONE_MAP, COLS, ROWS, TW, TH, WALL } from './game.js';

export const HOVER_COLOR = {
  top:  '#f0d060',
  left: '#c8a830',
  right:'#a88818',
  wall: true,
};

/**
 * Convert grid coordinates to screen (canvas) coordinates.
 * @param {number} gx  Grid column
 * @param {number} gy  Grid row
 * @param {number} offsetX  Horizontal canvas offset
 * @param {number} offsetY  Vertical canvas offset
 */
export function gridToScreen(gx, gy, offsetX, offsetY) {
  return {
    x: offsetX + (gx - gy) * (TW / 2),
    y: offsetY + (gx + gy) * (TH / 2),
  };
}

/**
 * Draw a single isometric tile (top face + optional side walls).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx  Screen X (center of tile)
 * @param {number} sy  Screen Y (top point of tile)
 * @param {{ top, left, right, wall }} color
 */
export function drawTile(ctx, sx, sy, color) {
  const hw = TW / 2;
  const hh = TH / 2;

  // Top face (diamond)
  ctx.beginPath();
  ctx.moveTo(sx,      sy);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx,      sy + TH);
  ctx.lineTo(sx - hw, sy + hh);
  ctx.closePath();
  ctx.fillStyle = color.top;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  if (!color.wall) return;

  // Left face
  ctx.beginPath();
  ctx.moveTo(sx - hw, sy + hh);
  ctx.lineTo(sx,      sy + TH);
  ctx.lineTo(sx,      sy + TH + WALL);
  ctx.lineTo(sx - hw, sy + hh + WALL);
  ctx.closePath();
  ctx.fillStyle = color.left;
  ctx.fill();
  ctx.stroke();

  // Right face
  ctx.beginPath();
  ctx.moveTo(sx,      sy + TH);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx + hw, sy + hh + WALL);
  ctx.lineTo(sx,      sy + TH + WALL);
  ctx.closePath();
  ctx.fillStyle = color.right;
  ctx.fill();
  ctx.stroke();
}

/**
 * Draw the full grid.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string[][]} grid
 * @param {{ x: number, y: number } | null} hovered
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawGrid(ctx, grid, hovered, offsetX, offsetY, canvasW, canvasH) {
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(0, 0, canvasW, canvasH);

  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const isHov = hovered && hovered.x === gx && hovered.y === gy;
      const color = isHov ? HOVER_COLOR : ZONE_MAP[grid[gy][gx]];
      const { x, y } = gridToScreen(gx, gy, offsetX, offsetY);
      drawTile(ctx, x, y, color);
    }
  }
}
