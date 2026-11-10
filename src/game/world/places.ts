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

export type PlaceId = (typeof PLACE)[keyof typeof PLACE];

/** What's inside each place. Projects take their title and details from their content file. */
export type PlaceInfo =
  | { id: PlaceId; kind: 'project'; building: string; slug: string }
  | { id: PlaceId; kind: 'landmark'; title: string; note: string }
  | {
      id: PlaceId;
      kind: 'feed';
      /** The Today panel cards its window shows, by id; none until its feed is wired up. */
      cards: string[];
      title: string;
      note: string;
    };

export const PLACES: PlaceInfo[] = [
  { id: PLACE.terminal, kind: 'project', building: 'Terminal', slug: 'personal-console' },
  { id: PLACE.tower, kind: 'project', building: 'ATC tower', slug: 'overhead' },
  { id: PLACE.hangarA, kind: 'project', building: 'Hangar A', slug: 'tetris-plus' },
  { id: PLACE.hangarB, kind: 'project', building: 'Hangar B', slug: 'qa' },
  { id: PLACE.fireStation, kind: 'project', building: 'Fire station', slug: 'work-hours' },
  { id: PLACE.barracks, kind: 'project', building: 'Barracks', slug: 'scrum-master' },
  { id: PLACE.radarDome, kind: 'project', building: 'Radar dome', slug: 'flightpi' },
  { id: PLACE.coney, kind: 'project', building: 'Coney diner', slug: 'food-orders' },
  { id: PLACE.kiosk, kind: 'project', building: 'Vending kiosk', slug: 'crossbell-vending' },
  {
    id: PLACE.waterTower,
    kind: 'landmark',
    title: 'Water tower',
    note: 'The old water tower. You can see it from the end of every runway.',
  },
  {
    id: PLACE.orchard,
    kind: 'landmark',
    title: 'Orchard',
    note: 'Peach and apple rows with a farm stand. Peaches are the local obsession every Labor Day weekend.',
  },
  {
    id: PLACE.grainElevator,
    kind: 'landmark',
    title: 'Grain elevator',
    note: 'The co-op elevator by the tracks. The freight stops here twice a day.',
  },
  {
    id: PLACE.emptyLot,
    kind: 'landmark',
    title: 'Empty lot',
    note: 'The next project gets built here.',
  },
  {
    id: PLACE.ballField,
    kind: 'landmark',
    title: 'Ball field',
    note: 'Friday nights are the second-best thing in town.',
  },
  {
    id: PLACE.windFarm,
    kind: 'landmark',
    title: 'Wind farm',
    note: 'Turbines on the section line. Their red lights blink together all night.',
  },
  {
    id: PLACE.cinema,
    kind: 'feed',
    cards: ['movies'],
    title: 'Cinema',
    note: "What's playing, as the marquee out front has it.",
  },
  {
    id: PLACE.comicShop,
    kind: 'feed',
    cards: [],
    title: 'Comic shop',
    note: "This week's new books. Until the window is wired up, they're on Today.",
  },
  {
    id: PLACE.sportsBar,
    kind: 'feed',
    cards: [],
    title: 'Sports bar',
    note: 'Every game on every screen. Until the sign is wired up, the scores are on Today.',
  },
];
