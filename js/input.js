// input.js
// Mouse and touch event handling, screen-to-grid conversion.

import { COLS, ROWS, TW, TH } from './game.js';

/**
 * Convert screen (canvas) coordinates to grid coordinates.
 * @param {number} sx  Screen X relative to canvas
 * @param {number} sy  Screen Y relative to canvas
 * @param {number} offsetX
 * @param {number} offsetY
 * @returns {{ x: number, y: number }}
 */
export function screenToGrid(sx, sy, offsetX, offsetY) {
  const rx = sx - offsetX;
  const ry = sy - offsetY;
  const gx = (rx / (TW / 2) + ry / (TH / 2)) / 2;
  const gy = (ry / (TH / 2) - rx / (TW / 2)) / 2;
  return { x: Math.floor(gx), y: Math.floor(gy) };
}

/**
 * Check if a grid cell is within bounds.
 */
export function isValid(gx, gy) {
  return gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
}

/**
 * Get grid position from a mouse or touch event, accounting for canvas scaling.
 * @param {MouseEvent|TouchEvent} e
 * @param {HTMLCanvasElement} canvas
 * @param {number} canvasW  Logical canvas width
 * @param {number} canvasH  Logical canvas height
 * @param {number} offsetX
 * @param {number} offsetY
 */
export function getGridPos(e, canvas, canvasW, canvasH, offsetX, offsetY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvasW / rect.width;
  const scaleY = canvasH / rect.height;
  const src = e.touches ? e.touches[0] : e;
  const sx = (src.clientX - rect.left) * scaleX;
  const sy = (src.clientY - rect.top)  * scaleY;
  return screenToGrid(sx, sy, offsetX, offsetY);
}

/**
 * Attach all input listeners to the canvas.
 * Calls onHover(gx, gy) and onPaint(gx, gy, erase) as appropriate.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ canvasW, canvasH, offsetX, offsetY }} dims  Reactive object (read each event)
 * @param {(gx,gy) => void} onHover
 * @param {(gx,gy,erase) => void} onPaint
 * @param {() => void} onLeave
 */
export function attachInput(canvas, dims, onHover, onPaint, onLeave) {
  let isDown = false;

  function pos(e) {
    return getGridPos(e, canvas, dims.canvasW, dims.canvasH, dims.offsetX, dims.offsetY);
  }

  canvas.addEventListener('mousemove', e => {
    const g = pos(e);
    onHover(g.x, g.y);
    if (isDown) onPaint(g.x, g.y, e.shiftKey);
  });

  canvas.addEventListener('mouseleave', () => {
    isDown = false;
    onLeave();
  });

  canvas.addEventListener('mousedown', e => {
    isDown = true;
    const g = pos(e);
    onPaint(g.x, g.y, e.shiftKey);
  });

  window.addEventListener('mouseup', () => { isDown = false; });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const g = pos(e);
    onHover(g.x, g.y);
    onPaint(g.x, g.y, false);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const g = pos(e);
    onHover(g.x, g.y);
    onPaint(g.x, g.y, false);
  }, { passive: false });

  canvas.addEventListener('touchend', () => onLeave(), { passive: false });
}
