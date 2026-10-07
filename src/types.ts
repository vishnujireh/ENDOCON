export interface CommitteeMember {
  id: string;
  name: string;
  role: string;
  // affiliation: string;
  image: string;
  // bio: string;
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  affiliation: string;
  location: string;
  specialty: string;
  image: string;
  isKeynote?: boolean;
  type: 'keynote' | 'international' | 'national';
  bio?: string;
}

export interface ProgramSession {
  id: string;
  time: string;
  title: string;
  speaker?: string;
  affiliation?: string;
  room: string;
  category: 'Keynote' | 'Workshop' | 'Symposium' | 'Plenary' | 'Panel' | 'Break';
  description?: string;
}

export interface ProgramDay {
  day: number;
  date: string;
  title: string;
  sessions: ProgramSession[];
}

export interface PricingTier {
  id: string;
  name: string;
  priceInr: string;
  priceUsd: string;
  tag?: string;
  isFeatured?: boolean;
  features: string[];
}

export interface ConferenceRegistrationCategory {
  id: string;
  category: string;
  type: 'national' | 'international' | 'accompanying-national' | 'accompanying-international';
  currency: 'INR' | 'USD';
  badge?: string;
  isRecommended?: boolean;
  qualification: string;
  earlyBird: string;
  earlyBirdAmount: number;
  regular: string;
  regularAmount: number;
  onSpot: string;
  onSpotAmount: number;
  inclusions: string[];
}

export interface AccommodationOption {
  id: string;
  hotel: string;
  isVenue: boolean;
  category: string;
  singleOccupancy: string;
  singleAmount: number;
  twinShare: string;
  twinAmount: number;
  highlights: string[];
}

export interface Attraction {
  id: string;
  name: string;
  description: string;
  fullDetails: string;
  image: string;
  highlight: string;
}
