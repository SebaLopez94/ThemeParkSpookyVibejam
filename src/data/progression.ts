import {
  BuildingType,
  ChallengeDefinition,
  DecorationType,
  ResearchNode,
  RideType,
  ShopType
} from '../types';

export const RESEARCH_NODES: ResearchNode[] = [
  {
    id: 'research_eye_of_doom',
    name: 'Eye of Doom Blueprints',
    description: 'Unlock the Ferris wheel to raise park prestige.',
    cost: 600,
    duration: 40,
    unlocks: [RideType.FERRIS_WHEEL],
    dependencies: []
  },
  {
    id: 'research_voodoo_shop',
    name: 'Souvenir Hexcraft',
    description: 'Unlock the Voodoo Shop for premium impulse spending.',
    cost: 350,
    duration: 30,
    unlocks: [ShopType.GIFT_SHOP],
    dependencies: []
  },
  {
    id: 'research_pumpkin_lights',
    name: 'Pumpkin Lantern Rituals',
    description: 'Unlock glowing decor to improve atmosphere.',
    cost: 250,
    duration: 20,
    unlocks: [DecorationType.JACK_O_LANTERN],
    dependencies: []
  },
  {
    id: 'research_terror_coaster',
    name: 'Terror Coaster Engineering',
    description: 'Unlock the most profitable high-thrill ride.',
    cost: 1200,
    duration: 65,
    unlocks: [RideType.ROLLER_COASTER],
    dependencies: ['research_eye_of_doom']
  },
  {
    id: 'research_haunted_house',
    name: 'House of Screams',
    description: 'Unlock the walk-through horror experience for a premium scare.',
    cost: 800,
    duration: 50,
    unlocks: [RideType.HAUNTED_HOUSE],
    dependencies: ['research_eye_of_doom']
  }
];

export const INITIAL_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'challenge_visitors',
    title: 'Crowd Puller',
    description: 'Reach 20 total visitors.',
    type: 'visitor_count',
    target: 20,
    reward: { money: 250, rating: 2 }
  },
  {
    id: 'challenge_happiness',
    title: 'Happy Haunting',
    description: 'Keep average happiness above 65 for 20 seconds.',
    type: 'happiness_streak',
    target: 65,
    duration: 20,
    reward: { money: 300, rating: 3 }
  },
  {
    id: 'challenge_profit',
    title: 'Black Ink Banisher',
    description: 'Maintain positive net profit for 25 seconds.',
    type: 'profit_streak',
    target: 1,
    duration: 25,
    reward: { money: 350, rating: 3 }
  },
  {
    id: 'challenge_layout',
    title: 'Comfort Through Terror',
    description: 'Build 3 services or decorations.',
    type: 'build_count',
    target: 3,
    reward: { money: 200, rating: 2 }
  }
];

export const RATING_BUILDING_WEIGHTS: Partial<Record<BuildingType, number>> = {
  [BuildingType.PATH]: 1,
  [BuildingType.RIDE]: 4,
  [BuildingType.SHOP]: 3,
  [BuildingType.SERVICE]: 3,
  [BuildingType.DECORATION]: 2
};
