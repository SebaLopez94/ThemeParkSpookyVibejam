import {
  BuildingType,
  ChallengeDefinition,
  DecorationType,
  ResearchNode,
  RideType
} from '../types';

export const RESEARCH_NODES: ResearchNode[] = [
  {
    id: 'research_terror_coaster',
    name: 'Terror Coaster Engineering',
    description: 'Unlock the Roller Coaster - the most thrilling and profitable ride in the park.',
    cost: 1400,
    duration: 100,
    unlocks: [RideType.ROLLER_COASTER],
    dependencies: []
  },
  {
    id: 'research_eye_of_doom',
    name: 'Eye of Doom Blueprints',
    description: 'Unlock the Ferris Wheel - a prestige ride that draws bigger crowds.',
    cost: 650,
    duration: 55,
    unlocks: [RideType.FERRIS_WHEEL],
    dependencies: []
  },
  {
    id: 'research_haunted_house',
    name: 'House of Screams',
    description: 'Unlock the Haunted House - a premium walk-through horror experience.',
    cost: 900,
    duration: 70,
    unlocks: [RideType.HAUNTED_HOUSE],
    dependencies: [],
    dependenciesAny: ['research_terror_coaster', 'research_eye_of_doom']
  }
];

// Challenge progression across 5 tiers — each tier unlocks after the previous one
// feels achieved, not gated, so all challenges are always visible.
// Total reward pool: ~$22 000 across 20 challenges.
export const INITIAL_CHALLENGES: ChallengeDefinition[] = [

  // ── TIER I  The Gates Open ───────────────────────────────────────────────
  {
    id: 'challenge_first_ride',
    title: 'Summon the Screams',
    description: 'Build 1 ride.',
    type: 'ride_count',
    target: 1,
    reward: { money: 400, rating: 3 },
    tier: 1
  },
  {
    id: 'challenge_first_shop',
    title: 'Feed the Damned',
    description: 'Build 1 shop.',
    type: 'shop_count',
    target: 1,
    reward: { money: 250, rating: 2 },
    tier: 1
  },
  {
    id: 'challenge_visitors_15',
    title: 'First Sacrifices',
    description: 'Attract 20 visitors.',
    type: 'visitor_count',
    target: 20,
    reward: { money: 300, rating: 3 },
    tier: 1
  },

  // ── TIER II  The Haunting Begins ─────────────────────────────────────────
  {
    id: 'challenge_decorations_3',
    title: 'Dark Atmosphere',
    description: 'Place 5 decorations.',
    type: 'decoration_count',
    target: 5,
    reward: { money: 300, rating: 2 },
    tier: 2
  },
  {
    id: 'challenge_visitors_30',
    title: 'Ghost Crowd',
    description: 'Attract 45 visitors.',
    type: 'visitor_count',
    target: 45,
    reward: { money: 500, rating: 3 },
    tier: 2
  },
  {
    id: 'challenge_first_restroom',
    title: 'Necessary Evil',
    description: 'Build 1 service building.',
    type: 'service_count',
    target: 1,
    reward: { money: 300, rating: 2 },
    tier: 2
  },
  {
    id: 'challenge_happiness_1',
    title: 'Happy Haunting',
    description: 'Happiness above 65 for 35s.',
    type: 'happiness_streak',
    target: 65,
    duration: 35,
    reward: { money: 500, rating: 4 },
    tier: 2
  },
  // ── TIER III  A Real Nightmare ───────────────────────────────────────────
  {
    id: 'challenge_all_shops',
    title: 'Catering to Chaos',
    description: 'Build 3 shops.',
    type: 'shop_count',
    target: 3,
    reward: { money: 700, rating: 4 },
    tier: 3
  },
  {
    id: 'challenge_visitors_60',
    title: 'The Masses Arrive',
    description: 'Attract 85 visitors.',
    type: 'visitor_count',
    target: 85,
    reward: { money: 800, rating: 4 },
    tier: 3
  },
  {
    id: 'challenge_three_rides',
    title: 'Triple Threat',
    description: 'Build 4 rides.',
    type: 'ride_count',
    target: 4,
    reward: { money: 900, rating: 5 },
    tier: 3
  },
  {
    id: 'challenge_rating_50',
    title: 'Rising Dread',
    description: 'Reach 55 park rating.',
    type: 'rating_threshold',
    target: 55,
    reward: { money: 800, rating: 0 },
    tier: 3
  },

  // ── TIER IV  Empire of Fear ──────────────────────────────────────────────
  {
    id: 'challenge_visitors_100',
    title: 'The Haunted Hundreds',
    description: 'Attract 140 visitors.',
    type: 'visitor_count',
    target: 140,
    reward: { money: 1500, rating: 6 },
    tier: 4
  },
  {
    id: 'challenge_active_15',
    title: 'Packed Graveyard',
    description: '25 visitors at once.',
    type: 'active_visitors',
    target: 25,
    reward: { money: 1000, rating: 4 },
    tier: 4
  },
  {
    id: 'challenge_happiness_2',
    title: 'Waves of Delight',
    description: 'Happiness above 75 for 60s.',
    type: 'happiness_streak',
    target: 75,
    duration: 60,
    reward: { money: 1200, rating: 6 },
    tier: 4
  },
  {
    id: 'challenge_rating_70',
    title: 'Crowned in Darkness',
    description: 'Reach 75 park rating.',
    type: 'rating_threshold',
    target: 75,
    reward: { money: 1800, rating: 0 },
    tier: 4
  },
  {
    id: 'challenge_profit_2',
    title: 'Sustained Terror',
    description: 'Positive profit for 120s.',
    type: 'profit_streak',
    target: 1,
    duration: 120,
    reward: { money: 1500, rating: 5 },
    tier: 4
  },

  // ── TIER V  Legend of the Damned ─────────────────────────────────────────
  {
    id: 'challenge_visitors_200',
    title: 'Haunted Empire',
    description: 'Attract 240 visitors.',
    type: 'visitor_count',
    target: 240,
    reward: { money: 3500, rating: 8 },
    tier: 5
  },
  {
    id: 'challenge_happiness_3',
    title: 'The Perfect Nightmare',
    description: 'Happiness above 84 for 75s.',
    type: 'happiness_streak',
    target: 84,
    duration: 75,
    reward: { money: 2500, rating: 7 },
    tier: 5
  },
  {
    id: 'challenge_rating_85',
    title: 'Nightmare Crowned',
    description: 'Reach 88 park rating.',
    type: 'rating_threshold',
    target: 88,
    reward: { money: 3000, rating: 0 },
    tier: 5
  }
];

export const RATING_BUILDING_WEIGHTS: Partial<Record<BuildingType, number>> = {
  [BuildingType.PATH]: 1,
  [BuildingType.RIDE]: 4,
  [BuildingType.SHOP]: 3,
  [BuildingType.SERVICE]: 3,
  [BuildingType.DECORATION]: 2
};
