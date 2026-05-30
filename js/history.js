// history.js
// Stroke-based undo/redo.
// A "stroke" is a snapshot of all cells changed during one mouse-down → mouse-up drag.
// We store the before/after state of only the changed cells to keep it lightweight.

const MAX_HISTORY = 50;

/** @type {Array<{before: Map<string, string>, after: Map<string, string>}>} */
const undoStack = [];
/** @type {Array<{before: Map<string, string>, after: Map<string, string>}>} */
const redoStack = [];

// Current stroke accumulator
let activeStroke = null; // { before: Map, after: Map }

/**
 * Call before the user starts painting (mousedown / touchstart).
 */
export function beginStroke() {
  activeStroke = { before: new Map(), after: new Map() };
}

/**
 * Record a single cell change within the active stroke.
 * @param {string[][]} grid
 * @param {number} gx
 * @param {number} gy
 * @param {string} newZone
 */
export function recordCell(grid, gx, gy, newZone) {
  if (!activeStroke) return;
  const key = `${gx},${gy}`;
  // Only record the original value the first time we touch this cell
  if (!activeStroke.before.has(key)) {
    activeStroke.before.set(key, grid[gy][gx]);
  }
  activeStroke.after.set(key, newZone);
}

/**
 * Call after the user finishes painting (mouseup / touchend).
 * Commits the stroke to the undo stack if anything actually changed.
 */
export function commitStroke() {
  if (!activeStroke) return;

  // Filter to cells that actually changed
  const changed = [...activeStroke.after.entries()].filter(
    ([key, after]) => activeStroke.before.get(key) !== after,
  );

  if (changed.length > 0) {
    const entry = {
      before: new Map(activeStroke.before),
      after: new Map(activeStroke.after.entries()),
    };
    undoStack.push(entry);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0; // new action clears redo
  }

  activeStroke = null;
}

/**
 * Undo the last stroke. Applies 'before' values to the grid.
 * @param {string[][]} grid
 * @returns {boolean} Whether anything was undone
 */
export function undo(grid) {
  const entry = undoStack.pop();
  if (!entry) return false;
  redoStack.push(entry);
  entry.before.forEach((zone, key) => {
    const [gx, gy] = key.split(",").map(Number);
    grid[gy][gx] = zone;
  });
  return true;
}

/**
 * Redo the last undone stroke. Applies 'after' values to the grid.
 * @param {string[][]} grid
 * @returns {boolean} Whether anything was redone
 */
export function redo(grid) {
  const entry = redoStack.pop();
  if (!entry) return false;
  undoStack.push(entry);
  entry.after.forEach((zone, key) => {
    const [gx, gy] = key.split(",").map(Number);
    grid[gy][gx] = zone;
  });
  return true;
}

/** @returns {{ canUndo: boolean, canRedo: boolean }} */
export function historyState() {
  return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}
