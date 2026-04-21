import {
  BuildingType,
  ChallengeDefinition,
  DecorationType,
  ResearchNode,
  RideType
} from '../types';

export const RESEARCH_NODES: ResearchNode[] = [
  {
    id: 'research_pumpkin_lights',
    name: 'Pumpkin Lantern Rituals',
    description: 'Unlock glowing Pumpkins to raise park atmosphere.',
    cost: 200,
    duration: 25,
    unlocks: [DecorationType.PUMPKIN],
    dependencies: []
  },
  {
    id: 'research_eye_of_doom',
    name: 'Eye of Doom Blueprints',
    description: 'Unlock the Ferris Wheel - a prestige ride that draws bigger crowds.',
    cost: 500,
    duration: 50,
    unlocks: [RideType.FERRIS_WHEEL],
    dependencies: []
  },
  {
    id: 'research_haunted_house',
    name: 'House of Screams',
    description: 'Unlock the Haunted House - a premium walk-through horror experience.',
    cost: 750,
    duration: 60,
    unlocks: [RideType.HAUNTED_HOUSE],
    dependencies: ['research_eye_of_doom']
  },
  {
    id: 'research_terror_coaster',
    name: 'Terror Coaster Engineering',
    description: 'Unlock the Roller Coaster - the most thrilling and profitable ride in the park.',
    cost: 1100,
    duration: 90,
    unlocks: [RideType.ROLLER_COASTER],
    dependencies: ['research_eye_of_doom', 'research_haunted_house']
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
    description: 'Build any ride so visitors have a reason to enter and spend money.',
    type: 'ride_count',
    target: 1,
    reward: { money: 400, rating: 3 },
    tier: 1
  },
  {
    id: 'challenge_first_shop',
    title: 'Feed the Damned',
    description: 'Build any shop to cover guest needs and create extra income.',
    type: 'shop_count',
    target: 1,
    reward: { money: 250, rating: 2 },
    tier: 1
  },
  {
    id: 'challenge_visitors_15',
    title: 'First Sacrifices',
    description: 'Attract 15 total visitors. Open the park and make sure paths connect to attractions.',
    type: 'visitor_count',
    target: 15,
    reward: { money: 300, rating: 3 },
    tier: 1
  },

  // ── TIER II  The Haunting Begins ─────────────────────────────────────────
  {
    id: 'challenge_decorations_3',
    title: 'Dark Atmosphere',
    description: 'Place 3 decorations to improve park appeal around paths and attractions.',
    type: 'decoration_count',
    target: 3,
    reward: { money: 300, rating: 2 },
    tier: 2
  },
  {
    id: 'challenge_visitors_30',
    title: 'Ghost Crowd',
    description: 'Reach 30 total visitors by keeping the park open and offering enough things to do.',
    type: 'visitor_count',
    target: 30,
    reward: { money: 500, rating: 3 },
    tier: 2
  },
  {
    id: 'challenge_first_restroom',
    title: 'Necessary Evil',
    description: 'Build a restroom so guests can recover hygiene before it hurts happiness.',
    type: 'service_count',
    target: 1,
    reward: { money: 300, rating: 2 },
    tier: 2
  },
  {
    id: 'challenge_happiness_1',
    title: 'Happy Haunting',
    description: 'Keep average happiness above 60 for 25 seconds by balancing fun, food, drinks and hygiene.',
    type: 'happiness_streak',
    target: 60,
    duration: 25,
    reward: { money: 500, rating: 4 },
    tier: 2
  },
  {
    id: 'challenge_profit_1',
    title: 'In the Black',
    description: 'Keep net profit positive for 30 seconds. Adjust prices and avoid overbuilding too early.',
    type: 'profit_streak',
    target: 1,
    duration: 30,
    reward: { money: 600, rating: 3 },
    tier: 2
  },

  // ── TIER III  A Real Nightmare ───────────────────────────────────────────
  {
    id: 'challenge_all_shops',
    title: 'Catering to Chaos',
    description: 'Build food, drinks and gift shops so visitors can satisfy every shop need.',
    type: 'shop_count',
    target: 3,
    reward: { money: 700, rating: 4 },
    tier: 3
  },
  {
    id: 'challenge_visitors_60',
    title: 'The Masses Arrive',
    description: 'Attract 60 total visitors. More variety and good satisfaction will keep traffic growing.',
    type: 'visitor_count',
    target: 60,
    reward: { money: 800, rating: 4 },
    tier: 3
  },
  {
    id: 'challenge_three_rides',
    title: 'Triple Threat',
    description: 'Build 3 rides to give guests more fun options and reduce boredom.',
    type: 'ride_count',
    target: 3,
    reward: { money: 900, rating: 5 },
    tier: 3
  },
  {
    id: 'challenge_rating_50',
    title: 'Rising Dread',
    description: 'Reach a park rating of 50 by improving attractions, services, decorations and guest happiness.',
    type: 'rating_threshold',
    target: 50,
    reward: { money: 800, rating: 0 },
    tier: 3
  },

  // ── TIER IV  Empire of Fear ──────────────────────────────────────────────
  {
    id: 'challenge_visitors_100',
    title: 'The Haunted Hundreds',
    description: 'Attract 100 total visitors by scaling attractions and keeping guest needs covered.',
    type: 'visitor_count',
    target: 100,
    reward: { money: 1500, rating: 6 },
    tier: 4
  },
  {
    id: 'challenge_active_15',
    title: 'Packed Graveyard',
    description: 'Have 15 visitors inside the park at once. Keep enough capacity so guests do not leave early.',
    type: 'active_visitors',
    target: 15,
    reward: { money: 1000, rating: 4 },
    tier: 4
  },
  {
    id: 'challenge_happiness_2',
    title: 'Waves of Delight',
    description: 'Keep average happiness above 72 for 45 seconds with strong rides, shops and services.',
    type: 'happiness_streak',
    target: 72,
    duration: 45,
    reward: { money: 1200, rating: 6 },
    tier: 4
  },
  {
    id: 'challenge_rating_70',
    title: 'Crowned in Darkness',
    description: 'Reach a park rating of 70. Improve the whole park, not just one attraction.',
    type: 'rating_threshold',
    target: 70,
    reward: { money: 1800, rating: 0 },
    tier: 4
  },
  {
    id: 'challenge_profit_2',
    title: 'Sustained Terror',
    description: 'Keep net profit positive for 90 seconds. Make sure income stays ahead of maintenance costs.',
    type: 'profit_streak',
    target: 1,
    duration: 90,
    reward: { money: 1500, rating: 5 },
    tier: 4
  },

  // ── TIER V  Legend of the Damned ─────────────────────────────────────────
  {
    id: 'challenge_visitors_200',
    title: 'Haunted Empire',
    description: 'Attract 200 total visitors. A large park needs enough rides, shops and services to stay healthy.',
    type: 'visitor_count',
    target: 200,
    reward: { money: 3500, rating: 8 },
    tier: 5
  },
  {
    id: 'challenge_happiness_3',
    title: 'The Perfect Nightmare',
    description: 'Keep average happiness above 80 for 60 seconds. Every guest need must be under control.',
    type: 'happiness_streak',
    target: 80,
    duration: 60,
    reward: { money: 2500, rating: 7 },
    tier: 5
  },
  {
    id: 'challenge_rating_85',
    title: 'Nightmare Crowned',
    description: 'Reach a park rating of 85 with a complete, well-balanced and highly satisfying park.',
    type: 'rating_threshold',
    target: 85,
    reward: { money: 3000, rating: 0 },
    tier: 5
  },
  {
    id: 'challenge_profit_3',
    title: 'Undying Fortune',
    description: 'Stay profitable for 2 full minutes. This proves the park can run sustainably at scale.',
    type: 'profit_streak',
    target: 1,
    duration: 120,
    reward: { money: 2500, rating: 6 },
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
