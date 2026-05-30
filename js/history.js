// history.js
// Stroke-based undo/redo. Records only changed cells per stroke.
// Uses string keys "gx,gy" → zone for compact diffs.

const MAX_HISTORY = 40;

const undoStack = [];
const redoStack = [];

let activeStroke = null; // { before: Map<string,string>, after: Map<string,string> }

export function beginStroke() {
  activeStroke = { before: new Map(), after: new Map() };
}

export function recordCell(grid, gx, gy, newZone) {
  if (!activeStroke) return;
  const key = `${gx},${gy}`;
  if (!activeStroke.before.has(key)) activeStroke.before.set(key, grid[gy][gx]);
  activeStroke.after.set(key, newZone);
}

export function commitStroke() {
  if (!activeStroke) return;

  // Keep only cells that actually changed
  const before = new Map();
  const after = new Map();
  for (const [key, zone] of activeStroke.after) {
    const prev = activeStroke.before.get(key);
    if (prev !== zone) {
      before.set(key, prev);
      after.set(key, zone);
    }
  }

  if (after.size > 0) {
    undoStack.push({ before, after });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  }
  activeStroke = null;
}

function applyDiff(grid, diff) {
  for (const [key, zone] of diff) {
    const [gx, gy] = key.split(",");
    grid[gy][gx] = zone;
  }
}

export function undo(grid) {
  const entry = undoStack.pop();
  if (!entry) return false;
  redoStack.push(entry);
  applyDiff(grid, entry.before);
  return true;
}

export function redo(grid) {
  const entry = redoStack.pop();
  if (!entry) return false;
  undoStack.push(entry);
  applyDiff(grid, entry.after);
  return true;
}

export function historyState() {
  return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}
