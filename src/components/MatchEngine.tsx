import React, { useState, useEffect, useRef } from 'react';
import { Player, Tactics, Club, MatchEvent } from '../types';
import { Play, Pause, Award, Activity, AlertCircle, RefreshCw, Sparkles, AlertTriangle, Tv, Grid3X3, Trophy, CheckCircle2, Eye, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import ThreeDPitch from './ThreeDPitch';
import BroadcastBanner from './BroadcastBanner';

interface MatchEngineProps {
  homeClub: Club;
  awayClub: Club;
  homeSquad: Player[];
  awaySquad: Player[];
  userTactics: Tactics; // applicable if user is home/away
  isUserHome: boolean;
  initialSeed?: number; // added support for preloaded simulation seeds
  onMatchFinished: (fixtureResult: {
    homeScore: number;
    awayScore: number;
    scorers: string[];
    events: MatchEvent[];
    stats: {
      homeShots: number;
      awayShots: number;
      homePos: number;
      awayPos: number;
    }
  }) => void;
  onNotify?: (title: string, message: string, variant?: 'info' | 'success' | 'warning' | 'danger') => void;
}

// Pool of nostalgic, high-tension match commentaries in Turkish
const COMMENTARY_TEMPLATES = {
  GOAL_HEADER: [
    "MÜTHİŞ BİR GOL!", "İNANILMAZ ANLAR SAF SAF!", "AĞLAR SARSILDI!", "GOOOOOL!"
  ],
  COMMENT_NORMAL: [
    "Orta alanda kıyasıya bir mücadele var. İki takım da pas trafiği kurmakta zorlanıyor.",
    "Savunmada derin boşluklar arayan forvet hattı ofsayt bayrağına takılıyor.",
    "Tribünler desteğini iyice artırdı, müthiş bir atmosfer var sahada.",
    "Pas hatası! Sol kanattan gelişen hızlı akın taç çizgisi yakınında kesiliyor.",
    "Hava topu mücadelesinde top orta sahada kalıyor, tempo biraz düştü."
  ],
  COMMENT_CHANCE_MISS: [
    "Şut şansı! Kaleciyle karşı karşıya kaldı ve vuruşunu yaptı... Direğin hemen yanından dışarıda!",
    "Karambol! Ceza sahasında savunmadan dönen topa sert vuruş... Milimetre farkıyla üstten avuta!",
    "Müthiş kurtarış! Kaleci son anda köşeye giden şutu kornere çeliyor!",
    "Direkten döndü! Havada asılı kalan forvet kafayı vurdu, top direkle buluştu!"
  ],
  COMMENT_GOAL: [
    "GOOOL! Ceza sahası dışından inanılmaz bir şut çekti ve kaleci çaresiz kaldı!",
    "GOOOL! Sağ kanattan kesilen nefis ortaya harika bir kafa vuruşu! Top köşeden ağlarda!",
    "GOOOL! Savunma arkasına atılan pası çok iyi kontrol etti, kaleciyi şık bir çalımla geçip boş ağlara yuvarladı!",
    "GOOOL! Ceza sahası içinde dönen topa ani ve sert bir dokunuşla kaleciyi ters köşede bıraktı!"
  ]
};

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  choice<T>(arr: T[]): T {
    if (arr.length === 0) return undefined as any;
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx];
  }
}

type TeamSide = 'home' | 'away';

interface LivePitchPlayer {
  id: string;
  name: string;
  position: string;
  team: TeamSide;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  heading: number;
  stamina: number;
  rating: number;
  number: number;
  actionCooldown: number;
  lastTouchTick: number;
}

interface LiveBallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ownerId: string | null;
  lastTouchTeam: TeamSide | null;
  lastTouchPlayerId: string | null;
  looseUntilTick: number;
  deadUntilTick: number;
  homePossTicks: number;
  totalPossTicks: number;
  lastShotTick: number;
}

interface PlannedGoal {
  minute: number;
  team: TeamSide;
  scorerId?: string;
  played: boolean;
  y: number;
}

declare global {
  interface Window {
    __MATCH_DEBUG__?: boolean;
  }
}

const FIELD_MIN_X = 2.5;
const FIELD_MAX_X = 97.5;
const PLAYER_MIN_Y = 2.5;
const PLAYER_MAX_Y = 97.5;
const BALL_MIN_Y = 1.5;
const BALL_MAX_Y = 98.5;
const GOAL_MIN_Y = 42;
const GOAL_MAX_Y = 58;
const TICK_SECONDS = 0.05;
const PLAYER_COLLISION_RADIUS = 1.75;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const distanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return distance(px, py, ax, ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  return distance(px, py, ax + dx * t, ay + dy * t);
};
const normalize = (x: number, y: number) => {
  const len = Math.hypot(x, y);
  if (len < 0.0001) return { x: 0, y: 0, len: 0 };
  return { x: x / len, y: y / len, len };
};
const hashSeed = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export default function MatchEngine({ homeClub, awayClub, homeSquad, awaySquad, userTactics, isUserHome, initialSeed, onMatchFinished, onNotify }: MatchEngineProps) {
  const [matchSeed, setMatchSeed] = useState(initialSeed || 1780083284);
  const rngRef = useRef<SeededRandom>(new SeededRandom(initialSeed || 1780083284));

  const resetRNG = (seed: number) => {
    rngRef.current = new SeededRandom(seed);
  };

  const [preMatchSetup, setPreMatchSetup] = useState(true);

  // Home Tactics (user or auto)
  const [homeFormation, setHomeFormation] = useState<Tactics['formation']>(userTactics.formation);
  const [homeMentality, setHomeMentality] = useState<Tactics['mentality']>(userTactics.mentality);
  const [homeStyle, setHomeStyle] = useState<Tactics['style']>(userTactics.style);

  // Away Tactics (AI/opponent)
  const [awayFormation, setAwayFormation] = useState<Tactics['formation']>('4-4-2');
  const [awayMentality, setAwayMentality] = useState<Tactics['mentality']>('BALANCED');
  const [awayStyle, setAwayStyle] = useState<Tactics['style']>('COUNTER_ATTACK');

  const [minute, setMinute] = useState(0);
  const [second, setSecond] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [homeShots, setHomeShots] = useState(0);
  const [awayShots, setAwayShots] = useState(0);
  const [possession, setPossession] = useState(50); // home possession
  const [logs, setLogs] = useState<string[]>(["Hakem maçı başlatan düdüğü çalıyor! Her iki takıma da başarılar."]);
  const [isSimulating, setIsSimulating] = useState(false); // start off for tactile selection!
  const [speed, setSpeed] = useState<1 | 2 | 5 | 50>(1); // timer ticks interval coefficient
  const [matchDone, setMatchDone] = useState(false);
  const [showMatchEndOverlay, setShowMatchEndOverlay] = useState(false);
  const [soundMuted, setSoundMuted] = useState(soundEngine.getMuteStatus());
  const [matchViewMode, setMatchViewMode] = useState<'3D' | '2D'>('3D');
  
  // Tactical overrides inside the match
  const [currentMentality, setCurrentMentality] = useState<Tactics['mentality']>(userTactics.mentality);
  
  // Substitutions Trackers
  const [subCount, setSubCount] = useState(0);
  const [subsModalOpen, setSubsModalOpen] = useState(false);

  // --- AstroTurf 2D Pitch Interactive State ---
  const [pitchPlayers, setPitchPlayers] = useState<LivePitchPlayer[]>([]);
  const [ball, setBall] = useState({ x: 50, y: 50 });
  const [ballTarget, setBallTarget] = useState({ x: 50, y: 50 });
  const [referee, setReferee] = useState({ x: 50, y: 50 });
  const [passingLines, setPassingLines] = useState<Array<{ fromX: number; fromY: number; toX: number; toY: number; time: number }>>([]);
  const [fxState, setFxState] = useState<{ type: 'GOAL' | 'SAVE' | 'MISS' | 'CARD' | 'RED_CARD' | 'FOUL' | 'INJURY' | 'NONE'; text?: string; team?: 'home' | 'away'; x?: number; y?: number } | null>(null);

  const scorersRef = useRef<string[]>([]);
  const matchEventsRef = useRef<MatchEvent[]>([]);

  // Real-time gameplay state-machine refs
  const playPhaseRef = useRef<'KICKOFF' | 'MIDFIELD' | 'HOME_ATTACK' | 'AWAY_ATTACK' | 'SHOT_FLIGHT' | 'CELEBRATION' | 'FOUL_PAUSE'>('KICKOFF');
  const ballPossessorIdRef = useRef<string | null>(null);
  const activeAttackerIdRef = useRef<string | null>(null);
  const flightTargetRef = useRef<{ x: number; y: number } | null>(null);
  const shootTypeRef = useRef<'GOAL' | 'SAVE' | 'MISS'>('GOAL');
  const phaseTicksRef = useRef<number>(0);
  const lastPassTimeRef = useRef<number>(0);
  const intendedReceiverIdRef = useRef<string | null>(null);
  const passerIdRef = useRef<string | null>(null);
  const passTicksRef = useRef<number>(0);
  const pendingGoalRef = useRef<{
    home: boolean;
    scorerName: string;
    clubName: string;
    clubShort: string;
    clubId: string;
    assistantName?: string;
    minute: number;
  } | null>(null);

  const pendingShotRef = useRef<{
    isSaved: boolean;
    attackerName: string;
    clubShort: string;
    minute: number;
  } | null>(null);

  const liveTickRef = useRef(0);
  const minuteRef = useRef(minute);
  const debugRef = useRef({
    lastSnapshot: '',
    sameSnapshotTicks: 0,
    lastTickAt: 0,
    lastLoggedTick: 0
  });
  const ballSimRef = useRef<LiveBallState>({
    x: 50,
    y: 50,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    ownerId: null,
    lastTouchTeam: null,
    lastTouchPlayerId: null,
    looseUntilTick: 0,
    deadUntilTick: 0,
    homePossTicks: 0,
    totalPossTicks: 0,
    lastShotTick: -999
  });
  const matchPlanRef = useRef<{ seed: number; goals: PlannedGoal[] }>({ seed: matchSeed, goals: [] });

  useEffect(() => {
    const shouldPlayCrowd = !preMatchSetup && isSimulating && !matchDone && matchViewMode === '3D';

    if (shouldPlayCrowd && !soundMuted) {
      soundEngine.playCrowd();
    } else {
      soundEngine.stopCrowd(!shouldPlayCrowd);
    }
  }, [preMatchSetup, isSimulating, matchDone, matchViewMode, soundMuted]);

  useEffect(() => {
    return () => {
      soundEngine.stopCrowd();
    };
  }, []);

  // Helper for generating initial coordinates of 22 players on the pitch
  const getTacticalCoords = (formation: Tactics['formation'], isHome: boolean) => {
    const coords: Array<{ x: number, y: number }> = [];
    coords.push({ x: isHome ? 8 : 92, y: 50 }); // GK

    if (formation === '4-3-3') {
      if (isHome) {
        coords.push({ x: 22, y: 15 }); // LB
        coords.push({ x: 22, y: 38 }); // LCB
        coords.push({ x: 22, y: 62 }); // RCB
        coords.push({ x: 22, y: 85 }); // RB
        coords.push({ x: 44, y: 25 }); // LCM
        coords.push({ x: 44, y: 50 }); // CM
        coords.push({ x: 44, y: 75 }); // RCM
        coords.push({ x: 68, y: 20 }); // LW
        coords.push({ x: 74, y: 50 }); // ST
        coords.push({ x: 68, y: 80 }); // RW
      } else {
        coords.push({ x: 78, y: 15 }); // RB
        coords.push({ x: 78, y: 38 }); // RCB
        coords.push({ x: 78, y: 62 }); // LCB
        coords.push({ x: 78, y: 85 }); // LB
        coords.push({ x: 56, y: 25 }); // RCM
        coords.push({ x: 56, y: 50 }); // CM
        coords.push({ x: 56, y: 75 }); // LCM
        coords.push({ x: 32, y: 20 }); // RW
        coords.push({ x: 26, y: 50 }); // ST
        coords.push({ x: 32, y: 80 }); // LW
      }
    } else if (formation === '3-5-2') {
      if (isHome) {
        coords.push({ x: 22, y: 25 }); // LCB
        coords.push({ x: 22, y: 50 }); // CB
        coords.push({ x: 22, y: 75 }); // RCB
        coords.push({ x: 44, y: 12 }); // LWB
        coords.push({ x: 44, y: 31 }); // LCM
        coords.push({ x: 44, y: 50 }); // CM
        coords.push({ x: 44, y: 69 }); // RCM
        coords.push({ x: 44, y: 88 }); // RWB
        coords.push({ x: 74, y: 35 }); // LS
        coords.push({ x: 74, y: 65 }); // RS
      } else {
        coords.push({ x: 78, y: 25 }); // RCB
        coords.push({ x: 78, y: 50 }); // CB
        coords.push({ x: 78, y: 75 }); // LCB
        coords.push({ x: 56, y: 12 }); // RWB
        coords.push({ x: 56, y: 31 }); // RCM
        coords.push({ x: 56, y: 50 }); // CM
        coords.push({ x: 56, y: 69 }); // LCM
        coords.push({ x: 56, y: 88 }); // LWB
        coords.push({ x: 26, y: 35 }); // RS
        coords.push({ x: 26, y: 65 }); // LS
      }
    } else if (formation === '4-2-3-1') {
      if (isHome) {
        coords.push({ x: 22, y: 15 }); // LB
        coords.push({ x: 22, y: 38 }); // LCB
        coords.push({ x: 22, y: 62 }); // RCB
        coords.push({ x: 22, y: 85 }); // RB
        coords.push({ x: 38, y: 32 }); // LDMC
        coords.push({ x: 38, y: 68 }); // RDMC
        coords.push({ x: 55, y: 20 }); // LAM
        coords.push({ x: 55, y: 50 }); // CAM
        coords.push({ x: 55, y: 80 }); // RAM
        coords.push({ x: 74, y: 50 }); // ST
      } else {
        coords.push({ x: 78, y: 15 }); // RB
        coords.push({ x: 78, y: 38 }); // RCB
        coords.push({ x: 78, y: 62 }); // LCB
        coords.push({ x: 78, y: 85 }); // LB
        coords.push({ x: 62, y: 32 }); // RDMC
        coords.push({ x: 62, y: 68 }); // LDMC
        coords.push({ x: 45, y: 20 }); // RAM
        coords.push({ x: 45, y: 50 }); // CAM
        coords.push({ x: 45, y: 80 }); // LAM
        coords.push({ x: 26, y: 50 }); // ST
      }
    } else if (formation === '5-3-2') {
      if (isHome) {
        coords.push({ x: 22, y: 12 }); // LWB
        coords.push({ x: 22, y: 31 }); // LCB
        coords.push({ x: 22, y: 50 }); // CB
        coords.push({ x: 22, y: 69 }); // RCB
        coords.push({ x: 22, y: 88 }); // RWB
        coords.push({ x: 44, y: 25 }); // LCM
        coords.push({ x: 44, y: 50 }); // CM
        coords.push({ x: 44, y: 75 }); // RCM
        coords.push({ x: 74, y: 35 }); // LS
        coords.push({ x: 74, y: 65 }); // RS
      } else {
        coords.push({ x: 78, y: 12 }); // RWB
        coords.push({ x: 78, y: 31 }); // RCB
        coords.push({ x: 78, y: 50 }); // CB
        coords.push({ x: 78, y: 69 }); // LCB
        coords.push({ x: 78, y: 88 }); // LWB
        coords.push({ x: 56, y: 25 }); // RCM
        coords.push({ x: 56, y: 50 }); // CM
        coords.push({ x: 56, y: 75 }); // LCM
        coords.push({ x: 26, y: 35 }); // RS
        coords.push({ x: 26, y: 65 }); // LS
      }
    } else {
      // 4-4-2 default
      if (isHome) {
        coords.push({ x: 22, y: 15 }); // LB
        coords.push({ x: 22, y: 38 }); // LCB
        coords.push({ x: 22, y: 62 }); // RCB
        coords.push({ x: 22, y: 85 }); // RB
        coords.push({ x: 44, y: 15 }); // LM
        coords.push({ x: 44, y: 38 }); // LCM
        coords.push({ x: 44, y: 62 }); // RCM
        coords.push({ x: 44, y: 85 }); // RM
        coords.push({ x: 74, y: 33 }); // LS
        coords.push({ x: 74, y: 67 }); // RS
      } else {
        coords.push({ x: 78, y: 15 }); // RB
        coords.push({ x: 78, y: 38 }); // RCB
        coords.push({ x: 78, y: 62 }); // LCB
        coords.push({ x: 78, y: 85 }); // LB
        coords.push({ x: 56, y: 15 }); // RM
        coords.push({ x: 56, y: 38 }); // RCM
        coords.push({ x: 56, y: 62 }); // LCM
        coords.push({ x: 56, y: 85 }); // LM
        coords.push({ x: 26, y: 33 }); // RS
        coords.push({ x: 26, y: 67 }); // LS
      }
    }
    return coords;
  };

  const getInitialPositions = (homeList: Player[], awayList: Player[], homeF: Tactics['formation'], awayF: Tactics['formation']): LivePitchPlayer[] => {
    const list: LivePitchPlayer[] = [];
    
    const createPositions = (startersList: Player[], isHome: boolean, formation: Tactics['formation']) => {
      const gks = startersList.filter(p => p.position === 'GK');
      const defs = startersList.filter(p => p.position === 'DEF');
      const mids = startersList.filter(p => p.position === 'MID');
      const atts = startersList.filter(p => p.position === 'ATT');

      const tacticalCoords = getTacticalCoords(formation, isHome);
      const allocatedPlayers = [...gks, ...defs, ...mids, ...atts];

      allocatedPlayers.forEach((p, idx) => {
        const coord = tacticalCoords[idx] || { x: isHome ? 20 + idx * 5 : 80 - idx * 5, y: 50 };
        list.push({
          id: p.id,
          name: p.name,
          position: p.position,
          team: isHome ? 'home' : 'away',
          x: coord.x,
          y: coord.y,
          baseX: coord.x,
          baseY: coord.y,
          vx: 0,
          vy: 0,
          heading: isHome ? 0 : Math.PI,
          stamina: 100,
          rating: p.rating,
          number: p.pitchPosition || (idx + 1),
          actionCooldown: 0,
          lastTouchTick: -999
        });
      });
    };

    createPositions(homeList.filter(p => p.isStarting), true, homeF);
    createPositions(awayList.filter(p => p.isStarting), false, awayF);
    return list;
  };

  const resetLivePhysics = () => {
    liveTickRef.current = 0;
    debugRef.current = {
      lastSnapshot: '',
      sameSnapshotTicks: 0,
      lastTickAt: 0,
      lastLoggedTick: 0
    };
    ballSimRef.current = {
      x: 50,
      y: 50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ownerId: null,
      lastTouchTeam: null,
      lastTouchPlayerId: null,
      looseUntilTick: 35,
      deadUntilTick: 35,
      homePossTicks: 0,
      totalPossTicks: 0,
      lastShotTick: -999
    };
  };

  const handleReplayMatch = () => {
    prepareMatchPlan(matchSeed);
    resetRNG(matchSeed);
    resetLivePhysics();
    setMinute(0);
    setSecond(0);
    setHomeScore(0);
    setAwayScore(0);
    setHomeShots(0);
    setAwayShots(0);
    setPossession(50);
    scorersRef.current = [];
    matchEventsRef.current = [];
    setBall({ x: 50, y: 50 });
    setBallTarget({ x: 50, y: 50 });
    setLogs(["Hakem maçı başlatan düdüğü çalıyor! Her iki takıma da başarılar."]);
    setMatchDone(false);
    setShowMatchEndOverlay(false);
    setIsSimulating(true);
    soundEngine.playMatchStart();
    soundEngine.playWhistle(true);
    if (matchViewMode === '3D') {
      soundEngine.playCrowd();
    }
    setSubCount(0);
    setPitchPlayers(getInitialPositions(homeSquad, awaySquad, homeFormation, awayFormation));

    playPhaseRef.current = 'KICKOFF';
    ballPossessorIdRef.current = null;
    activeAttackerIdRef.current = null;
    flightTargetRef.current = null;
    phaseTicksRef.current = 0;
    pendingGoalRef.current = null;
    pendingShotRef.current = null;
    lastPassTimeRef.current = 0;
  };

  const toggleSimulation = () => {
    setIsSimulating((wasSimulating) => {
      const nextSimulating = !wasSimulating;

      if (nextSimulating) {
        soundEngine.playMatchStart();
        if (matchViewMode === '3D') {
          soundEngine.playCrowd();
        }
      } else {
        soundEngine.playMatchEnd();
        soundEngine.stopCrowd();
      }

      return nextSimulating;
    });
  };

  useEffect(() => {
    if (initialSeed) {
      setMatchSeed(initialSeed);
      resetRNG(initialSeed);
    } else {
      resetRNG(matchSeed);
    }
  }, [matchSeed, initialSeed]);

  const fxStateRef = useRef(fxState);
  useEffect(() => {
    fxStateRef.current = fxState;
  }, [fxState]);

  // Persistent refs for background intervals to run uninterrupted
  const ballTargetRef = useRef(ballTarget);
  const ballRef = useRef(ball);
  const pitchPlayersRef = useRef(pitchPlayers);
  const possessionRef = useRef(possession);

  useEffect(() => {
    ballTargetRef.current = ballTarget;
  }, [ballTarget]);

  useEffect(() => {
    ballRef.current = ball;
  }, [ball]);

  useEffect(() => {
    pitchPlayersRef.current = pitchPlayers;
  }, [pitchPlayers]);

  useEffect(() => {
    possessionRef.current = possession;
  }, [possession]);

  useEffect(() => {
    minuteRef.current = minute;
  }, [minute]);

  // Get active configurations depending on whether user is home or away
  const userSquad = isUserHome ? homeSquad : awaySquad;
  const starters = userSquad.filter(p => p.isStarting);
  const bench = userSquad.filter(p => !p.isStarting && p.injuryWeeks === 0);

  // Strength scores calculated
  const getTeamRosterOvr = (roster: Player[]) => {
    const active = roster ? roster.filter(p => p.isStarting) : [];
    if (active.length === 0) return 60;
    const sum = active.reduce((agg, p) => {
      const r = typeof p.rating === 'number' && !isNaN(p.rating) ? p.rating : 60;
      return agg + r;
    }, 0);
    return Math.round(sum / active.length);
  };

  const homeOvr = getTeamRosterOvr(homeSquad);
  const awayOvr = getTeamRosterOvr(awaySquad);

  const getGoalBias = (mentality: Tactics['mentality'], style: Tactics['style']) => {
    const mentalityBias = {
      DEFENSIVE: -0.32,
      CAUTIOUS: -0.14,
      BALANCED: 0,
      ATTACKING: 0.26,
      OVERLOAD: 0.42
    }[mentality];
    const styleBias = {
      TIKI_TAKA: 0.05,
      GEGENPRESS: 0.12,
      WING_PLAY: 0.08,
      PARK_BUS: -0.24,
      COUNTER_ATTACK: 0.1
    }[style];
    return mentalityBias + styleBias;
  };

  const sampleGoals = (rng: SeededRandom, expectedGoals: number) => {
    let goals = 0;
    for (let slot = 0; slot < 6; slot++) {
      const chance = clamp(expectedGoals / (slot + 1.85), 0.02, 0.74);
      if (rng.next() < chance) goals++;
    }
    return clamp(goals, 0, 5);
  };

  const choosePlannedScorer = (rng: SeededRandom, team: TeamSide) => {
    const squad = (team === 'home' ? homeSquad : awaySquad).filter(p => p.isStarting);
    const ordered = [...squad].sort((a, b) => {
      const roleA = a.position === 'ATT' ? 30 : a.position === 'MID' ? 18 : a.position === 'DEF' ? 6 : 1;
      const roleB = b.position === 'ATT' ? 30 : b.position === 'MID' ? 18 : b.position === 'DEF' ? 6 : 1;
      return (b.rating + roleB) - (a.rating + roleA);
    });
    if (ordered.length === 0) return undefined;
    const topWindow = ordered.slice(0, Math.min(6, ordered.length));
    return rng.choice(topWindow)?.id;
  };

  const prepareMatchPlan = (seed: number) => {
    const planSeed = (seed || 1) + hashSeed(`${homeClub.id}:${awayClub.id}:${homeMentality}:${awayMentality}:${homeStyle}:${awayStyle}:${homeFormation}:${awayFormation}`);
    const rng = new SeededRandom(planSeed);
    const homeExpected = clamp(1.18 + (homeOvr - awayOvr) * 0.035 + 0.18 + getGoalBias(homeMentality, homeStyle), 0.2, 3.85);
    const awayExpected = clamp(1.05 + (awayOvr - homeOvr) * 0.035 + getGoalBias(awayMentality, awayStyle), 0.2, 3.65);
    const homeGoals = sampleGoals(rng, homeExpected);
    const awayGoals = sampleGoals(rng, awayExpected);
    const usedMinutes = new Set<number>();
    const goals: PlannedGoal[] = [];

    const reserveMinute = () => {
      let minute = Math.floor(rng.range(7, 88));
      while (usedMinutes.has(minute) || minute === 45) {
        minute = minute >= 88 ? 7 : minute + 1;
      }
      usedMinutes.add(minute);
      return minute;
    };

    const addGoals = (team: TeamSide, count: number) => {
      for (let i = 0; i < count; i++) {
        goals.push({
          minute: reserveMinute(),
          team,
          scorerId: choosePlannedScorer(rng, team),
          played: false,
          y: clamp(47 + rng.range(-7, 7), 39, 61)
        });
      }
    };

    addGoals('home', homeGoals);
    addGoals('away', awayGoals);
    goals.sort((a, b) => a.minute - b.minute);
    matchPlanRef.current = { seed, goals };
  };

  const resolveGoalScorerName = (goal: PlannedGoal, fallback?: string) => {
    const player = [...homeSquad, ...awaySquad].find(p => p.id === goal.scorerId);
    return player?.name || fallback || (goal.team === 'home' ? homeClub.shortName : awayClub.shortName);
  };

  const getGoalBallPosition = (team: TeamSide, y: number) => ({
    x: team === 'home' ? 100 : 0,
    y: clamp(y, 45, 55)
  });

  const recordGoalEvent = (goal: PlannedGoal, fallbackScorer?: string) => {
    const club = goal.team === 'home' ? homeClub : awayClub;
    const scorerName = resolveGoalScorerName(goal, fallbackScorer);
    const goalMinute = Math.max(1, goal.minute);
    const scorerStr = `${goalMinute}'. ${scorerName} (${club.shortName})`;
    const goalBallPosition = getGoalBallPosition(goal.team, goal.y);
    const ballState = ballSimRef.current;

    ballState.x = goalBallPosition.x;
    ballState.y = goalBallPosition.y;
    ballState.z = 0;
    ballState.vx = 0;
    ballState.vy = 0;
    ballState.vz = 0;
    ballState.ownerId = null;
    ballState.lastTouchTeam = goal.team;
    ballState.looseUntilTick = liveTickRef.current + 20;
    ballState.deadUntilTick = Math.max(ballState.deadUntilTick, liveTickRef.current + 95);
    ballPossessorIdRef.current = null;
    activeAttackerIdRef.current = null;
    intendedReceiverIdRef.current = null;
    passerIdRef.current = null;
    playPhaseRef.current = 'CELEBRATION';

    scorersRef.current.push(scorerStr);
    matchEventsRef.current.push({
      minute: goalMinute,
      type: 'GOAL',
      teamId: club.id,
      playerName: scorerName,
      detail: 'Seed planına bağlı deterministik maç motorunda gelişen pozisyon.'
    });

    if (goal.team === 'home') {
      setHomeScore(prev => prev + 1);
      setHomeShots(prev => prev + 1);
    } else {
      setAwayScore(prev => prev + 1);
      setAwayShots(prev => prev + 1);
    }

    setBall(goalBallPosition);
    setBallTarget(goalBallPosition);
    setLogs(prev => [
      ...prev,
      `${goalMinute}' [GOOOL] - ${club.name} seed planındaki golünü buldu! Gol: ${scorerName}`
    ]);
    setFxState({
      type: 'GOAL',
      text: `GOOOL! ${scorerName} • ${club.shortName}`,
      team: goal.team,
      x: goalBallPosition.x,
      y: goalBallPosition.y
    });
  };

  const consumeDuePlannedGoal = (team: TeamSide, minuteLimit: number) => {
    const goal = matchPlanRef.current.goals.find(g => !g.played && g.team === team && g.minute <= minuteLimit);
    if (!goal) return null;
    goal.played = true;
    return goal;
  };

  const triggerDuePlannedGoals = (minuteLimit: number) => {
    matchPlanRef.current.goals
      .filter(goal => !goal.played && goal.minute <= minuteLimit)
      .forEach(goal => {
        goal.played = true;
        recordGoalEvent(goal);
      });
  };

  useEffect(() => {
    const pList = getInitialPositions(homeSquad, awaySquad, homeFormation, awayFormation);
    setPitchPlayers(pList);
  }, [homeSquad, awaySquad, homeFormation, awayFormation]);

  // Real-time Haxball-like football core: players accelerate, the ball carries velocity,
  // and match events emerge from touches, shots, saves and goal-line crossings.
  useEffect(() => {
    if (!isSimulating || matchDone) return;

    const interval = setInterval(() => {
      const rng = rngRef.current;
      const tick = ++liveTickRef.current;
      const ballState = ballSimRef.current;
      const debugEnabled = typeof window !== 'undefined' && window.__MATCH_DEBUG__ === true;
      const debug = debugRef.current;
      const nowMs = performance.now();
      const tickGap = debug.lastTickAt > 0 ? nowMs - debug.lastTickAt : 0;
      debug.lastTickAt = nowMs;
      let players = pitchPlayersRef.current as LivePitchPlayer[];

      if (players.length === 0) {
        players = getInitialPositions(homeSquad, awaySquad, homeFormation, awayFormation);
        pitchPlayersRef.current = players;
        if (debugEnabled) {
          console.info('[match-debug] rebuilt empty player list', { tick, players: players.length });
        }
      }

      const resetForKickoff = () => {
        ballState.x = 50;
        ballState.y = 50;
        ballState.z = 0;
        ballState.vx = 0;
        ballState.vy = 0;
        ballState.vz = 0;
        ballState.ownerId = null;
        ballState.looseUntilTick = tick + 20;
        ballPossessorIdRef.current = null;
        activeAttackerIdRef.current = null;
        intendedReceiverIdRef.current = null;
        passerIdRef.current = null;
        setFxState(null);
      };

      if (ballState.deadUntilTick > tick) {
        const nextPlayers = players.map(p => ({
          ...p,
          vx: p.vx * 0.82,
          vy: p.vy * 0.82,
          x: p.x + (p.baseX - p.x) * 0.045,
          y: p.y + (p.baseY - p.y) * 0.045
        }));
        pitchPlayersRef.current = nextPlayers;
        setPitchPlayers(nextPlayers);
        setBall({ x: clamp(ballState.x, 0, 100), y: clamp(ballState.y, 0, 100) });
        setBallTarget({ x: clamp(ballState.x, 0, 100), y: clamp(ballState.y, 0, 100) });
        if (debugEnabled && tick % 10 === 0) {
          console.info('[match-debug] dead-ball wait ' + JSON.stringify({
            tick,
            remaining: ballState.deadUntilTick - tick,
            ball: { x: Number(ballState.x.toFixed(2)), y: Number(ballState.y.toFixed(2)) },
            players: nextPlayers.length,
            tickGap: Number(tickGap.toFixed(1))
          }));
        }
        return;
      }

      if (ballState.deadUntilTick !== 0 && tick >= ballState.deadUntilTick) {
        if (debugEnabled) {
          console.info('[match-debug] leaving dead-ball state ' + JSON.stringify({ tick, deadUntilTick: ballState.deadUntilTick }));
        }
        ballState.deadUntilTick = 0;
        resetForKickoff();
      }

      const getTeamPlayers = (team: TeamSide) => players.filter(p => p.team === team && p.position !== 'GK');
      const currentOwner = ballState.ownerId ? players.find(p => p.id === ballState.ownerId) || null : null;

      const getTeamMentality = (team: TeamSide): Tactics['mentality'] => {
        if (team === 'home') return isUserHome ? currentMentality : homeMentality;
        return !isUserHome ? currentMentality : awayMentality;
      };

      const getTeamStyle = (team: TeamSide): Tactics['style'] => team === 'home' ? homeStyle : awayStyle;

      const getTacticalProfile = (team: TeamSide) => {
        const mentality = getTeamMentality(team);
        const style = getTeamStyle(team);

        const mentalityProfile = {
          DEFENSIVE: { line: -8, press: 0.75, support: 0.72, risk: 0.72, shot: -0.06, direct: 0.82, width: 0.88 },
          CAUTIOUS: { line: -4, press: 0.9, support: 0.86, risk: 0.86, shot: -0.03, direct: 0.92, width: 0.95 },
          BALANCED: { line: 0, press: 1.0, support: 1.0, risk: 1.0, shot: 0, direct: 1.0, width: 1.0 },
          ATTACKING: { line: 6, press: 1.18, support: 1.16, risk: 1.16, shot: 0.06, direct: 1.08, width: 1.05 },
          OVERLOAD: { line: 10, press: 1.34, support: 1.28, risk: 1.26, shot: 0.1, direct: 1.14, width: 1.12 }
        }[mentality];

        const styleProfile = {
          TIKI_TAKA: { passShort: 1.35, passLong: 0.68, press: 1.04, width: 0.92, wing: 0.78, dribble: 0.82, shoot: -0.02, counter: 0.86 },
          GEGENPRESS: { passShort: 0.92, passLong: 1.0, press: 1.32, width: 1.0, wing: 0.95, dribble: 0.92, shoot: 0.04, counter: 1.05 },
          WING_PLAY: { passShort: 0.9, passLong: 1.08, press: 0.98, width: 1.34, wing: 1.55, dribble: 1.08, shoot: 0.02, counter: 1.0 },
          PARK_BUS: { passShort: 0.82, passLong: 1.28, press: 0.68, width: 0.82, wing: 0.88, dribble: 0.72, shoot: -0.04, counter: 1.28 },
          COUNTER_ATTACK: { passShort: 0.76, passLong: 1.42, press: 0.9, width: 1.1, wing: 1.0, dribble: 1.0, shoot: 0.05, counter: 1.45 }
        }[style];

        return {
          mentality,
          style,
          linePush: mentalityProfile.line,
          press: mentalityProfile.press * styleProfile.press,
          support: mentalityProfile.support,
          risk: mentalityProfile.risk,
          directness: mentalityProfile.direct * styleProfile.passLong,
          shortness: styleProfile.passShort,
          width: mentalityProfile.width * styleProfile.width,
          wingBias: styleProfile.wing,
          dribbleBias: styleProfile.dribble,
          shotBias: mentalityProfile.shot + styleProfile.shoot,
          counterBias: styleProfile.counter
        };
      };

      const findClosest = (pool: LivePitchPlayer[], x: number, y: number, excludeId?: string | null) => {
        let best: LivePitchPlayer | null = null;
        let bestDist = Infinity;
        pool.forEach(p => {
          if (excludeId && p.id === excludeId) return;
          const d = distance(p.x, p.y, x, y);
          if (d < bestDist) {
            best = p;
            bestDist = d;
          }
        });
        return { player: best, dist: bestDist };
      };

      const registerGoal = (scoringTeam: TeamSide, scorer?: LivePitchPlayer | null) => {
        const plannedGoal = consumeDuePlannedGoal(scoringTeam, minuteRef.current + 1);
        if (!plannedGoal) {
          ballState.x = clamp(ballState.x, 0, 100);
          ballState.vx = -ballState.vx * 0.28;
          ballState.vy *= 0.62;
          ballState.vz = Math.max(0, ballState.vz) * 0.3;
          ballState.looseUntilTick = tick + 10;
          setFxState({
            type: 'MISS',
            text: 'Az farkla dışarı!',
            team: scoringTeam,
            x: scoringTeam === 'home' ? 98 : 2,
            y: ballState.y
          });
          return;
        }

        ballState.deadUntilTick = tick + 95;
        ballState.ownerId = null;
        ballState.vx = 0;
        ballState.vy = 0;
        ballState.vz = 0;
        ballPossessorIdRef.current = null;
        playPhaseRef.current = 'CELEBRATION';
        recordGoalEvent(plannedGoal, scorer?.name);
      };

      const kickBall = (kicker: LivePitchPlayer, targetX: number, targetY: number, power: number, loft: number) => {
        const dir = normalize(targetX - kicker.x, targetY - kicker.y);
        ballState.x = kicker.x + dir.x * 1.4;
        ballState.y = kicker.y + dir.y * 1.4;
        ballState.vx = dir.x * power;
        ballState.vy = dir.y * power;
        ballState.z = 0.2;
        ballState.vz = loft;
        ballState.ownerId = null;
        ballState.lastTouchTeam = kicker.team;
        ballState.lastTouchPlayerId = kicker.id;
        ballState.looseUntilTick = tick + 7;
        ballPossessorIdRef.current = null;
        kicker.lastTouchTick = tick;
        soundEngine.playKick();
      };

      const choosePassTarget = (passer: LivePitchPlayer) => {
        const mates = getTeamPlayers(passer.team).filter(p => p.id !== passer.id);
        if (mates.length === 0) return null;
        const forward = passer.team === 'home' ? 1 : -1;
        const profile = getTacticalProfile(passer.team);
        const minDistance = profile.shortness > 1.1 ? 5 : 8;
        const maxDistance = clamp(24 + profile.directness * 16, 28, 52);
        let best: LivePitchPlayer | null = null;
        let bestScore = -Infinity;
        mates.forEach(mate => {
          const d = distance(passer.x, passer.y, mate.x, mate.y);
          if (d < minDistance || d > maxDistance) return;
          const passOpponents = players.filter(p => p.team !== passer.team && p.position !== 'GK');
          const nearestOpponent = findClosest(passOpponents, mate.x, mate.y).dist;
          const lanePressure = passOpponents.reduce((sum, opponent) => {
            const laneDistance = distanceToSegment(opponent.x, opponent.y, passer.x, passer.y, mate.x, mate.y);
            if (laneDistance > 5.2) return sum;
            const passerDistance = distance(opponent.x, opponent.y, passer.x, passer.y);
            const mateDistance = distance(opponent.x, opponent.y, mate.x, mate.y);
            if (passerDistance < 2.2 || mateDistance < 2.2) return sum;
            return sum + (5.2 - laneDistance) * (d > 24 ? 1.35 : 1);
          }, 0);
          const progress = (mate.x - passer.x) * forward;
          const wideLane = Math.abs(mate.y - 50) / 50;
          const safeRecycle = progress < -2 ? 4 * (profile.shortness - 0.8) : 0;
          const supportAngle = 10 - Math.abs(mate.y - passer.y) * 0.08;
          const distanceFit = profile.shortness > profile.directness
            ? -Math.abs(d - 13) * 0.38
            : -Math.abs(d - 28) * 0.22;
          const score =
            nearestOpponent * 1.65 +
            progress * (0.35 + profile.directness * 0.28) +
            wideLane * 7 * profile.wingBias +
            safeRecycle +
            supportAngle +
            distanceFit +
            -lanePressure * (1.85 + (1.15 - profile.risk) * 0.7) +
            rng.range(-4, 4);
          if (score > bestScore) {
            bestScore = score;
            best = mate;
          }
        });
        return best || rng.choice(mates);
      };

      if (currentOwner) {
        const ownerProfile = getTacticalProfile(currentOwner.team);
        const opponents = players.filter(p => p.team !== currentOwner.team);
        const nearestOpponent = findClosest(opponents, currentOwner.x, currentOwner.y);
        const pressure = nearestOpponent.dist;
        const shotLane = currentOwner.team === 'home'
          ? currentOwner.x > 76 - ownerProfile.linePush * 0.35
          : currentOwner.x < 24 + ownerProfile.linePush * 0.35;
        const centralAngle = 1 - Math.min(1, Math.abs(currentOwner.y - 50) / 32);
        const pressurePanic = clamp((8 - pressure) / 8, 0, 1);
        const shootingProfile = currentOwner.position === 'ATT' ? 1.2 : currentOwner.position === 'MID' ? 0.82 : 0.42;

        if (pressure < 1.7 && nearestOpponent.player && tick > currentOwner.lastTouchTick + 8) {
          const defenderProfile = getTacticalProfile(nearestOpponent.player.team);
          const stealChance = 0.06 + defenderProfile.press * 0.035 + (nearestOpponent.player.rating - currentOwner.rating) * 0.002;
          if (rng.next() < stealChance) {
            ballState.ownerId = nearestOpponent.player.id;
            ballState.lastTouchTeam = nearestOpponent.player.team;
            ballState.lastTouchPlayerId = nearestOpponent.player.id;
            nearestOpponent.player.actionCooldown = tick + 18;
            ballPossessorIdRef.current = nearestOpponent.player.id;
          }
        } else if (tick >= currentOwner.actionCooldown) {
          const shootDecision = (0.12 + centralAngle * 0.25 + ownerProfile.shotBias + pressurePanic * 0.1) * shootingProfile;
          const passDecision = 0.28 + pressurePanic * 0.42 + ownerProfile.shortness * 0.09;
          const dribbleDecision = 0.17 * ownerProfile.dribbleBias * (1 - pressurePanic * 0.45);

          if (shotLane && rng.next() < shootDecision) {
            const goalX = currentOwner.team === 'home' ? 101.5 : -1.5;
            const aimNoise = rng.range(-9, 9) * (1.08 - currentOwner.rating / 120);
            const goalY = clamp(50 + aimNoise, 35, 65);
            currentOwner.actionCooldown = tick + 32;
            activeAttackerIdRef.current = currentOwner.id;
            shootTypeRef.current = 'GOAL';
            flightTargetRef.current = { x: currentOwner.team === 'home' ? 97 : 3, y: goalY };
            ballState.lastShotTick = tick;
            if (currentOwner.team === 'home') setHomeShots(prev => prev + 1);
            else setAwayShots(prev => prev + 1);
            kickBall(currentOwner, goalX, goalY, 78 + currentOwner.rating * 0.22, 5.5 + rng.next() * 3.5);
            setLogs(prev => [...prev, `${Math.max(1, minuteRef.current)}' ${currentOwner.name} kaleyi gördü ve sert vurdu!`]);
          } else if (pressure < 8 || rng.next() < passDecision) {
            const receiver = choosePassTarget(currentOwner);
            if (receiver) {
              const lead = receiver.team === 'home' ? 1.8 : -1.8;
              const rawTargetX = receiver.x + receiver.vx * 0.24 + lead;
              const rawTargetY = receiver.y + receiver.vy * 0.24;
              const passDistance = distance(currentOwner.x, currentOwner.y, rawTargetX, rawTargetY);
              const passingSkill = clamp((currentOwner.rating - 48) / 42, 0.35, 1.2);
              const laneError = (1.22 - passingSkill) * 2.8 + pressurePanic * 3.6 + (passDistance > 30 ? 1.1 : 0);
              const targetX = clamp(rawTargetX + rng.range(-laneError, laneError) * 0.72, 0, 100);
              const targetY = clamp(rawTargetY + rng.range(-laneError, laneError), BALL_MIN_Y, BALL_MAX_Y);
              currentOwner.actionCooldown = tick + Math.floor((14 + rng.range(0, 12)) / clamp(ownerProfile.shortness, 0.8, 1.35));
              intendedReceiverIdRef.current = receiver.id;
              passerIdRef.current = currentOwner.id;
              passTicksRef.current = tick;
              setPassingLines(prev => [
                ...prev,
                { fromX: currentOwner.x, fromY: currentOwner.y, toX: receiver.x, toY: receiver.y, time: Date.now() }
              ].slice(-5));
              const weightBonus = pressurePanic * 4.5 + (ownerProfile.directness - 1) * 4;
              const passPower = clamp(25 + passDistance * (0.9 + ownerProfile.directness * 0.16) + weightBonus, 30, 74);
              const loft = passDistance > 24 && ownerProfile.directness > 0.95
                ? 3.2 + ownerProfile.directness * 0.6 + pressurePanic * 1.2
                : 0.8 + pressurePanic * 0.8;
              kickBall(currentOwner, targetX, targetY, passPower, loft);
            }
          } else if (rng.next() < dribbleDecision) {
            currentOwner.actionCooldown = tick + 8 + Math.floor(rng.range(0, 8));
          } else {
            currentOwner.actionCooldown = tick + 12 + Math.floor(rng.range(0, 12));
          }
        }
      }

      const liveOwner = ballState.ownerId ? players.find(p => p.id === ballState.ownerId) || null : null;
      const liveOwnerTeam = liveOwner?.team || ballState.lastTouchTeam;
      const looseChasers = new Set<string>();
      if (!liveOwner) {
        (['home', 'away'] as TeamSide[]).forEach(team => {
          const profile = getTacticalProfile(team);
          const chaserCount = profile.press > 1.2 ? 3 : profile.press > 0.9 ? 2 : 1;
          const sorted = players
            .filter(p => p.team === team && p.position !== 'GK')
            .map(p => ({ p, d: distance(p.x, p.y, ballState.x, ballState.y) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, chaserCount);
          sorted.forEach(item => looseChasers.add(item.p.id));
        });
        if (intendedReceiverIdRef.current) looseChasers.add(intendedReceiverIdRef.current);
      }

      const pressingChasers = new Set<string>();
      if (liveOwner) {
        const defendingTeam: TeamSide = liveOwner.team === 'home' ? 'away' : 'home';
        const profile = getTacticalProfile(defendingTeam);
        const pressRange = 10 + profile.press * 8;
        const pressCount = profile.press > 1.25 ? 3 : profile.press > 0.9 ? 2 : 1;
        players
          .filter(p => p.team === defendingTeam && p.position !== 'GK')
          .map(p => ({ p, d: distance(p.x, p.y, liveOwner.x, liveOwner.y) }))
          .filter(item => item.d < pressRange)
          .sort((a, b) => a.d - b.d)
          .slice(0, pressCount)
          .forEach(item => pressingChasers.add(item.p.id));
      }

      let nextPlayers = players.map(p => {
        const side = p.team === 'home' ? 1 : -1;
        const profile = getTacticalProfile(p.team);
        let targetX = p.baseX;
        let targetY = p.baseY;
        let sprint = false;

        if (p.position === 'GK') {
          const ownGoalX = p.team === 'home' ? 5.2 : 94.8;
          targetX = ownGoalX;
          const ballThreatensGoal = p.team === 'home' ? ballState.x < 25 : ballState.x > 75;
          targetY = ballThreatensGoal ? clamp(50 + (ballState.y - 50) * 0.46, 38, 62) : 50;
          if (!liveOwner && ballThreatensGoal && distance(p.x, p.y, ballState.x, ballState.y) < 12) {
            targetX = clamp(ballState.x, p.team === 'home' ? 2.8 : 88, p.team === 'home' ? 12 : 97.2);
            targetY = clamp(ballState.y, 34, 66);
            sprint = true;
          }
        } else if (p.id === liveOwner?.id) {
          targetX = clamp(p.x + side * (7.2 + profile.counterBias * 2.4), FIELD_MIN_X, FIELD_MAX_X);
          targetY = clamp(p.y + Math.sin((tick + p.number) * 0.15) * (3.4 + profile.dribbleBias * 1.4), PLAYER_MIN_Y, PLAYER_MAX_Y);
          sprint = true;
        } else if (looseChasers.has(p.id)) {
          targetX = ballState.x;
          targetY = clamp(ballState.y, PLAYER_MIN_Y, PLAYER_MAX_Y);
          sprint = true;
        } else if (pressingChasers.has(p.id)) {
          targetX = ballState.x - side * 1.6;
          targetY = clamp(ballState.y, PLAYER_MIN_Y, PLAYER_MAX_Y);
          sprint = true;
        } else if (liveOwnerTeam === p.team) {
          const rolePush = p.position === 'DEF' ? 6 : p.position === 'MID' ? 12 : 18;
          const wideBaseY = 50 + (p.baseY - 50) * profile.width;
          targetX = clamp(p.baseX + side * (rolePush * profile.support + profile.linePush), FIELD_MIN_X, FIELD_MAX_X);
          targetY = clamp(wideBaseY * 0.58 + ballState.y * 0.42 + Math.sin((tick + p.number) * 0.05) * 2.2, PLAYER_MIN_Y, PLAYER_MAX_Y);
        } else {
          const retreat = p.position === 'DEF' ? 5.5 : p.position === 'MID' ? 7 : 4;
          targetX = clamp(p.baseX + side * (profile.linePush * 0.55 - retreat), FIELD_MIN_X, FIELD_MAX_X);
          targetY = clamp((50 + (p.baseY - 50) * Math.min(profile.width, 1.02)) * 0.72 + ballState.y * 0.28, PLAYER_MIN_Y, PLAYER_MAX_Y);

          if (p.position === 'DEF' || p.position === 'MID') {
            const markPool = players.filter(o =>
              o.team !== p.team &&
              o.position !== 'GK' &&
              (p.position === 'DEF' ? o.position !== 'DEF' : o.position !== 'ATT')
            );
            const mark = findClosest(markPool, p.x, p.y).player;
            if (mark && distance(p.x, p.y, mark.x, mark.y) < 18) {
              targetX = clamp(targetX * 0.62 + (mark.x - side * 2.2) * 0.38, FIELD_MIN_X, FIELD_MAX_X);
              targetY = clamp(targetY * 0.58 + mark.y * 0.42, PLAYER_MIN_Y, PLAYER_MAX_Y);
            }
          }
        }

        const toTarget = normalize(targetX - p.x, targetY - p.y);
        const maxSpeed = (p.position === 'GK' ? 12.5 : 13.5 + p.rating * 0.055) * (sprint ? 1.18 + profile.press * 0.05 : 0.86) * (0.78 + p.stamina / 455);
        const desiredSpeed = Math.min(maxSpeed, toTarget.len * 3.4);
        const accel = (sprint ? 8.5 : 5.6) + p.rating * 0.025;
        const desiredVx = toTarget.x * desiredSpeed;
        const desiredVy = toTarget.y * desiredSpeed;
        const vx = p.vx + (desiredVx - p.vx) * clamp(accel * TICK_SECONDS, 0, 1);
        const vy = p.vy + (desiredVy - p.vy) * clamp(accel * TICK_SECONDS, 0, 1);
        const nextX = clamp(p.x + vx * TICK_SECONDS, FIELD_MIN_X, FIELD_MAX_X);
        const nextY = clamp(p.y + vy * TICK_SECONDS, PLAYER_MIN_Y, PLAYER_MAX_Y);
        const pinnedOutwardY = (nextY <= PLAYER_MIN_Y && vy < 0) || (nextY >= PLAYER_MAX_Y && vy > 0);

        return {
          ...p,
          x: nextX,
          y: nextY,
          vx: nextX === FIELD_MIN_X || nextX === FIELD_MAX_X ? 0 : vx,
          vy: pinnedOutwardY ? 0 : vy,
          heading: Math.abs(vx) + Math.abs(vy) > 0.02 ? Math.atan2(vy, vx) : p.heading,
          stamina: clamp(p.stamina - (sprint ? 0.012 : 0.004), 45, 100)
        };
      });

      let collisionCorrections = 0;
      let maxCollisionOverlap = 0;
      for (let i = 0; i < nextPlayers.length; i++) {
        for (let j = i + 1; j < nextPlayers.length; j++) {
          const a = nextPlayers[i];
          const b = nextPlayers[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= PLAYER_COLLISION_RADIUS) continue;
          collisionCorrections++;
          maxCollisionOverlap = Math.max(maxCollisionOverlap, PLAYER_COLLISION_RADIUS - dist);

          const fallbackAngle = ((a.number * 37 + b.number * 19) % 360) * Math.PI / 180;
          const nx = dist > 0.001 ? dx / dist : Math.cos(fallbackAngle);
          const ny = dist > 0.001 ? dy / dist : Math.sin(fallbackAngle);
          const push = (PLAYER_COLLISION_RADIUS - Math.max(dist, 0.001)) * 0.52;
          const aWeight = a.position === 'GK' ? 0.35 : 1;
          const bWeight = b.position === 'GK' ? 0.35 : 1;
          const totalWeight = aWeight + bWeight;
          const aPush = push * (bWeight / totalWeight);
          const bPush = push * (aWeight / totalWeight);

          a.x = clamp(a.x - nx * aPush, FIELD_MIN_X, FIELD_MAX_X);
          a.y = clamp(a.y - ny * aPush, PLAYER_MIN_Y, PLAYER_MAX_Y);
          b.x = clamp(b.x + nx * bPush, FIELD_MIN_X, FIELD_MAX_X);
          b.y = clamp(b.y + ny * bPush, PLAYER_MIN_Y, PLAYER_MAX_Y);

          a.vx -= nx * aPush * 2.4;
          a.vy -= ny * aPush * 2.4;
          b.vx += nx * bPush * 2.4;
          b.vy += ny * bPush * 2.4;
        }
      }

      const ownerAfterMove = ballState.ownerId ? nextPlayers.find(p => p.id === ballState.ownerId) || null : null;
      if (ownerAfterMove) {
        const side = ownerAfterMove.team === 'home' ? 1 : -1;
        const touchX = ownerAfterMove.x + side * 1.25;
        const touchY = ownerAfterMove.y + Math.sin((tick + ownerAfterMove.number) * 0.38) * 0.35;
        ballState.vx += ((touchX - ballState.x) * 18 - ballState.vx * 6.5) * TICK_SECONDS;
        ballState.vy += ((touchY - ballState.y) * 18 - ballState.vy * 6.5) * TICK_SECONDS;
        ballState.z += (0.1 - ballState.z) * 0.35;
        if (distance(ownerAfterMove.x, ownerAfterMove.y, ballState.x, ballState.y) > 4.2) {
          ballState.ownerId = null;
          ballState.looseUntilTick = tick + 4;
          ballPossessorIdRef.current = null;
        }
      }

      ballState.vz -= 24 * TICK_SECONDS;
      ballState.x += ballState.vx * TICK_SECONDS;
      ballState.y += ballState.vy * TICK_SECONDS;
      ballState.z += ballState.vz * TICK_SECONDS;

      if (ballState.z <= 0) {
        ballState.z = 0;
        ballState.vz = Math.abs(ballState.vz) > 2.2 ? -ballState.vz * 0.38 : 0;
        ballState.vx *= 0.982;
        ballState.vy *= 0.982;
      } else {
        ballState.vx *= 0.994;
        ballState.vy *= 0.994;
      }

      if (ballState.y < BALL_MIN_Y || ballState.y > BALL_MAX_Y) {
        ballState.y = clamp(ballState.y, BALL_MIN_Y, BALL_MAX_Y);
        ballState.vy = -ballState.vy * 0.42;
      }

      const looseSpeed = Math.hypot(ballState.vx, ballState.vy);
      if (!ballState.ownerId && tick > ballState.looseUntilTick) {
        for (const p of nextPlayers) {
          const d = distance(p.x, p.y, ballState.x, ballState.y);
          const isGoalkeeperSave = p.position === 'GK' && ((p.team === 'home' && ballState.x < 13) || (p.team === 'away' && ballState.x > 87));

          if (isGoalkeeperSave && d < 2.8 && looseSpeed > 18) {
            const saveDir = p.team === 'home' ? 1 : -1;
            ballState.vx = saveDir * rng.range(34, 48);
            ballState.vy = rng.range(-20, 20);
            ballState.vz = rng.range(2.2, 6.5);
            ballState.looseUntilTick = tick + 8;
            ballState.lastTouchTeam = p.team;
            ballState.lastTouchPlayerId = p.id;
            p.lastTouchTick = tick;
            setLogs(prev => [...prev, `${Math.max(1, minuteRef.current)}' ${p.name} kalede kritik bir müdahale yaptı.`]);
            break;
          }

          const receivingPass = intendedReceiverIdRef.current === p.id && tick - passTicksRef.current < 70;
          const canInterceptPass = Boolean(
            intendedReceiverIdRef.current &&
            p.team !== ballState.lastTouchTeam &&
            tick - passTicksRef.current > 5 &&
            tick - passTicksRef.current < 58
          );
          const controlRadius = p.position === 'GK'
            ? 1.75
            : receivingPass
              ? 1.95 + p.rating * 0.006
              : canInterceptPass
                ? 1.62 + p.rating * 0.004
                : 1.35 + p.rating * 0.004;
          const maxControlSpeed = p.position === 'GK'
            ? 34
            : receivingPass
              ? 36 + p.rating * 0.14
              : canInterceptPass
                ? 31 + p.rating * 0.09
                : 28;
          if (d < controlRadius && looseSpeed < maxControlSpeed) {
            const firstTouchSkill = clamp((p.rating - 45) / 50, 0.3, 1.15);
            const touchPressure = findClosest(
              nextPlayers.filter(o => o.team !== p.team && o.position !== 'GK'),
              p.x,
              p.y
            ).dist;
            const pressureTouchRisk = clamp((7 - touchPressure) / 7, 0, 1);
            const heavyTouchChance = receivingPass
              ? clamp((looseSpeed - 24) / 35, 0, 0.42) * (1.22 - firstTouchSkill) + pressureTouchRisk * 0.1
              : 0;

            ballState.ownerId = p.id;
            ballState.lastTouchTeam = p.team;
            ballState.lastTouchPlayerId = p.id;
            ballState.vx *= receivingPass ? 0.16 + (1 - firstTouchSkill) * 0.13 : 0.25;
            ballState.vy *= receivingPass ? 0.16 + (1 - firstTouchSkill) * 0.13 : 0.25;
            ballState.vz = 0;
            ballPossessorIdRef.current = p.id;
            p.lastTouchTick = tick;
            p.actionCooldown = Math.max(p.actionCooldown, tick + (receivingPass ? 8 : 5));

            if (rng.next() < heavyTouchChance) {
              const escapeSide = p.team === 'home' ? 1 : -1;
              ballState.ownerId = null;
              ballState.vx += escapeSide * rng.range(6, 14);
              ballState.vy += rng.range(-8, 8);
              ballState.looseUntilTick = tick + 5;
              ballPossessorIdRef.current = null;
            }

            if (intendedReceiverIdRef.current === p.id) {
              intendedReceiverIdRef.current = null;
              passerIdRef.current = null;
            } else if (canInterceptPass) {
              intendedReceiverIdRef.current = null;
              passerIdRef.current = null;
            }
            break;
          }
        }
      }

      if (ballState.x > 100 || ballState.x < 0) {
        const scoringTeam: TeamSide = ballState.x > 100 ? 'home' : 'away';
        const inGoalMouth = ballState.y >= GOAL_MIN_Y && ballState.y <= GOAL_MAX_Y && ballState.z < 7;
        if (inGoalMouth) {
          const scorer = nextPlayers.find(p => p.id === ballState.lastTouchPlayerId) || null;
          registerGoal(scoringTeam, scorer);
        } else {
          ballState.x = clamp(ballState.x, 0, 100);
          ballState.vx = -ballState.vx * 0.34;
          ballState.vy *= 0.68;
          if (tick - ballState.lastShotTick < 80) {
            setLogs(prev => [...prev, `${Math.max(1, minuteRef.current)}' Şut az farkla dışarı gitti.`]);
            ballState.lastShotTick = -999;
          }
        }
      }

      if (ballState.ownerId && ballState.lastTouchTeam === 'home') ballState.homePossTicks++;
      if (ballState.ownerId) ballState.totalPossTicks++;
      if (tick % 12 === 0 && ballState.totalPossTicks > 0) {
        setPossession(clamp((ballState.homePossTicks / ballState.totalPossTicks) * 100, 15, 85));
      }

      if (debugEnabled) {
        const avgPlayerSpeed = nextPlayers.length > 0
          ? nextPlayers.reduce((sum, p) => sum + Math.hypot(p.vx, p.vy), 0) / nextPlayers.length
          : 0;
        const ballSpeed = Math.hypot(ballState.vx, ballState.vy);
        const snapshot = [
          ballState.ownerId || 'loose',
          Math.round(ballState.x),
          Math.round(ballState.y),
          Math.round(ballSpeed),
          Math.round(avgPlayerSpeed),
          collisionCorrections,
          ballState.deadUntilTick > tick ? 'dead' : 'live'
        ].join('|');
        debug.sameSnapshotTicks = snapshot === debug.lastSnapshot ? debug.sameSnapshotTicks + 1 : 0;
        debug.lastSnapshot = snapshot;

        const shouldLog = tick - debug.lastLoggedTick >= 10 || debug.sameSnapshotTicks >= 18 || collisionCorrections > 8 || tickGap > 90;
        if (shouldLog) {
          debug.lastLoggedTick = tick;
          const owner = ballState.ownerId ? nextPlayers.find(p => p.id === ballState.ownerId) : null;
          const nearestToBall = nextPlayers
            .map(p => ({ id: p.id, name: p.name, team: p.team, d: distance(p.x, p.y, ballState.x, ballState.y), speed: Math.hypot(p.vx, p.vy) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 4)
            .map(p => ({ ...p, d: Number(p.d.toFixed(2)), speed: Number(p.speed.toFixed(2)) }));
          console.info('[match-debug] live tick ' + JSON.stringify({
            tick,
            minute: minuteRef.current,
            tickGap: Number(tickGap.toFixed(1)),
            owner: owner ? { name: owner.name, team: owner.team, x: Number(owner.x.toFixed(2)), y: Number(owner.y.toFixed(2)), speed: Number(Math.hypot(owner.vx, owner.vy).toFixed(2)) } : null,
            ball: {
              x: Number(ballState.x.toFixed(2)),
              y: Number(ballState.y.toFixed(2)),
              z: Number(ballState.z.toFixed(2)),
              speed: Number(ballSpeed.toFixed(2)),
              vx: Number(ballState.vx.toFixed(2)),
              vy: Number(ballState.vy.toFixed(2))
            },
            looseUntilTick: ballState.looseUntilTick,
            deadUntilTick: ballState.deadUntilTick,
            sameSnapshotTicks: debug.sameSnapshotTicks,
            collisions: collisionCorrections,
            maxCollisionOverlap: Number(maxCollisionOverlap.toFixed(2)),
            avgPlayerSpeed: Number(avgPlayerSpeed.toFixed(2)),
            nearestToBall
          }));
        }
      }

      pitchPlayersRef.current = nextPlayers;
      setPitchPlayers(nextPlayers);
      const visualBall = { x: clamp(ballState.x, 0, 100), y: clamp(ballState.y, 0, 100) };
      setBall(visualBall);
      setBallTarget(visualBall);

      // Referee positions near ball action
      setReferee(prev => {
        const targetX = ballState.x * 0.68 + 35 * 0.32;
        const targetY = ballState.y * 0.72 + 50 * 0.28;
        return {
          x: prev.x * 0.94 + targetX * 0.06,
          y: prev.y * 0.94 + targetY * 0.06
        };
      });

    }, 50);

    return () => clearInterval(interval);
  }, [isSimulating, matchDone, homeSquad, awaySquad, homeFormation, awayFormation, homeMentality, awayMentality, homeStyle, awayStyle, currentMentality, isUserHome, homeClub, awayClub]);

  // Clean background pass mapping triggers (bypassed since handled in core loop)
  useEffect(() => {
    if (!isSimulating || matchDone) return;
    lastPassTimeRef.current = Date.now();
  }, [isSimulating, matchDone]);

  // Setup interval clock
  useEffect(() => {
    if (!isSimulating || matchDone) return;

    // Tick duration decreases on higher speed
    const subTickDuration = 200 / speed;

    const timer = setInterval(() => {
      if (fxStateRef.current !== null) {
        return; // Pause match timer ticking during card/goal animations!
      }

      setSecond(prevSec => {
        const added = 3; // Adds 3 simulated seconds per sub-tick
        const nextSec = prevSec + added;
        if (nextSec >= 60) {
          setMinute(prevMin => {
            const nextMin = prevMin + 1;
            triggerDuePlannedGoals(nextMin);
            
            // Match Finished Trigger
            if (nextMin > 90) {
              clearInterval(timer);
              setMatchDone(true);
              setShowMatchEndOverlay(true);
              setIsSimulating(false);
              setLogs(prev => [...prev, "ERSAN EFENDİ son düdüğü çalıyor! Maç sona erdi.", `Maç Sonucu: ${homeClub.name} ${homeScore} - ${awayScore} ${awayClub.name}`]);
              soundEngine.playMatchEnd();
              soundEngine.stopCrowd();
              
              // Triple referee whistle sound trigger!
              soundEngine.playWhistle(true);
              setTimeout(() => {
                soundEngine.playWhistle(false);
              }, 450);
              return 90;
            }

            // Half-time block
            if (nextMin === 45) {
              setLogs(prev => [...prev, "ERSAN EFENDİ ilk yarıyı bitiren düdüğü çalıyor. Devre arası.", `İlk Yarı Sonucu: ${homeClub.name} ${homeScore} - ${awayScore} ${awayClub.name}`]);
              setIsSimulating(false); // Pause at 45m for half-time break
              soundEngine.playMatchEnd();
              soundEngine.stopCrowd();
              soundEngine.playWhistle(true);
            }
            if (nextMin === 46) {
              setLogs(prev => [...prev, "ERSAN EFENDİ'nin işaretiyle ikinci yarı başladı! Bakalım antrenörlerin taktik hamleleri ne olacak."]);
              soundEngine.playMatchStart();
              if (matchViewMode === '3D') {
                soundEngine.playCrowd();
              }
              soundEngine.playWhistle(false);
            }

            // Live physics now drives goals and shots; the clock only adds occasional broadcast texture.
            if (nextMin % 12 === 0 && nextMin !== 45) {
              const randomNormal = rngRef.current.choice(COMMENTARY_TEMPLATES.COMMENT_NORMAL);
              setLogs(prev => [...prev, `${nextMin}' ${randomNormal}`]);
              soundEngine.playCommentaryTick();
            }

            return nextMin;
          });
          return nextSec % 60;
        }
        return nextSec;
      });
    }, subTickDuration);

    return () => clearInterval(timer);
  }, [isSimulating, minute, homeScore, awayScore, speed, matchDone, possession, homeShots, awayShots, matchViewMode]);

  // Main algorithm inside tactical simulation
  const simulateMatchAction = (currMin: number) => {
    const rng = rngRef.current;
    
    const powerHome = typeof homeOvr === 'number' && !isNaN(homeOvr) ? homeOvr : 60;
    const powerAway = typeof awayOvr === 'number' && !isNaN(awayOvr) ? awayOvr : 60;

    // Mentality modifies strength
    const userMentalityFactor = currentMentality === 'OVERLOAD' ? 1.05 : currentMentality === 'ATTACKING' ? 1.02 : currentMentality === 'DEFENSIVE' ? 0.95 : 1.0;
    
    const adjustedHomeOvr = isUserHome ? powerHome * userMentalityFactor : powerHome;
    const adjustedAwayOvr = !isUserHome ? powerAway * userMentalityFactor : powerAway;

    // Home advantage adds +3 virtual points
    const homePower = adjustedHomeOvr + 3;
    const awayPower = adjustedAwayOvr;

    // Calculate interactive possession shifts
    const rawTargetPoss = 50 + (homePower - awayPower) * 1.5 + (rng.next() * 8 - 4);
    const targetPossession = Math.max(30, Math.min(70, isNaN(rawTargetPoss) ? 50 : rawTargetPoss));
    setPossession(prev => {
      const pPrev = typeof prev === 'number' && !isNaN(prev) ? prev : 50;
      return pPrev * 0.8 + targetPossession * 0.2;
    });

    // Probability of an event occurring in this tick (approx 15% rate)
    const eventProbability = rng.next();
    if (eventProbability < 0.16) {
      // Determine which team attacks based on relative ratings and possession
      const safePoss = typeof possession === 'number' && !isNaN(possession) ? possession : 50;
      const isHomeAttack = rng.next() < (safePoss / 100);
      const attackingClub = isHomeAttack ? homeClub : awayClub;
      const defendingClub = isHomeAttack ? awayClub : homeClub;
      const attackPower = isHomeAttack ? homePower : awayPower;
      const defensePower = isHomeAttack ? awayPower : homePower;

      // Select active squad players for event mapping defensively
      let activeAttRoster = isHomeAttack ? homeSquad.filter(p => p.isStarting) : awaySquad.filter(p => p.isStarting);
      let activeDefRoster = isHomeAttack ? awaySquad.filter(p => p.isStarting) : homeSquad.filter(p => p.isStarting);

      if (activeAttRoster.length === 0) {
        const baseSquad = isHomeAttack ? homeSquad : awaySquad;
        activeAttRoster = baseSquad && baseSquad.length > 0 ? baseSquad.slice(0, 11) : [];
      }
      if (activeDefRoster.length === 0) {
        const baseSquad = isHomeAttack ? awaySquad : homeSquad;
        activeDefRoster = baseSquad && baseSquad.length > 0 ? baseSquad.slice(0, 11) : [];
      }

      // Safe fallback player if squad has absolutely zero players
      const fallbackPlayer: Player = {
        id: 'fallback_p',
        name: 'Bilinmeyen Oyuncu',
        age: 25,
        position: 'ATT',
        rating: 60,
        pace: 60,
        shooting: 60,
        passing: 60,
        defending: 60,
        physical: 60,
        goalkeeping: 10,
        value: 100000,
        wage: 1000,
        form: 6,
        fitness: 100,
        morale: 80,
        injuryWeeks: 0,
        goals: 0,
        assists: 0,
        appearances: 0,
        yellowCards: 0,
        redCards: 0,
        ratingHistory: [],
        avgRating: 6.0,
        isStarting: true,
        pitchPosition: 11,
        isCaptain: false,
        isPenaltyTaker: false
      };

      const attackersPool = activeAttRoster.filter(p => p.position === 'ATT' || p.position === 'MID');
      const attacker = attackersPool.length > 0 ? rng.choice(attackersPool) : (activeAttRoster.find(p => p.position !== 'GK') || fallbackPlayer);
      
      const assistantsPool = activeAttRoster.filter(p => p.id !== attacker.id && p.position !== 'GK');
      const assistant = assistantsPool.length > 0 ? rng.choice(assistantsPool) : (activeAttRoster.find(p => p.id !== attacker.id && p.position !== 'GK') || undefined);
      
      const defendersPool = activeDefRoster.filter(p => p.position === 'DEF');
      const defender = defendersPool.length > 0 ? rng.choice(defendersPool) : (activeDefRoster[0] || fallbackPlayer);

      // Add shots count
      if (isHomeAttack) setHomeShots(prev => prev + 1);
      else setAwayShots(prev => prev + 1);

      // Attack outcome threshold (goals vs saves vs misses)
      const successChance = rng.next() * 100;
      const goalThreshold = 25 + (attacker?.shooting || 70) * 0.08 - (defensePower * 0.12);

      // Initialize run position of attacker representing possession
      const attackPos = pitchPlayersRef.current.find(p => p.id === attacker?.id);
      if (attackPos) {
        setBall({ x: attackPos.x, y: attackPos.y });
        setBallTarget({ x: attackPos.x, y: attackPos.y });
      } else {
        // Fallback positioning for attacker
        const initX = isHomeAttack ? 60 : 40;
        setBall({ x: initX, y: 50 });
        setBallTarget({ x: initX, y: 50 });
      }

      playPhaseRef.current = isHomeAttack ? 'HOME_ATTACK' : 'AWAY_ATTACK';
      activeAttackerIdRef.current = attacker.id;
      ballPossessorIdRef.current = attacker.id;
      phaseTicksRef.current = 0; // Reset ticks immediately so the running phase gets full 30 ticks!

      // Setup precomputed spatial targets using SEEDED random range!
      const goalX = isHomeAttack ? 97 : 3;
      const goalY = 47 + rng.next() * 6; // Goal height target: 47 to 53 along the depth/spread axis
      const outX = isHomeAttack ? 97 : 3;
      const outY = rng.next() < 0.5 ? 22 : 78;
      const gkX = isHomeAttack ? 93 : 7;
      const gkY = 50;

      // Determine outcome and target coordinates
      if (successChance < goalThreshold) {
        shootTypeRef.current = 'GOAL';
        flightTargetRef.current = { x: goalX, y: goalY };

        pendingGoalRef.current = {
          home: isHomeAttack,
          scorerName: attacker.name,
          clubName: attackingClub.name,
          clubShort: attackingClub.shortName,
          clubId: attackingClub.id,
          assistantName: assistant ? assistant.name : undefined,
          minute: currMin
        };
        pendingShotRef.current = null;

        // Show run in alert
        setFxState({
          type: 'NONE',
          text: `Tehlikeli Atak! ${attacker.name} ceza sahasına sokuluyor...`,
          team: isHomeAttack ? 'home' : 'away',
          x: attackPos ? attackPos.x : (isHomeAttack ? 70 : 30),
          y: attackPos ? attackPos.y : 50
        });

      } else {
        const isSaved = rng.next() < 0.6;
        shootTypeRef.current = isSaved ? 'SAVE' : 'MISS';
        flightTargetRef.current = { x: isSaved ? gkX : outX, y: isSaved ? gkY : outY };

        pendingShotRef.current = {
          isSaved,
          attackerName: attacker.name,
          clubShort: attackingClub.shortName,
          minute: currMin
        };
        pendingGoalRef.current = null;

        // Show run in alert
        setFxState({
          type: 'NONE',
          text: `Hızlı Hücum! ${attacker.name} topu önüne aldı rakip kaleye yöneliyor...`,
          team: isHomeAttack ? 'home' : 'away',
          x: attackPos ? attackPos.x : (isHomeAttack ? 70 : 30),
          y: attackPos ? attackPos.y : 50
        });
      }
    } else if (eventProbability < 0.24) { // 0.16 + 0.08
      // General match incident (Yellow/Red cards or Injuries)
      const isHomeCrime = rng.next() < 0.5;
      const criminalRoster = isHomeCrime ? homeSquad.filter(p => p.isStarting) : awaySquad.filter(p => p.isStarting);
      const culprit = rng.choice(criminalRoster);
      if (!culprit) return;

      const crimeChance = rng.next();
      if (crimeChance < 0.6) {
        // Yellow Card
        matchEventsRef.current.push({
          minute: currMin,
          type: 'YELLOW',
          teamId: isHomeCrime ? homeClub.id : awayClub.id,
          playerName: culprit.name
        });
        setLogs(prev => [...prev, `${currMin}' [Sarı Kart] - Hakem faul sebebiyle oyunu durduruyor ve ${culprit.name} (${isHomeCrime ? homeClub.shortName : awayClub.shortName}) sarı kart görüyor.`]);

        const culpritVisual = pitchPlayersRef.current.find(p => p.id === culprit.id);
        if (culpritVisual) {
          setReferee({ x: culpritVisual.x, y: culpritVisual.y });
          setBallTarget({ x: culpritVisual.x, y: culpritVisual.y });
          setFxState({
            type: 'CARD',
            text: `Sarı Kart: ${culprit.name}`,
            team: isHomeCrime ? 'home' : 'away',
            x: culpritVisual.x,
            y: culpritVisual.y
          });
          setTimeout(() => setFxState(null), 2400);
        }
      } else if (crimeChance < 0.75) {
        // Red Card !!! (Kırmızı Kart)
        matchEventsRef.current.push({
          minute: currMin,
          type: 'RED',
          teamId: isHomeCrime ? homeClub.id : awayClub.id,
          playerName: culprit.name
        });
        setLogs(prev => [...prev, `${currMin}' [KIRMIZI KART!] - Çok sert bir müdahale! Hakem doğrudan kırmızı kart çıkarıyor ve ${culprit.name} (${isHomeCrime ? homeClub.shortName : awayClub.shortName}) oyundan ihraç ediliyor!`]);

        const culpritVisual = pitchPlayersRef.current.find(p => p.id === culprit.id);
        if (culpritVisual) {
          setReferee({ x: culpritVisual.x, y: culpritVisual.y });
          setBallTarget({ x: culpritVisual.x, y: culpritVisual.y });
          setFxState({
            type: 'RED_CARD',
            text: `Kırmızı Kart: ${culprit.name}`,
            team: isHomeCrime ? 'home' : 'away',
            x: culpritVisual.x,
            y: culpritVisual.y
          });
          setTimeout(() => setFxState(null), 2400);
        }
      } else {
        // Injury alert!
        matchEventsRef.current.push({
          minute: currMin,
          type: 'INJURY',
          teamId: isHomeCrime ? homeClub.id : awayClub.id,
          playerName: culprit.name
        });
        setLogs(prev => [...prev, `${currMin}' [SAKATLIK!] - ${culprit.name} acı içinde yerde kaldı. Sağlık ekibi oyun alanına giriyor.`]);

        const culpritVisual = pitchPlayersRef.current.find(p => p.id === culprit.id);
        if (culpritVisual) {
          setReferee({ x: culpritVisual.x, y: culpritVisual.y });
          setBallTarget({ x: culpritVisual.x, y: culpritVisual.y });
          setFxState({
            type: 'INJURY',
            text: `${culprit.name} Sakatlandı!`,
            team: isHomeCrime ? 'home' : 'away',
            x: culpritVisual.x,
            y: culpritVisual.y
          });
          setTimeout(() => setFxState(null), 2400);
        }
      }
    } else if (eventProbability < 0.44) { // 0.24 + 0.20
      // Normal flow commentary
      const randomNormal = rng.choice(COMMENTARY_TEMPLATES.COMMENT_NORMAL);
      setLogs(prev => [...prev, `${currMin}' ${randomNormal}`]);
    }
  };

  // Perform Substitution
  const handleSubstitution = (starterId: string, benchId: string) => {
    if (subCount >= 5) {
      onNotify?.('Oyuncu Değişikliği Limiti', 'En fazla 5 oyuncu değişikliği yapabilirsiniz.', 'warning');
      return;
    }

    // Process substitution in userSquad array references
    const starterPlayer = userSquad.find(p => p.id === starterId);
    const benchPlayer = userSquad.find(p => p.id === benchId);

    if (starterPlayer && benchPlayer) {
      starterPlayer.isStarting = false;
      benchPlayer.isStarting = true;
      benchPlayer.pitchPosition = starterPlayer.pitchPosition;
      starterPlayer.pitchPosition = 0;

      setSubCount(prev => prev + 1);
      setLogs(prev => [...prev, `${minute}' [Oyuncu Değişikliği] - ${starterPlayer.name} oyundan çıkıyor, yerine ${benchPlayer.name} dahil oluyor.`]);
      soundEngine.playCommentaryTick();
      
      matchEventsRef.current.push({
        minute,
        type: 'SUB',
        teamId: isUserHome ? homeClub.id : awayClub.id,
        playerName: benchPlayer.name,
        detail: `${starterPlayer.name} yerine girdi.`
      });

      setSubsModalOpen(false);
    }
  };

  if (preMatchSetup) {
    return (
      <div className="bg-zinc-950 p-4 sm:p-6 rounded-3xl border border-zinc-800 shadow-2xl space-y-6" id="pre-match-setup">
        {/* Header fixture overview */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 rounded-3xl border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-1/2 translate-x-1/2 w-20 h-20 bg-[#FF007A]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Home Club */}
          <div className="flex items-center gap-4 text-center sm:text-left flex-1 justify-end">
            <div className="space-y-1">
              <h3 className="text-sm sm:text-lg font-bold text-zinc-100">{homeClub.name}</h3>
              <p className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider">EV SAHİBİ • OVR: {homeOvr}</p>
            </div>
            <img 
              src={homeClub.badge} 
              alt={homeClub.name} 
              className="w-12 h-12 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* VS badge */}
          <div className="flex flex-col items-center shrink-0 border-x border-zinc-800/80 px-8">
            <span className="text-[#FF007A] font-sans text-xl font-black tracking-widest">VS</span>
            <span className="text-[9px] bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full uppercase mt-2 font-mono font-bold tracking-wider">TAKTIK HAZIRLIK</span>
          </div>

          {/* Away Club */}
          <div className="flex items-center gap-4 text-center sm:text-right flex-1 justify-start flex-row-reverse sm:flex-row">
            <img 
              src={awayClub.badge} 
              alt={awayClub.name} 
              className="w-12 h-12 object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1">
              <h3 className="text-sm sm:text-lg font-bold text-zinc-100">{awayClub.name}</h3>
              <p className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider">DEPLASMAN • OVR: {awayOvr}</p>
            </div>
          </div>
        </div>

        {/* Tactical Config Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: Team Tactics */}
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
              <div className="w-2.5 h-6 bg-[#FF007A] rounded-full" />
              <h4 className="text-sm font-black text-zinc-100 tracking-wider">EV SAHİBİ STRATEJİ BOARD</h4>
            </div>

            {/* Formation selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Şablon Diziliş (Formation)</label>
              <select 
                value={homeFormation}
                onChange={(e) => setHomeFormation(e.target.value as Tactics['formation'])}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-[#FF007A] focus:outline-none"
              >
                <option value="4-3-3">4-3-3 (Ofansif Kanat Hücumu)</option>
                <option value="4-4-2">4-4-2 (Klasik Dengeli İngiliz)</option>
                <option value="3-5-2">3-5-2 (Kalabalık Orta Alan Kontrolü)</option>
                <option value="4-2-3-1">4-2-3-1 (Modern Pas & Baskı)</option>
                <option value="5-3-2">5-3-2 (Katı Savunma & Kontra)</option>
              </select>
            </div>

            {/* Mentality selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Oyun Mantalitesi (Mentality)</label>
              <select 
                value={homeMentality}
                onChange={(e) => setHomeMentality(e.target.value as Tactics['mentality'])}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-[#FF007A] focus:outline-none"
              >
                <option value="DEFENSIVE">Savunma (Otobüsü Çek)</option>
                <option value="CAUTIOUS">Katı / Temkinli Dengeli</option>
                <option value="BALANCED">Dengeli Reaksiyon</option>
                <option value="ATTACKING">Hücum Ağırlıklı Baskı</option>
                <option value="OVERLOAD">Tam Saha Pres / Baskılı</option>
              </select>
            </div>

            {/* Game style selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Oyun Tarzı (Tactical Style)</label>
              <select 
                value={homeStyle}
                onChange={(e) => setHomeStyle(e.target.value as Tactics['style'])}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-[#FF007A] focus:outline-none"
              >
                <option value="TIKI_TAKA">Tiki-Taka (Yaratıcı Kısa Pas Akışı)</option>
                <option value="GEGENPRESS">Gegenpress (Şok Pres & Hızlı Reaksiyon)</option>
                <option value="WING_PLAY">Kanat Hücumu (Ortalarla Ceza Alanı Besleme)</option>
                <option value="PARK_BUS">Katı Blok Savunması (Kontrollü Derin Blok)</option>
                <option value="COUNTER_ATTACK">Kontra Atak (Hızlı Geçiş Hücumu)</option>
              </select>
            </div>
          </div>

          {/* Center Column: Live preview of formation on pitch */}
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h4 className="text-xs font-black text-zinc-300 tracking-wider">TAKTIKSEL SAHA BOYUTU</h4>
              <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-widest uppercase">2D Canlı Önizleme</span>
            </div>

            {/* 2D Mini Pitch Container */}
            <div className="relative aspect-[3/4] w-full bg-emerald-950 rounded-2xl border border-zinc-800 overflow-hidden flex items-center justify-center">
              {/* Pitch lines markings */}
              <div className="absolute inset-x-4 inset-y-4 border-[2px] border-emerald-900/30 pointer-events-none rounded-lg" />
              <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-emerald-900/30 pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-[2px] border-emerald-900/30 pointer-events-none" />
              
              {/* Home Goal Area */}
              <div className="absolute left-4 right-4 top-4 h-12 border-b-[2px] border-emerald-900/20 pointer-events-none" />
              {/* Away Goal Area */}
              <div className="absolute left-4 right-4 bottom-4 h-12 border-t-[2px] border-emerald-900/20 pointer-events-none" />

              {/* Home player circles (red dots, bottom-ish) */}
              {pitchPlayers.filter(p => p.team === 'home').map(p => (
                <div 
                  key={p.id}
                  className="absolute w-5 h-5 rounded-full bg-rose-600 border border-white flex items-center justify-center text-[8px] font-mono font-black text-white shadow-md transition-all duration-300 ease-out"
                  style={{
                    left: `${Math.max(8, Math.min(92, p.y))}%`,
                    top: `${Math.max(8, Math.min(92, p.x))}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  title={`${p.name} (${p.position})`}
                >
                  {p.number}
                </div>
              ))}

              {/* Away player circles (blue dots, top-ish) */}
              {pitchPlayers.filter(p => p.team === 'away').map(p => (
                <div 
                  key={p.id}
                  className="absolute w-5 h-5 rounded-full bg-sky-600 border border-white flex items-center justify-center text-[8px] font-mono font-black text-white shadow-md transition-all duration-300 ease-out"
                  style={{
                    left: `${Math.max(8, Math.min(92, p.y))}%`,
                    top: `${Math.max(8, Math.min(92, p.x))}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  title={`${p.name} (${p.position})`}
                >
                  {p.number}
                </div>
              ))}
            </div>

            <p className="text-[10px] text-zinc-500 font-sans mt-3 text-center leading-relaxed">
              Diziliş değişikliklerinde oyuncular sahaya dinamik olarak yerleşirler.
            </p>
          </div>

          {/* Right panel: Opponent Tactics */}
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
              <div className="w-2.5 h-6 bg-sky-500 rounded-full" />
              <h4 className="text-sm font-black text-zinc-100 tracking-wider">RAKİP DETAYLI STRATEJİSİ</h4>
            </div>

            {/* Away Formation selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Rakip Şablon Diziliş</label>
              <select 
                value={awayFormation}
                onChange={(e) => setAwayFormation(e.target.value as Tactics['formation'])}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
              >
                <option value="4-3-3">4-3-3 (Ofansif Kanat Hücumu)</option>
                <option value="4-4-2">4-4-2 (Klasik Dengeli İngiliz)</option>
                <option value="3-5-2">3-5-2 (Kalabalık Orta Alan Kontrolü)</option>
                <option value="4-2-3-1">4-2-3-1 (Modern Pas & Baskı)</option>
                <option value="5-3-2">5-3-2 (Katı Savunma & Kontra)</option>
              </select>
            </div>

            {/* Away Mentality selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Rakip Oyun Mantalitesi</label>
              <select 
                value={awayMentality}
                onChange={(e) => setAwayMentality(e.target.value as Tactics['mentality'])}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
              >
                <option value="DEFENSIVE">Savunma (Otobüsü Çek)</option>
                <option value="CAUTIOUS">Katı / Temkinli Dengeli</option>
                <option value="BALANCED">Dengeli Reaksiyon</option>
                <option value="ATTACKING">Hücum Ağırlıklı Baskı</option>
                <option value="OVERLOAD">Tam Saha Pres / Baskılı</option>
              </select>
            </div>

            {/* Away style selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Rakip Oyun Tarzı</label>
              <select 
                value={awayStyle}
                onChange={(e) => setAwayStyle(e.target.value as Tactics['style'])}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
              >
                <option value="TIKI_TAKA">Tiki-Taka (Yaratıcı Kısa Pas Akışı)</option>
                <option value="GEGENPRESS">Gegenpress (Şok Pres & Hızlı Reaksiyon)</option>
                <option value="WING_PLAY">Kanat Hücumu (Ortalarla Ceza Alanı)</option>
                <option value="PARK_BUS">Katı Blok Savunması (Derin Blok)</option>
                <option value="COUNTER_ATTACK">Kontra Atak (Hızlı Geçiş Hücumu)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Kick off button */}
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => {
              setPreMatchSetup(false);
              setCurrentMentality(isUserHome ? homeMentality : awayMentality);
              resetLivePhysics();
              const alignedPlayers = getInitialPositions(homeSquad, awaySquad, homeFormation, awayFormation);
              setPitchPlayers(alignedPlayers);
              prepareMatchPlan(matchSeed);
              setLogs([
                "Müsabaka öncesi son taktik planlar yapıldı ve oyuncular sahaya dağıldı.",
                `Hakem düdüğü ağzına götürdü... Ve dev mücadele başlıyor!`
              ]);
              setIsSimulating(true);
              soundEngine.playMatchStart();
              soundEngine.playWhistle(true);
              if (matchViewMode === '3D') {
                soundEngine.playCrowd();
              }
            }}
            className="px-10 py-4 bg-[#FF007A] text-white hover:bg-[#ff1a8c] font-black rounded-2xl flex items-center gap-3 shadow-lg shadow-rose-500/10 cursor-pointer text-sm sm:text-base tracking-widest scale-100 hover:scale-[1.03] transition-all"
          >
            <Play className="w-5 h-5 fill-current" /> SANTRA YAP, MAÇI BAŞLAT!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-zinc-800 shadow-2xl space-y-2.5 sm:space-y-5" id="match-day-engine">
      {/* Match Banner scoreboard */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 px-2.5 py-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-zinc-800 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-5 relative overflow-hidden">

        {/* Home Club */}
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <div className="min-w-0 text-right leading-none">
            <h3 className="text-[11px] sm:text-lg font-black text-zinc-100 truncate">{homeClub.shortName || homeClub.name}</h3>
            <p className="text-[8px] sm:text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider mt-1">OVR {homeOvr}</p>
          </div>
          <img 
            src={homeClub.badge} 
            alt={homeClub.name} 
            className="w-7 h-7 sm:w-12 sm:h-12 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Live Score Counter */}
        <div className="flex flex-col items-center shrink-0 border-x border-zinc-800/80 px-3 sm:px-8">
          <span className="text-[#FF007A] font-mono text-[11px] sm:text-2xl font-black tracking-widest animate-pulse leading-none">
            {String(minute).padStart(2, '0')}:{String(second).padStart(2, '0')}
          </span>
          
          <div className="flex items-center gap-2 sm:gap-4 mt-1 sm:mt-2 leading-none">
            <span className="text-2xl sm:text-4xl font-mono font-black text-zinc-100">{homeScore}</span>
            <span className="text-zinc-500 font-mono font-bold text-xs sm:text-lg">-</span>
            <span className="text-2xl sm:text-4xl font-mono font-black text-zinc-100">{awayScore}</span>
          </div>

          <div className="mt-1.5 sm:mt-3">
            {matchDone ? (
              <span className="text-[7px] sm:text-[9px] bg-zinc-800 border border-zinc-700 text-zinc-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase font-mono font-bold">BİTTİ</span>
            ) : isSimulating ? (
              <span className="text-[7px] sm:text-[9px] bg-red-500/10 border border-red-500/20 text-rose-400 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase font-mono font-bold flex items-center gap-1">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full animate-ping" /> CANLI
              </span>
            ) : (
              <span className="text-[7px] sm:text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase font-mono font-bold">DURDU</span>
            )}
          </div>
        </div>

        {/* Away Club */}
        <div className="flex items-center gap-2 min-w-0 justify-start">
          <img 
            src={awayClub.badge} 
            alt={awayClub.name} 
            className="w-7 h-7 sm:w-12 sm:h-12 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 text-left leading-none">
            <h3 className="text-[11px] sm:text-lg font-black text-zinc-100 truncate">{awayClub.shortName || awayClub.name}</h3>
            <p className="text-[8px] sm:text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider mt-1">OVR {awayOvr}</p>
          </div>
        </div>
      </div>

      {/* High-Definition Stadyum Görünüm Sekmeleri & Tohum Kontrolü */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:justify-between">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 p-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl shadow-md">
            <button
              type="button"
              onClick={() => setMatchViewMode('3D')}
              className={`py-1.5 px-3 sm:px-4 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
                matchViewMode === '3D'
                  ? 'bg-[#FF007A] text-white shadow-md font-black scale-[1.02]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
              }`}
            >
              <Tv className="w-3.5 h-3.5" /> 3D Canlı Yayın
            </button>
            <button
              type="button"
              onClick={() => setMatchViewMode('2D')}
              className={`py-1.5 px-3 sm:px-4 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
                matchViewMode === '2D'
                  ? 'bg-zinc-800 text-zinc-100 shadow-md font-black scale-[1.02]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" /> Taktik Tablo
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextMute = soundEngine.toggleMute();
              setSoundMuted(nextMute);
            }}
            className={`p-2 rounded-2xl border transition-all flex items-center justify-center cursor-pointer ${
              soundMuted 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:text-white'
            }`}
            title={soundMuted ? "Sesi Aç" : "Sesi Kapat"}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Maç Tohumu Seed Girişi */}
        <div className="flex items-center gap-1.5 bg-zinc-900/45 border border-zinc-800/80 px-2 py-1 rounded-2xl text-xs shadow-sm shadow-black shrink-0 ml-auto">
          <span className="text-[9px] text-zinc-400 font-mono font-bold uppercase tracking-wider">Seed</span>
          <input
            type="number"
            value={matchSeed}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setMatchSeed(val);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] font-mono font-black text-zinc-200 focus:outline-none focus:border-[#FF007A] w-24 sm:w-32 text-center"
            placeholder="Tohum No"
          />
          <button
            type="button"
            onClick={() => {
              const rVal = Math.floor(Date.now() / 1000);
              setMatchSeed(rVal);
            }}
            className="p-1 text-[#FF007A] hover:bg-zinc-800 rounded-lg transition-all"
            title="Rastgele Tohum Üret"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl sm:rounded-[32px] overflow-hidden bg-zinc-950 border border-zinc-800/80 shadow-2xl">
        {matchViewMode === '3D' ? (
          <ThreeDPitch
            pitchPlayers={pitchPlayers}
            ball={ball}
            referee={referee}
            passingLines={passingLines}
            homeClub={homeClub}
            awayClub={awayClub}
            possession={possession}
            fxState={fxState}
            ballPossessorId={ballPossessorIdRef.current}
          />
        ) : (
        /* 2D AstroTurf Animated Match Pitch */
        <div className="bg-[#15803d] border border-zinc-200 rounded-[32px] p-4 relative shadow-sm overflow-hidden select-none">
          {/* Lawn stripe colors */}
          <div className="absolute inset-0 flex pointer-events-none">
            {Array.from({ length: 14 }).map((_, idx) => (
              <div 
                key={idx} 
                className="h-full flex-1" 
                style={{ 
                  backgroundColor: idx % 2 === 0 ? '#15803d' : '#166534' 
                }} 
              />
            ))}
          </div>

          {/* Chalk field lines */}
          <div className="absolute inset-4 border border-white/20 rounded-2xl pointer-events-none">
            {/* Halfline */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/20 -translate-x-1/2" />
            {/* Center Circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[16%] aspect-square rounded-full border border-white/20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/30" />

            {/* Left Goal/Penalty Box */}
            <div className="absolute top-[20%] bottom-[20%] left-0 w-[12%] border-y border-r border-white/20 bg-white/2" />
            <div className="absolute top-[35%] bottom-[35%] left-0 w-[5%] border-y border-r border-white/20" />
            {/* Right Goal/Penalty Box */}
            <div className="absolute top-[20%] bottom-[20%] right-0 w-[12%] border-y border-l border-white/20 bg-white/2" />
            <div className="absolute top-[35%] bottom-[35%] right-0 w-[5%] border-y border-l border-white/20" />
          </div>

          {/* Outer Goal Post Netting Frames */}
          <div className="absolute top-[44%] bottom-[44%] left-[10px] w-2.5 bg-yellow-400 border border-white/30 rounded-r z-10" />
          <div className="absolute top-[44%] bottom-[44%] right-[10px] w-2.5 bg-yellow-400 border border-white/30 rounded-l z-10" />

          {/* Interactive SVG for real-time Neon passing trace tracks */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {passingLines.map((line, idx) => {
              const age = Date.now() - line.time;
              const opacity = Math.max(0, 1 - age / 1800);
              if (opacity <= 0) return null;
              return (
                <line
                  key={idx}
                  x1={`${line.fromX}%`}
                  y1={`${line.fromY}%`}
                  x2={`${line.toX}%`}
                  y2={`${line.toY}%`}
                  stroke="#FF007A"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  strokeOpacity={opacity}
                  className="transition-opacity duration-200"
                />
              );
            })}
          </svg>

          {/* Field Content Wrapper */}
          <div className="relative w-full h-72 sm:h-96 md:h-[420px]">
            {/* Active visual players rendered on field coordinates */}
            {pitchPlayers.map((player) => {
              if (!player || !player.id || !player.name) return null;
              const isHome = player.team === 'home';
              const jerseyColor = isHome ? 'bg-[#DA020E] border-white text-white shadow-red-500/30' : 'bg-[#034694] border-white text-white shadow-blue-500/30';
              
              return (
                <div
                  key={player.id}
                  style={{ left: `${player.x}%`, top: `${player.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none z-20 transition-all duration-300 ease-out"
                >
                  {/* Glowing Circle Badge */}
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-mono font-black text-[9px] sm:text-[11px] shadow-md ${jerseyColor}`}>
                    {player.rating}
                  </div>
                  {/* Visual label tag underneath */}
                  <div className="mt-0.5 bg-black/85 backdrop-blur-sm px-1.5 py-px border border-white/10 rounded text-[8px] text-zinc-100 font-medium max-w-[75px] truncate leading-tight shadow-sm">
                    {player.name.split(' ')[1] || player.name}
                  </div>
                </div>
              );
            })}

            {/* Animated Referee Circle on pitch */}
            <div
              style={{ left: `${referee.x}%`, top: `${referee.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none z-20 transition-all duration-300 ease-out"
            >
              <div className="w-5.5 h-5.5 rounded-full bg-yellow-400 border-2 border-black shadow-md shadow-yellow-500/30 flex items-center justify-center font-black text-[9px] text-black">
                EE
              </div>
              <div className="bg-black/80 px-1 py-px rounded text-[7px] text-yellow-300 font-bold border border-yellow-500/20 leading-none mt-0.5 whitespace-nowrap">
                ERSAN EFENDİ
              </div>
            </div>

            {/* Animated Soccer Ball on pitch */}
            <div
              style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-100 ease-out"
            >
              {/* White/Black dynamic soccer icon */}
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white border border-zinc-900 rounded-full flex items-center justify-center shadow-lg animate-spin" style={{ animationDuration: '3s' }}>
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
              </div>
            </div>

            {/* Celebrations / Status Floater Banners */}
            <BroadcastBanner
              fxState={fxState as any}
              homeClub={homeClub}
              awayClub={awayClub}
            />

          </div>
        </div>
      )}

        {/* Real-time TV Match Finished Glowing Glass Overlay Popup */}
        {showMatchEndOverlay && (
          <div className="absolute inset-0 bg-[#07080a]/92 backdrop-blur-md flex flex-col justify-center items-center p-4 sm:p-6 z-[100] animate-fade-in text-center select-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="max-w-md w-full bg-zinc-50 border border-zinc-200 p-6 rounded-[28px] shrink-0 shadow-2xl relative z-10 space-y-4 animate-scale-up text-zinc-950">
              
              <div className="flex flex-col items-center space-y-1">
                <div className="w-11 h-11 bg-amber-500/15 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 shadow-md shadow-amber-500/5">
                  <Trophy className="w-5.5 h-5.5 animate-bounce" style={{ animationDuration: '3.5s' }} />
                </div>
                <h2 className="text-lg font-black text-zinc-950 font-mono tracking-wider mt-1.5">MAÇ SONA ERDİ!</h2>
                <p className="text-[10px] text-zinc-600 font-mono">DÜDÜK: <span className="text-emerald-700 font-black uppercase">ERSAN EFENDİ</span></p>
              </div>

              {/* Glowing scoreboard row */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-inner">
                <div className="flex flex-col items-center flex-1 space-y-1">
                  <img src={homeClub.badge} alt={homeClub.name} className="w-9 h-9 object-contain" referrerPolicy="no-referrer" />
                  <span className="text-[10px] font-black text-zinc-800 truncate max-w-[90px]">{homeClub.shortName}</span>
                </div>
                
                <div className="flex flex-col items-center shrink-0 px-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono font-black text-zinc-950">{homeScore}</span>
                    <span className="text-zinc-500 font-black text-base">-</span>
                    <span className="text-2xl font-mono font-black text-zinc-950">{awayScore}</span>
                  </div>
                  <span className="text-[8px] text-[#FF007A] uppercase font-black tracking-widest font-mono mt-0.5">90' FINAL RAPORU</span>
                </div>

                <div className="flex flex-col items-center flex-1 space-y-1">
                  <img src={awayClub.badge} alt={awayClub.name} className="w-9 h-9 object-contain" referrerPolicy="no-referrer" />
                  <span className="text-[10px] font-black text-zinc-800 truncate max-w-[90px]">{awayClub.shortName}</span>
                </div>
              </div>

              {/* Scorers Section with Football symbol representation */}
              <div className="space-y-1 max-h-[105px] overflow-y-auto pr-1">
                <p className="text-[9px] uppercase font-mono font-bold text-zinc-700 text-left pl-1">GOL ATANLAR</p>
                {scorersRef.current && scorersRef.current.length > 0 ? (
                  <div className="space-y-1">
                    {scorersRef.current.map((sc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white px-3 py-1 border border-zinc-200 rounded-xl text-[10px] text-zinc-800">
                        <span className="font-semibold flex items-center gap-1.5">
                          <span className="text-emerald-600 text-[10px]">⚽</span> {sc.split(' (')[0]}
                        </span>
                        <span className="font-mono text-[9px] text-zinc-600 font-bold">{sc.split(' (')[1]?.replace(')', '') || 'GOL'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-zinc-700 bg-white border border-zinc-200 py-2.5 rounded-xl text-center">
                    Bu karşılaşmada gol sesi çıkmadı.
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2.5 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowMatchEndOverlay(false)}
                  className="w-full py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-950 font-black text-[10px] sm:text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Eye className="w-3.5 h-3.5 text-[#FF007A]" />
                  SAHAYI İNCELE & TEKRAR SEYRET
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMatchFinished({
                      homeScore,
                      awayScore,
                      scorers: scorersRef.current,
                      events: matchEventsRef.current,
                      stats: {
                        homeShots,
                        awayShots,
                        homePos: Math.round(possession),
                        awayPos: Math.round(100 - possession)
                      }
                    });
                  }}
                  className="w-full py-2 bg-[#FF007A] hover:bg-[#FF007A]/95 text-white font-black text-[10px] sm:text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#FF007A]/15 scale-100 hover:scale-[1.01]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  HAFTAYI TAMAMLA & OFİSE DÖN ➜
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Speed Controls Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
        {/* Game Stats or End Rapor Panel */}
        <div className="sm:col-span-5 bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-3xl flex flex-col justify-between space-y-4">
          {matchDone ? (
            <div className="flex flex-col h-full justify-between space-y-4">
              <div className="space-y-3.5">
                <div className="border-b border-zinc-800 pb-2">
                  <span className="text-[9px] bg-[#FF007A]/15 text-[#FF007A] px-2.5 py-1 rounded-full uppercase font-mono font-black tracking-widest border border-[#FF007A]/20">
                    MAÇ SONU RAPORU • 90'
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900">
                  <div className="flex flex-col items-center flex-1">
                    <img src={homeClub.badge} alt={homeClub.name} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                    <span className="text-[10px] font-bold text-zinc-400 mt-1 truncate max-w-[80px]">{homeClub.shortName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-2xl font-mono font-black text-zinc-100">{homeScore}</span>
                    <span className="text-zinc-500 font-mono text-xs">-</span>
                    <span className="text-2xl font-mono font-black text-zinc-100">{awayScore}</span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <img src={awayClub.badge} alt={awayClub.name} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                    <span className="text-[10px] font-bold text-zinc-400 mt-1 truncate max-w-[80px]">{awayClub.shortName}</span>
                  </div>
                </div>

                <div className="space-y-2 bg-zinc-950/20 p-3 rounded-2xl border border-zinc-900/60 font-mono text-xs text-zinc-400">
                  <div className="flex justify-between text-[10px]">
                    <span>Topla Oynama</span>
                    <span>%{Math.round(possession)} - %{Math.round(100 - possession)}</span>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden flex">
                    <div className="bg-[#FF007A]" style={{ width: `${possession}%` }}></div>
                    <div className="bg-zinc-600" style={{ width: `${100 - possession}%` }}></div>
                  </div>
                  <div className="flex justify-between pt-1.5 text-[10px] border-t border-zinc-900/40">
                    <span>Toplam Şutlar</span>
                    <span className="text-zinc-200 font-bold">{homeShots} - {awayShots}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Oyuncu Değişikliği</span>
                    <span className="text-zinc-200 font-bold">{subCount} / 5</span>
                  </div>
                </div>

                {scorersRef.current.length > 0 && (
                  <div className="space-y-1 bg-zinc-950/40 p-2.5 rounded-2xl border border-zinc-900">
                    <span className="text-[9px] font-bold text-[#FF007A] uppercase font-mono tracking-wider">GOL ATANLAR</span>
                    <div className="max-h-[64px] overflow-y-auto text-[10px] font-mono text-zinc-300 space-y-1 pr-1">
                      {scorersRef.current.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span>⚽</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1 border-t border-zinc-800/40">
                <button
                  type="button"
                  onClick={handleReplayMatch}
                  className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#FF007A] group-hover:rotate-180 transition-transform duration-500" />
                  YENİDEN OYNAT (REPLAY)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMatchFinished({
                      homeScore,
                      awayScore,
                      scorers: scorersRef.current,
                      events: matchEventsRef.current,
                      stats: {
                        homeShots,
                        awayShots,
                        homePos: Math.round(possession),
                        awayPos: Math.round(100 - possession)
                      }
                    });
                  }}
                  className="w-full py-2.5 bg-[#FF007A] hover:bg-[#FF007A]/90 text-white font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.01] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  HAFTAYI TAMAMLA & GİT ➜
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-zinc-800/45 pb-1.5">
                <h4 className="text-xs font-mono font-bold text-[#FF007A] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Maç İstatistikleri
                </h4>
              </div>

              <div className="space-y-4 text-xs font-mono">
                {/* Possession Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Topla Oynama (E)</span>
                    <span>% {Math.round(possession)} - % {Math.round(100 - possession)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                    <div className="bg-[#FF007A]" style={{ width: `${possession}%` }}></div>
                    <div className="bg-zinc-600" style={{ width: `${100 - possession}%` }}></div>
                  </div>
                </div>

                {/* Shots Row */}
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Şutlar</span>
                  <span className="font-bold text-zinc-200">{homeShots} - {awayShots}</span>
                </div>

                {/* Substitution Limits */}
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Yapılan Değişiklikler</span>
                  <span className="font-bold text-zinc-200">{subCount} / 5</span>
                </div>
                
                {/* Tactics Override inside Match */}
                <div className="space-y-1.5 border-t border-zinc-800/30 pt-3">
                  <label className="text-[10px] text-zinc-500 tracking-wider uppercase font-bold">Mentalite Revizesi</label>
                  <select
                    disabled={matchDone}
                    value={currentMentality}
                    onChange={(e) => setCurrentMentality(e.target.value as Tactics['mentality'])}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-zinc-200 font-mono font-bold focus:outline-none"
                  >
                    <option value="DEFENSIVE">Otobüsü Çek (Katı Defans)</option>
                    <option value="CAUTIOUS">Kontra Pozisyonu Al</option>
                    <option value="BALANCED">Mevcut Sistemi Koru</option>
                    <option value="ATTACKING">Hücum Gücünü Artır</option>
                    <option value="OVERLOAD">Tam Saha Baskı Yap</option>
                  </select>
                </div>
              </div>

              {/* Player subs button */}
              {!matchDone && (
                <button
                  onClick={() => setSubsModalOpen(true)}
                  className="w-full py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-1.5 animate-pulse"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#FF007A]" /> Oyuncu Değiştir (Sub)
                </button>
              )}
            </>
          )}
        </div>

        {/* Live commentary Feed */}
        <div className="sm:col-span-7 bg-zinc-950/40 p-5 rounded-3xl border border-zinc-800/80 flex flex-col justify-between h-[340px] overflow-hidden">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800/40 shrink-0">
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Simülasyon Logu</span>
            
            {/* Simulation controls */}
            {!matchDone && (
              <div className="flex items-center gap-1.5 p-0.5 bg-zinc-900 rounded-xl border border-zinc-800 font-mono text-[9px]">
                <button
                  onClick={toggleSimulation}
                  className="p-1 px-2.5 rounded-lg hover:text-white hover:bg-zinc-800 font-bold flex items-center gap-1"
                >
                  {isSimulating ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  {isSimulating ? 'DURDUR' : 'DEVAM'}
                </button>
                <div className="w-[1px] h-3 bg-zinc-800" />
                {([1, 2, 5, 50] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`p-1 px-[7px] rounded-lg font-bold transition-all ${speed === s ? 'bg-[#FF007A] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
                  >
                    {s === 50 ? 'ANLIK' : `${s}X`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ticking log rows */}
          <div className="flex-1 overflow-y-auto font-mono text-xs text-zinc-300 space-y-2.5 py-4 pr-1">
            {logs.slice().reverse().map((log, idx) => {
              const isGoalLog = log.includes("[GOO") || log.includes("[AĞL");
              const isCardLog = log.includes("[Sarı") || log.includes("[Kırmızı");
              const isHalfTime = log.includes("devre") || log.includes("Son düdük");
              
              let fontColor = 'text-zinc-400';
              if (isGoalLog) fontColor = 'text-yellow-400 font-bold border-l border-yellow-400/40 pl-2 bg-yellow-500/5 py-1 rounded-r-lg';
              else if (isCardLog) fontColor = 'text-amber-400 border-l border-amber-500/20 pl-2';
              else if (isHalfTime) fontColor = 'text-[#FF007A] font-semibold tracking-wide border-t border-b border-zinc-800/40 py-1.5';

              return (
                <p key={idx} className={`leading-relaxed ${fontColor}`}>
                  {log}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* Substitutions Sub Mode Modal (Overlay inside widget) */}
      {subsModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 max-w-lg w-full rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#FF007A]" /> Oyuncu Değişikliği (Yedekler)
              </h3>
              <button
                onClick={() => setSubsModalOpen(false)}
                className="text-xs text-zinc-500 font-mono hover:text-zinc-300"
              >
                Kapat
              </button>
            </div>

            <p className="text-xs text-zinc-500 font-mono">Maç sırasında 5 oyuncuya kadar değişiklik hakkınız vardır. Değişmek istediğiniz çifti seçin.</p>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 select-none font-mono text-xs">
              <div className="grid grid-cols-1 gap-3">
                {/* Active Starter row */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Sahadan Çıkacak (İlk 11)</span>
                  <div className="space-y-1.5">
                    {starters.map((starter) => (
                      <div key={starter.id} className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/60 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-zinc-200">{starter.name}</p>
                          <p className="text-[10px] text-[#FF007A] font-bold">OVR {starter.rating} • {starter.position}</p>
                        </div>
                        
                        {/* Selected bench swap trigger */}
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleSubstitution(starter.id, e.target.value);
                            }
                          }}
                          className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 p-1.5 rounded-lg tracking-tight font-bold"
                          defaultValue=""
                        >
                          <option value="" disabled>Yedek Seçin...</option>
                          {bench.map(b => (
                            <option key={b.id} value={b.id}>{b.name} (OVR:{b.rating} - {b.position})</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
