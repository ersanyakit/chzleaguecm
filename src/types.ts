export interface Player {
  id: string;
  name: string;
  age: number;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  rating: number; // Overall Rating
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  goalkeeping: number; // goalkeeper specific
  value: number; // market value in £
  wage: number; // weekly wage in £
  form: number; // 1-10 form rating
  fitness: number; // 0-100% flat
  morale: number; // 0-100% flat
  injuryWeeks: number; // weeks out, 0 is fully fit
  goals: number;
  assists: number;
  appearances: number;
  yellowCards: number;
  redCards: number;
  ratingHistory: number[];
  avgRating: number;
  isStarting: boolean;
  pitchPosition: number; // index inside position scheme
  isCaptain: boolean;
  isPenaltyTaker: boolean;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  stadium: string;
  badge: string;
  founded: string;
  reputation: number; // 1-100 (impacts simulation and AI strength)
  transferBudget: number; // £
  wageBudget: number; // £ per week
  weeklyWageExpense: number; // £
  boardExpectation: string; // e.g., "Şampiyonluk", "Play-off", "Kümede Kalma"
}

export interface MatchEvent {
  minute: number;
  type: 'GOAL' | 'ASSIST' | 'YELLOW' | 'RED' | 'INJURY' | 'SUB' | 'COMMENT';
  teamId: string;
  playerName: string;
  detail?: string;
}

export interface Fixture {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  scorers?: string[]; // goal scorer strings
  events?: MatchEvent[];
  stats?: {
    homeShots: number;
    awayShots: number;
    homePos: number;
    awayPos: number;
  };
}

export interface LeagueStanding {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Mail {
  id: string;
  sender: string;
  subject: string;
  content: string;
  weekReceived: number;
  read: boolean;
  type: 'NEWS' | 'BOARD' | 'DEAL' | 'SCOUT' | 'MEDICAL';
  actions?: { label: string; actionId: string }[];
}

export interface Tactics {
  formation: '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2';
  mentality: 'DEFENSIVE' | 'CAUTIOUS' | 'BALANCED' | 'ATTACKING' | 'OVERLOAD';
  style: 'TIKI_TAKA' | 'GEGENPRESS' | 'WING_PLAY' | 'PARK_BUS' | 'COUNTER_ATTACK';
  tempo: 'LOW' | 'NORMAL' | 'HIGH';
  passing: 'SHORT' | 'MIXED' | 'DIRECT';
}

export interface TrainingAllocation {
  fitness: number; // percentage (0-100)
  tactical: number;
  defense: number;
  attacking: number;
  goalkeeping: number;
}
