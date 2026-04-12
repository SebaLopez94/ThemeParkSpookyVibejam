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
    description: 'Unlock glowing Jack-o-Lanterns to raise park atmosphere.',
    cost: 200,
    duration: 25,
    unlocks: [DecorationType.JACK_O_LANTERN],
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

export const INITIAL_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'challenge_first_ride',
    title: 'First Thrills',
    description: 'Build your first ride.',
    type: 'ride_count',
    target: 1,
    reward: { money: 500, rating: 5 }
  },
  {
    id: 'challenge_visitors_10',
    title: 'Open for Business',
    description: 'Welcome 10 visitors to the park.',
    type: 'visitor_count',
    target: 10,
    reward: { money: 200, rating: 2 }
  },
  {
    id: 'challenge_layout',
    title: 'Comfort Through Terror',
    description: 'Build 3 services or decorations.',
    type: 'build_count',
    target: 3,
    reward: { money: 200, rating: 2 }
  },
  {
    id: 'challenge_visitors_25',
    title: 'Crowd Puller',
    description: 'Reach 25 total visitors.',
    type: 'visitor_count',
    target: 25,
    reward: { money: 350, rating: 3 }
  },
  {
    id: 'challenge_first_shop',
    title: 'Cursed Commerce',
    description: 'Open 2 shops to feed the hungry masses.',
    type: 'shop_count',
    target: 2,
    reward: { money: 400, rating: 3 }
  },
  {
    id: 'challenge_happiness',
    title: 'Happy Haunting',
    description: 'Keep average happiness above 65 for 20 seconds.',
    type: 'happiness_streak',
    target: 65,
    duration: 20,
    reward: { money: 400, rating: 4 }
  },
  {
    id: 'challenge_profit',
    title: 'Black Ink Banisher',
    description: 'Maintain positive net profit for 30 seconds.',
    type: 'profit_streak',
    target: 1,
    duration: 30,
    reward: { money: 450, rating: 4 }
  },
  {
    id: 'challenge_three_rides',
    title: 'Thrill Dealer',
    description: 'Build 3 different rides.',
    type: 'ride_count',
    target: 3,
    reward: { money: 700, rating: 5 }
  },
  {
    id: 'challenge_visitors_75',
    title: 'Haunted Horde',
    description: 'Attract 75 total visitors.',
    type: 'visitor_count',
    target: 75,
    reward: { money: 800, rating: 6 }
  },
  {
    id: 'challenge_happiness_hard',
    title: 'Pure Joy of Fear',
    description: 'Keep happiness above 75 for 30 seconds.',
    type: 'happiness_streak',
    target: 75,
    duration: 30,
    reward: { money: 900, rating: 6 }
  },
  {
    id: 'challenge_rating',
    title: 'Five-Star Nightmare',
    description: 'Reach a park rating of 80.',
    type: 'rating_threshold',
    target: 80,
    reward: { money: 1200, rating: 0 }
  },
  {
    id: 'challenge_visitors_150',
    title: 'Thousand Screams',
    description: 'Attract 150 total visitors.',
    type: 'visitor_count',
    target: 150,
    reward: { money: 2000, rating: 8 }
  },
  {
    id: 'challenge_profit_hard',
    title: 'Dark Fortune',
    description: 'Stay profitable for 60 seconds straight.',
    type: 'profit_streak',
    target: 1,
    duration: 60,
    reward: { money: 1500, rating: 7 }
  }
];

export const RATING_BUILDING_WEIGHTS: Partial<Record<BuildingType, number>> = {
  [BuildingType.PATH]: 1,
  [BuildingType.RIDE]: 4,
  [BuildingType.SHOP]: 3,
  [BuildingType.SERVICE]: 3,
  [BuildingType.DECORATION]: 2
};
