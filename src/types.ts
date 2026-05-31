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

export type MatchEventType =
  | 'KICK_OFF'
  | 'ADDED_TIME_ANNOUNCED'
  | 'STOPPAGE'
  | 'BALL_OUT'
  | 'BALL_IN_PLAY'
  | 'DROP_BALL'
  | 'THROW_IN_AWARDED'
  | 'PLAYER_TAKES_BALL_FOR_THROW'
  | 'THROW_IN_TAKEN'
  | 'LONG_THROW'
  | 'CORNER_AWARDED'
  | 'PLAYER_PLACES_BALL_CORNER'
  | 'CORNER_TAKEN'
  | 'SHORT_CORNER'
  | 'GOAL_KICK_AWARDED'
  | 'GOALKEEPER_PLACES_BALL'
  | 'GOAL_KICK_TAKEN'
  | 'FREE_KICK_AWARDED'
  | 'PLAYER_STANDS_OVER_FREE_KICK'
  | 'FREE_KICK_TAKEN'
  | 'PENALTY_AWARDED'
  | 'PLAYER_STANDS_OVER_PENALTY'
  | 'PENALTY_TAKEN'
  | 'PENALTY_MISS'
  | 'FIRST_TOUCH'
  | 'CONTROL'
  | 'CARRY'
  | 'PRESSURE'
  | 'DUEL'
  | 'AERIAL_DUEL'
  | 'LOOSE_BALL'
  | 'SECOND_BALL_WON'
  | 'SHOT_ASSIST'
  | 'REBOUND'
  | 'OWN_GOAL'
  | 'GOAL_DISALLOWED'
  | 'KEEPER_CATCH'
  | 'KEEPER_PUNCH'
  | 'KEEPER_ERROR'
  | 'ADVANTAGE_PLAYED'
  | 'HANDBALL'
  | 'REFEREE_WARNING'
  | 'YELLOW_CARD'
  | 'SECOND_YELLOW_RED'
  | 'RED_CARD'
  | 'DISSENT'
  | 'STAMINA_DROP'
  | 'SUBSTITUTION'
  | 'TACTIC_CHANGE'
  | 'MORALE_CHANGE'
  | 'MOMENTUM_SHIFT'
  | 'POSSESSION_CHANGE'
  | 'POSSESSION_RETAINED'
  | 'SET_PIECE_ROUTINE'
  | 'VAR_CHECK'
  | 'ATTACK_BUILDUP'
  | 'PENALTY_AREA_ENTRY'
  | 'POST_HIT'
  | 'GOAL'
  | 'ASSIST'
  | 'COMMENT'
  | 'PASS'
  | 'PASS_FAILED'
  | 'KEY_PASS'
  | 'THROUGH_BALL'
  | 'CROSS'
  | 'TURNOVER'
  | 'BALL_RECOVERY'
  | 'PRESS'
  | 'PRESS_RECOVERY'
  | 'DRIBBLE'
  | 'DRIBBLE_SUCCESS'
  | 'DRIBBLE_FAILED'
  | 'TACKLE'
  | 'SLIDE_TACKLE'
  | 'BLOCK'
  | 'SHOT_BLOCK'
  | 'INTERCEPTION'
  | 'CLEARANCE'
  | 'LAST_MAN_TACKLE'
  | 'GOAL_LINE_CLEARANCE'
  | 'SAVE'
  | 'REFLEX_SAVE'
  | 'PENALTY_SAVE'
  | 'PUNCH'
  | 'GK_CLAIM'
  | 'ONE_ON_ONE'
  | 'GK_ERROR'
  | 'CORNER'
  | 'FREE_KICK'
  | 'INDIRECT_FREE_KICK'
  | 'THROW_IN'
  | 'PENALTY'
  | 'GOAL_KICK'
  | 'SHOT'
  | 'SHOT_ON_TARGET'
  | 'SHOT_OFF_TARGET'
  | 'WOODWORK'
  | 'HEADER'
  | 'BICYCLE_KICK'
  | 'VOLLEY'
  | 'BOX_ENTRY'
  | 'BIG_CHANCE'
  | 'FOUL'
  | 'ADVANTAGE'
  | 'YELLOW'
  | 'SECOND_YELLOW'
  | 'RED'
  | 'REF_WARNING'
  | 'PLAYER_PROTEST'
  | 'INJURY'
  | 'MINOR_INJURY'
  | 'CANNOT_CONTINUE'
  | 'CRAMP'
  | 'FATIGUE_CHANGE'
  | 'SUB'
  | 'FORMATION_CHANGE'
  | 'ATTACKING_PUSH'
  | 'DEFENSIVE_DROP'
  | 'COUNTER_START'
  | 'PRESSING_CHANGE'
  | 'MATCH_START'
  | 'HALF_TIME'
  | 'SECOND_HALF_START'
  | 'EXTRA_TIME_START'
  | 'EXTRA_TIME_END'
  | 'PENALTY_SHOOTOUT_START'
  | 'VAR_REVIEW'
  | 'VAR_DECISION'
  | 'FULL_TIME'
  | 'OFFSIDE'
  | 'OFFSIDE_TRAP'
  | 'DEFENSIVE_LINE_ERROR'
  | 'INDIVIDUAL_ERROR'
  | 'RUN_IN_BEHIND'
  | 'COUNTER_ATTACK'
  | 'WING_PATTERN'
  | 'CENTRAL_ATTACK'
  | 'FINAL_THIRD_PRESS'
  | 'TIME_WASTING';

export interface MatchEvent {
  id?: string;
  minute: number;
  second?: number;
  type: MatchEventType;
  teamId: string;
  teamSide?: 'home' | 'away';
  playerName: string;
  detail?: string;
  commentary?: string;
  x?: number;
  y?: number;
  chainId?: string;
  relatedEventId?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'NEUTRAL';
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MatchState {
  possessionTeamId: string | null;
  ballZone: 'HOME_DEFENSE' | 'HOME_HALF' | 'MIDFIELD' | 'AWAY_HALF' | 'AWAY_DEFENSE' | 'LEFT_WING' | 'RIGHT_WING';
  ballOwnerPlayerId: string | null;
  matchTempo: 'LOW' | 'NORMAL' | 'HIGH';
  lastEventTypes: MatchEventType[];
  lastEventPlayerIds: string[];
  repeatedChainCounter: Record<string, number>;
  playerCooldowns: Record<string, Partial<Record<MatchEventType, number>>>;
  teamCooldowns: Record<string, Partial<Record<MatchEventType, number>>>;
  chainCooldowns: Record<string, number>;
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
