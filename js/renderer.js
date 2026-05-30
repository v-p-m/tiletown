// renderer.js — WebGL2 instanced renderer
//
// Each tile instance carries its 3 face colors directly as vertex attributes
// (r,g,b for top, left, right). No uniform array indexing needed.
// Single gl.drawArraysInstanced() call per frame.

import { ZONES, COLS, ROWS, TW, TH, WALL } from "./constants.js";

// ── Zone color table: precompute RGB floats for each zone ────────────────────
function hexToRgb(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ZONE_RGB[i] = [topR,topG,topB, leftR,leftG,leftB, rightR,rightG,rightB]
const ZONE_RGB = ZONES.map((z) => [
  ...hexToRgb(z.top),
  ...hexToRgb(z.left),
  ...hexToRgb(z.right),
]);

const HOVER_RGB = [
  ...hexToRgb("#f0d060"), // top
  ...hexToRgb("#c8a830"), // left
  ...hexToRgb("#a88818"), // right
];

// Zone id → index
const ZONE_INDEX = {};
ZONES.forEach((z, i) => {
  ZONE_INDEX[z.id] = i;
});

// ── Tile template: 18 vertices (3 faces × 2 tris × 3 verts) ─────────────────
// Each vertex: [localX, localY, faceId(0=top,1=left,2=right)]
function buildTemplate() {
  const hw = TW / 2,
    hh = TH / 2;
  return new Float32Array([
    // Top face
    0,
    0,
    0,
    hw,
    hh,
    0,
    0,
    TH,
    0,
    0,
    0,
    0,
    0,
    TH,
    0,
    -hw,
    hh,
    0,
    // Left face
    -hw,
    hh,
    1,
    0,
    TH,
    1,
    0,
    TH + WALL,
    1,
    -hw,
    hh,
    1,
    0,
    TH + WALL,
    1,
    -hw,
    hh + WALL,
    1,
    // Right face
    0,
    TH,
    2,
    hw,
    hh,
    2,
    hw,
    hh + WALL,
    2,
    0,
    TH,
    2,
    hw,
    hh + WALL,
    2,
    0,
    TH + WALL,
    2,
  ]);
}

// ── Shaders ───────────────────────────────────────────────────────────────────
const VS = `#version 300 es
precision highp float;

// Per-vertex (template)
in vec2  a_pos;
in float a_face;

// Per-instance
in float a_gx;
in float a_gy;
in vec3  a_colorTop;
in vec3  a_colorLeft;
in vec3  a_colorRight;

uniform vec2  u_baseXY;
uniform vec2  u_canvas;
uniform vec2  u_pan;
uniform float u_zoom;
uniform float u_time;

out vec3 v_color;

void main() {
  float hw = ${TW / 2}.0;
  float hh = ${TH / 2}.0;

  // World position of tile origin (top point)
  float wx = u_baseXY.x + (a_gx - a_gy) * hw;
  float wy = u_baseXY.y + (a_gx + a_gy) * hh;

  // Apply local vertex offset then camera
  vec2 screen = (vec2(wx, wy) + a_pos) * u_zoom + u_pan;

  // NDC: map [0,canvas] → [-1,1], flip Y
  gl_Position = vec4(
    (screen.x / u_canvas.x) * 2.0 - 1.0,
    1.0 - (screen.y / u_canvas.y) * 2.0,
    0.0, 1.0
  );

  // Select face color
  int f = int(a_face);
  if      (f == 0) v_color = a_colorTop;
  else if (f == 1) v_color = a_colorLeft;
  else             v_color = a_colorRight;
}
`;

const FS = `#version 300 es
precision mediump float;
in  vec3 v_color;
out vec4 fragColor;
void main() {
  fragColor = vec4(v_color, 1.0);
}
`;

// ── WebGL state ───────────────────────────────────────────────────────────────
let gl, prog, vao, instanceBuf;
let uBaseXY, uCanvas, uPan, uZoom, uTime;

// Per-instance layout: gx, gy, topR,G,B, leftR,G,B, rightR,G,B  = 11 floats
const INST_FLOATS = 11;
const MAX_VISIBLE = COLS * ROWS;
const instanceData = new Float32Array(MAX_VISIBLE * INST_FLOATS);
let lastCount = 0;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error("Shader: " + gl.getShaderInfoLog(s));
  return s;
}

// ── Visible range (iso inverse) ───────────────────────────────────────────────
function visibleRange(canvasW, canvasH, camera, baseX, baseY) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [px, py] of [
    [0, 0],
    [canvasW, 0],
    [0, canvasH],
    [canvasW, canvasH],
  ]) {
    const wx = (px - camera.panX) / camera.zoom - baseX;
    const wy = (py - camera.panY) / camera.zoom - baseY;
    const sum = wy / (TH / 2),
      dif = wx / (TW / 2);
    const gx = (sum + dif) / 2,
      gy = (sum - dif) / 2;
    x0 = Math.min(x0, gx);
    x1 = Math.max(x1, gx);
    y0 = Math.min(y0, gy);
    y1 = Math.max(y1, gy);
  }
  const p = 2;
  return {
    gxMin: Math.max(0, Math.floor(x0) - p),
    gxMax: Math.min(COLS - 1, Math.ceil(x1) + p),
    gyMin: Math.max(0, Math.floor(y0) - p),
    gyMax: Math.min(ROWS - 1, Math.ceil(y1) + p),
  };
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initRenderer(canvas) {
  gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) throw new Error("WebGL2 not supported");

  // Compile program
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error("Program link error: " + gl.getProgramInfoLog(p));
  prog = p;
  gl.useProgram(prog);

  // Cache uniforms
  uBaseXY = gl.getUniformLocation(prog, "u_baseXY");
  uCanvas = gl.getUniformLocation(prog, "u_canvas");
  uPan = gl.getUniformLocation(prog, "u_pan");
  uZoom = gl.getUniformLocation(prog, "u_zoom");
  uTime = gl.getUniformLocation(prog, "u_time");

  // VAO
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Template buffer (static, per-vertex)
  const tmpl = buildTemplate();
  const tmplBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tmplBuf);
  gl.bufferData(gl.ARRAY_BUFFER, tmpl, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, "a_pos");
  const aFace = gl.getAttribLocation(prog, "a_face");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(aFace);
  gl.vertexAttribPointer(aFace, 1, gl.FLOAT, false, 12, 8);
  gl.vertexAttribDivisor(aPos, 0);
  gl.vertexAttribDivisor(aFace, 0);

  // Instance buffer (dynamic, per-instance)
  instanceBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
  gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);

  const aGx = gl.getAttribLocation(prog, "a_gx");
  const aGy = gl.getAttribLocation(prog, "a_gy");
  const aTop = gl.getAttribLocation(prog, "a_colorTop");
  const aLeft = gl.getAttribLocation(prog, "a_colorLeft");
  const aRight = gl.getAttribLocation(prog, "a_colorRight");

  const is = INST_FLOATS * 4; // stride in bytes
  gl.enableVertexAttribArray(aGx);
  gl.vertexAttribPointer(aGx, 1, gl.FLOAT, false, is, 0);
  gl.vertexAttribDivisor(aGx, 1);

  gl.enableVertexAttribArray(aGy);
  gl.vertexAttribPointer(aGy, 1, gl.FLOAT, false, is, 4);
  gl.vertexAttribDivisor(aGy, 1);

  gl.enableVertexAttribArray(aTop);
  gl.vertexAttribPointer(aTop, 3, gl.FLOAT, false, is, 8);
  gl.vertexAttribDivisor(aTop, 1);

  gl.enableVertexAttribArray(aLeft);
  gl.vertexAttribPointer(aLeft, 3, gl.FLOAT, false, is, 20);
  gl.vertexAttribDivisor(aLeft, 1);

  gl.enableVertexAttribArray(aRight);
  gl.vertexAttribPointer(aRight, 3, gl.FLOAT, false, is, 32);
  gl.vertexAttribDivisor(aRight, 1);

  gl.bindVertexArray(null);

  gl.clearColor(0.04, 0.04, 0.08, 1.0);
  gl.disable(gl.DEPTH_TEST);
}

// ── Draw ──────────────────────────────────────────────────────────────────────
const t0 = performance.now();

export function drawGrid(_ctx, grid, hovered, dims, dirty = true) {
  const { canvasW, canvasH, camera } = dims;
  const baseX = canvasW / 2;
  const baseY = 20;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);

  gl.uniform2f(uBaseXY, baseX, baseY);
  gl.uniform2f(uCanvas, canvasW, canvasH);
  gl.uniform2f(uPan, camera.panX, camera.panY);
  gl.uniform1f(uZoom, camera.zoom);
  gl.uniform1f(uTime, (performance.now() - t0) / 1000);

  if (dirty) {
    const { gxMin, gxMax, gyMin, gyMax } = visibleRange(
      canvasW,
      canvasH,
      camera,
      baseX,
      baseY,
    );
    let n = 0;
    for (let gy = gyMin; gy <= gyMax; gy++) {
      for (let gx = gxMin; gx <= gxMax; gx++) {
        const isHov = hovered && hovered.x === gx && hovered.y === gy;
        const rgb = isHov ? HOVER_RGB : ZONE_RGB[ZONE_INDEX[grid[gy][gx]] ?? 0];
        const b = n * INST_FLOATS;
        instanceData[b + 0] = gx;
        instanceData[b + 1] = gy;
        instanceData[b + 2] = rgb[0];
        instanceData[b + 3] = rgb[1];
        instanceData[b + 4] = rgb[2]; // top
        instanceData[b + 5] = rgb[3];
        instanceData[b + 6] = rgb[4];
        instanceData[b + 7] = rgb[5]; // left
        instanceData[b + 8] = rgb[6];
        instanceData[b + 9] = rgb[7];
        instanceData[b + 10] = rgb[8]; // right
        n++;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData, 0, n * INST_FLOATS);
    lastCount = n;
  }

  gl.bindVertexArray(vao);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, lastCount);
  gl.bindVertexArray(null);
}
