// terrain.js
// Natural terrain generation using layered value noise (no external deps).
// Produces smooth biome blobs — water, sand shores, grass, forest, rock, snow.

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

// ── Value noise on a small lattice ───────────────────────────────────────────
function buildLattice(rng, size) {
  return Array.from({ length: size * size }, () => rng());
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Sample smoothly-interpolated value noise.
 * x and y are in [0, size) (fractional OK).
 */
function sampleLattice(lattice, size, x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const tx = smoothstep(x - xi),
    ty = smoothstep(y - yi);
  const x0 = xi % size,
    x1 = (xi + 1) % size;
  const y0 = yi % size,
    y1 = (yi + 1) % size;
  const v00 = lattice[y0 * size + x0];
  const v10 = lattice[y0 * size + x1];
  const v01 = lattice[y1 * size + x0];
  const v11 = lattice[y1 * size + x1];
  return (
    v00 + tx * (v10 - v00) + ty * (v01 - v00 + tx * (v11 - v10 - (v01 - v00)))
  );
}

/**
 * Fractal Brownian Motion.
 * nx, ny are normalised coords in [0, 1] over the map.
 * scale controls how many noise "hills" fit across the map (lower = bigger blobs).
 */
function fbm(lattice, size, nx, ny, octaves, scale, persistence, lacunarity) {
  let value = 0,
    amp = 1,
    freq = scale,
    maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    const sx = (nx * freq) % size;
    const sy = (ny * freq) % size;
    value += sampleLattice(lattice, size, sx, sy) * amp;
    maxAmp += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return value / maxAmp;
}

// ── Biome thresholds ──────────────────────────────────────────────────────────
function elevationToZone(e) {
  if (e < 0.3) return "water";
  if (e < 0.38) return "sand";
  if (e < 0.58) return "grass";
  if (e < 0.72) return "forest";
  if (e < 0.84) return "rock";
  return "snow";
}

// ── Public API ────────────────────────────────────────────────────────────────
export function generateTerrain(cols, rows, seed) {
  if (seed === undefined) seed = (Math.random() * 0xffffffff) >>> 0;
  const rng = makeRng(seed);

  // Lattice size — must be > scale * lacunarity^(octaves-1) to avoid tiling
  const LATTICE = 32;
  const lattice = buildLattice(rng, LATTICE);

  // scale = how many noise periods fit across the map.
  // 3–5 gives large continental blobs on a 28×28 grid.
  const scale = 3 + rng() * 2; // [3, 5)

  const isIsland = rng() > 0.4; // 60% island, 40% continent

  const result = [];
  for (let gy = 0; gy < rows; gy++) {
    result.push([]);
    for (let gx = 0; gx < cols; gx++) {
      // Normalised position [0, 1]
      const nx = gx / (cols - 1);
      const ny = gy / (rows - 1);

      let e = fbm(
        lattice,
        LATTICE,
        nx,
        ny,
        /* octaves */ 4,
        /* scale   */ scale,
        /* persist */ 0.5,
        /* lacunar */ 2.0,
      );

      if (isIsland) {
        // Radial falloff: edges sink to sea, centre rises
        const dx = nx * 2 - 1; // [-1, 1]
        const dy = ny * 2 - 1;
        const dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2; // [0, 1]
        e = Math.max(0, e - Math.pow(dist, 1.8) * 0.9);
      }

      result[gy].push(elevationToZone(e));
    }
  }
  return result;
}
