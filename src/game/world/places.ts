/**
 * Places you can go into, by stable id (ADR-019: places of interest are placed by hand and
 * referenced by id). Projects map to `src/content/projects/<slug>.md`.
 */
export const PLACE = {
  terminal: 1,
  tower: 2,
  hangarA: 3,
  hangarB: 4,
  fireStation: 5,
  barracks: 6,
  radarDome: 7,
  coney: 8,
  kiosk: 9,
  waterTower: 10,
  orchard: 11,
  grainElevator: 12,
  emptyLot: 13,
  ballField: 14,
  windFarm: 15,
  cinema: 16,
  comicShop: 17,
  sportsBar: 18,
} as const;
