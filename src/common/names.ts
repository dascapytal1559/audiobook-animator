const adjectives = [
  // Personality traits
  'swift', 'clever', 'wise', 'brave', 'mighty',
  'gentle', 'fierce', 'noble', 'bright', 'calm',
  'bold', 'eager', 'kind', 'proud', 'wild',
  'agile', 'keen', 'quick', 'sharp', 'strong',
  
  // Elemental/Nature
  'misty', 'stormy', 'sunny', 'windy', 'icy',
  'fiery', 'earthy', 'cosmic', 'lunar', 'astral',
  
  // Colors
  'golden', 'silver', 'azure', 'crimson', 'emerald',
  'amber', 'copper', 'indigo', 'scarlet', 'violet',
  
  // Emotions/Moods
  'merry', 'serene', 'jovial', 'solemn', 'dreamy',
  'lively', 'peaceful', 'spirited', 'tranquil', 'vibrant',
  
  // Time/Season
  'autumn', 'winter', 'spring', 'summer', 'dawn',
  'dusk', 'night', 'morning', 'evening', 'twilight'
];

const animals = [
  // Birds
  'falcon', 'eagle', 'owl', 'hawk', 'raven',
  'crane', 'swan', 'jay', 'phoenix', 'sparrow',
  'heron', 'kestrel', 'condor', 'dove', 'finch',
  
  // Land Predators
  'tiger', 'wolf', 'bear', 'lion', 'lynx',
  'puma', 'leopard', 'jaguar', 'panther', 'fox',
  
  // Land Prey
  'deer', 'hare', 'elk', 'gazelle', 'antelope',
  'ibex', 'moose', 'rabbit', 'bison', 'stag',
  
  // Sea Creatures
  'dolphin', 'seal', 'orca', 'whale', 'shark',
  'manta', 'turtle', 'narwhal', 'octopus', 'ray',
  
  // Mythical
  'dragon', 'griffin', 'unicorn', 'sphinx', 'hydra',
  'kraken', 'pegasus', 'chimera', 'wyrm', 'basilisk'
];

/**
 * Generate a memorable name using an adjective-animal pair
 * @param prefix Optional prefix to add before the name (e.g., 'director-' or 'visual-')
 * @returns A string in the format "{prefix}{adjective}_{animal}"
 */
export function generateMemorable(prefix?: string): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const name = `${adjective}_${animal}`;
  return prefix ? `${prefix}${name}` : name;
} 