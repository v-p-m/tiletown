// constants.js
// Shared game constants imported by both game.js and renderer.js.
// Kept separate to avoid circular import issues.

export const COLS = 128;
export const ROWS = 128;
export const TW = 20;
export const TH = 10;
export const WALL = 4;

export const ZONES = [
  {
    id: "empty",
    label: "Empty",
    top: "#3a3a4a",
    left: "#28282f",
    right: "#202028",
    wall: false,
  },
  {
    id: "water",
    label: "Water",
    top: "#5a8eaf",
    left: "#3d6e8f",
    right: "#2d5473",
    wall: true,
  },
  {
    id: "grass",
    label: "Grass",
    top: "#6b9e4d",
    left: "#4d7d33",
    right: "#3a6025",
    wall: true,
  },
  {
    id: "road",
    label: "Road",
    top: "#5c5855",
    left: "#3e3c3a",
    right: "#2e2c2a",
    wall: true,
  },
  {
    id: "sand",
    label: "Sand",
    top: "#c8a84e",
    left: "#a88a38",
    right: "#8a7028",
    wall: true,
  },
  {
    id: "forest",
    label: "Forest",
    top: "#3a6e30",
    left: "#275020",
    right: "#1c3a18",
    wall: true,
  },
  {
    id: "rock",
    label: "Rock",
    top: "#7a7068",
    left: "#5a5250",
    right: "#42403e",
    wall: true,
  },
  {
    id: "snow",
    label: "Snow",
    top: "#d8dce8",
    left: "#b0b8c8",
    right: "#9098a8",
    wall: true,
  },
];

export const ZONE_MAP = {};
ZONES.forEach((z) => {
  ZONE_MAP[z.id] = z;
});
