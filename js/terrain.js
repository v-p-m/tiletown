// terrain.js
// Natural terrain generation for a 128×128 grid.
// Uses layered value noise with large-scale blobs for realistic biomes.

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Value noise lattice ───────────────────────────────────────────────────────
function buildLattice(rng, size) {
  return Float32Array.from({ length: size * size }, () => rng());
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function sampleLattice(lattice, size, x, y) {
  const xi = Math.floor(x) & (size - 1);
  const yi = Math.floor(y) & (size - 1);
  const xi1 = (xi + 1) & (size - 1);
  const yi1 = (yi + 1) & (size - 1);
  const tx = smoothstep(x - Math.floor(x));
  const ty = smoothstep(y - Math.floor(y));
  const v00 = lattice[yi  * size + xi ];
  const v10 = lattice[yi  * size + xi1];
  const v01 = lattice[yi1 * size + xi ];
  const v11 = lattice[yi1 * size + xi1];
  return v00 + tx * (v10 - v00) + ty * ((v01 - v00) + tx * ((v11 - v10) - (v01 - v00)));
}

/**
 * Fractal Brownian Motion.
 * nx, ny ∈ [0, 1] — normalised map position.
 * scale  — noise periods across the full map (lower = bigger blobs).
 */
function fbm(lattice, size, nx, ny, octaves, scale, persistence, lacunarity) {
  let value = 0, amp = 1, freq = scale, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    value  += sampleLattice(lattice, size, (nx * freq) % size, (ny * freq) % size) * amp;
    maxAmp += amp;
    amp    *= persistence;
    freq   *= lacunarity;
  }
  return value / maxAmp;
}

// ── Biome thresholds ──────────────────────────────────────────────────────────
// Road is intentionally excluded — players place roads manually.
function elevationToZone(e) {
  if (e < 0.28) return 'water';
  if (e < 0.35) return 'sand';
  if (e < 0.56) return 'grass';
  if (e < 0.70) return 'forest';
  if (e < 0.82) return 'rock';
  return 'snow';
}

// ── Public API ────────────────────────────────────────────────────────────────
export function generateTerrain(cols, rows, seed) {
  if (seed === undefined) seed = (Math.random() * 0xffffffff) >>> 0;
  const rng = makeRng(seed);

  // Lattice must be power-of-2 and > max frequency
  const LATTICE = 64; // power of 2 for fast & operator
  const lattice = buildLattice(rng, LATTICE);

  // 2–3 noise periods across the 128-tile map → large continental blobs
  const scale = 2 + rng() * 1.5;

  // Second smaller lattice for moisture variation (affects forest vs grass)
  const lattice2 = buildLattice(rng, LATTICE);
  const scale2   = scale * 1.7;

  const isIsland = rng() > 0.45;

  const result = [];
  for (let gy = 0; gy < rows; gy++) {
    result.push([]);
    for (let gx = 0; gx < cols; gx++) {
      const nx = gx / (cols - 1);
      const ny = gy / (rows - 1);

      // Primary elevation noise
      let e = fbm(lattice,  LATTICE, nx, ny, 5, scale,  0.52, 2.0);

      // Moisture slightly shifts the mid-range boundary (grass ↔ forest)
      const m = fbm(lattice2, LATTICE, nx, ny, 3, scale2, 0.5,  2.0);
      e += (m - 0.5) * 0.06;

      if (isIsland) {
        const dx = nx * 2 - 1;
        const dy = ny * 2 - 1;
        const dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
        e = Math.max(0, e - Math.pow(dist, 2.0) * 0.95);
      }

      result[gy].push(elevationToZone(Math.max(0, Math.min(1, e))));
    }
  }
  return result;
}
