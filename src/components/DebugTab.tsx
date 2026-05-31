import React, { useState, useEffect } from 'react';
import { Club, Player, MatchEvent } from '../types';
import { generateRosterForTeam } from '../utils/generator';
import { Play, Sparkles, Sliders, Activity, Award, ShieldAlert, BadgeInfo, Cpu, Thermometer, AlertCircle, RefreshCw, BarChart3, HeartPulse } from 'lucide-react';

interface DebugTabProps {
  teams: Club[];
  squads: Record<string, Player[]>;
  seed: number;
  onSeedChange: (seed: number) => void;
  onNotify?: (title: string, message: string, variant?: 'info' | 'success' | 'warning' | 'danger') => void;
}

// Deterministic seed-based random generator
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

// Weather profiles
interface WeatherProfile {
  name: string;
  staminaDecayMultiplier: number;
  injuryRiskMultiplier: number;
  passAccuracyMultiplier: number;
  shootAccuracyMultiplier: number;
  gkReactionMultiplier: number;
  description: string;
}

const WEATHER_PROFILES: Record<string, WeatherProfile> = {
  PERFECT: {
    name: "Mükemmel Güneşli Hava (Güneşli)",
    staminaDecayMultiplier: 1.0,
    injuryRiskMultiplier: 1.0,
    passAccuracyMultiplier: 1.0,
    shootAccuracyMultiplier: 1.0,
    gkReactionMultiplier: 1.0,
    description: "Zemin mükemmel durumda, oyuncular maksimum performans sergiler."
  },
  RAINY: {
    name: "Yoğun Yağmurlu (Kaygan Zemin)",
    staminaDecayMultiplier: 1.15,
    injuryRiskMultiplier: 1.3,
    passAccuracyMultiplier: 0.9,
    shootAccuracyMultiplier: 0.92,
    gkReactionMultiplier: 0.88,
    description: "Zemin kaygan, şutlar ve paslar kontrolsüzleşir; kaleci için topu kavramak zordur."
  },
  MUDDY: {
    name: "Çamurlu / Ağır Saha Koşulları",
    staminaDecayMultiplier: 1.35,
    injuryRiskMultiplier: 1.6,
    passAccuracyMultiplier: 0.82,
    shootAccuracyMultiplier: 0.85,
    gkReactionMultiplier: 0.95,
    description: "Oyuncuların kondisyonu çok çabuk tükenir, ağır zemin sakatlık riskini ciddi seviyede artırır."
  },
  SNOWY: {
    name: "Karlı / Buzlu ve Soğuk",
    staminaDecayMultiplier: 1.25,
    injuryRiskMultiplier: 1.45,
    passAccuracyMultiplier: 0.85,
    shootAccuracyMultiplier: 0.88,
    gkReactionMultiplier: 0.85,
    description: "Top hızı yavaşlar, oyuncu reaksiyon süreleri ve vücut ısı kontrolü zorlaşır."
  }
};

// Referee Profiles
interface RefereeProfile {
  name: string;
  strictness: number; // 1-10 scale
  cardFrequency: number;
  foulFrequency: number;
  penaltyLikelihood: number;
}

const REFEREE_PROFILES: Record<string, RefereeProfile> = {
  GENTLE: {
    name: "Hoşgörülü / İngiliz Tarzı (Yumuşak)",
    strictness: 2,
    cardFrequency: 0.3,
    foulFrequency: 0.6,
    penaltyLikelihood: 0.4
  },
  BALANCED: {
    name: "Standart / Dengeli Hakem",
    strictness: 5,
    cardFrequency: 1.0,
    foulFrequency: 1.0,
    penaltyLikelihood: 1.0
  },
  STRICT: {
    name: "Kuralcı / Sıkı Hakem",
    strictness: 8,
    cardFrequency: 1.8,
    foulFrequency: 1.4,
    penaltyLikelihood: 1.5
  },
  RUTHLESS: {
    name: "Sıfır Tolerans / Acımasız Kartal",
    strictness: 10,
    cardFrequency: 2.8,
    foulFrequency: 1.9,
    penaltyLikelihood: 2.3
  }
};

export default function DebugTab({ teams, squads, seed, onSeedChange, onNotify }: DebugTabProps) {
  const [homeTeamId, setHomeTeamId] = useState<string>('');
  const [awayTeamId, setAwayTeamId] = useState<string>('');
  const [weather, setWeather] = useState<string>('PERFECT');
  const [referee, setReferee] = useState<string>('BALANCED');
  
  // Tactical variables
  const [homeMentality, setHomeMentality] = useState<'DEFENSIVE' | 'BALANCED' | 'ATTACKING' | 'OVERLOAD'>('BALANCED');
  const [awayMentality, setAwayMentality] = useState<'DEFENSIVE' | 'BALANCED' | 'ATTACKING' | 'OVERLOAD'>('BALANCED');
  const [intensity, setIntensity] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');

  // Simulation output states
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [activeTabSub, setActiveTabSub] = useState<'CHRONICLE' | 'FATIGUE' | 'ANALYSIS'>('CHRONICLE');

  // Initialize teams choice defensively
  useEffect(() => {
    if (teams.length > 1) {
      setHomeTeamId(teams[0].id);
      setAwayTeamId(teams[1].id);
    }
  }, [teams]);

  // Handle building new seed matching
  const generateRandomSeed = () => {
    onSeedChange(Math.floor(Date.now() / 1000));
  };

  // Run Deterministic 90-Minute Simulation
  const handleSimulate90Minutes = () => {
    if (!homeTeamId || !awayTeamId) {
      onNotify?.('Takım Seçimi Eksik', 'Lütfen ev sahibi ve deplasman takımlarını seçin.', 'warning');
      return;
    }
    if (homeTeamId === awayTeamId) {
      onNotify?.('Geçersiz Eşleşme', 'Ev sahibi ve deplasman takımları aynı olamaz.', 'warning');
      return;
    }

    const rng = new SeededRandom(seed);
    const weatherProfile = WEATHER_PROFILES[weather];
    const refProfile = REFEREE_PROFILES[referee];

    // Read full starting squads or generate fallback rosters
    const homeClub = teams.find(t => t.id === homeTeamId)!;
    const awayClub = teams.find(t => t.id === awayTeamId)!;

    let hRoster = squads[homeTeamId] || [];
    let aRoster = squads[awayTeamId] || [];

    if (hRoster.length === 0) {
      hRoster = generateRosterForTeam(homeTeamId, homeClub.name, homeClub.reputation);
    }
    if (aRoster.length === 0) {
      aRoster = generateRosterForTeam(awayTeamId, awayClub.name, awayClub.reputation);
    }

    const homeStarters = hRoster.filter(p => p.isStarting).slice(0, 11);
    const awayStarters = aRoster.filter(p => p.isStarting).slice(0, 11);

    // Dynamic state stores for all 22 players to track fatigue decay
    const simPlayers = [
      ...homeStarters.map(p => ({
        ...p,
        teamSide: 'home' as const,
        currentStamina: 100,
        tempRating: p.rating,
        goalsInMatch: 0,
        assistsInMatch: 0,
        tacklesInMatch: 0,
        savesInMatch: 0,
        foulsCommitted: 0,
        yellowCardsInMatch: 0,
        redCardsInMatch: 0,
        injuredInMatch: false,
        performanceScore: 6.0
      })),
      ...awayStarters.map(p => ({
        ...p,
        teamSide: 'away' as const,
        currentStamina: 100,
        tempRating: p.rating,
        goalsInMatch: 0,
        assistsInMatch: 0,
        tacklesInMatch: 0,
        savesInMatch: 0,
        foulsCommitted: 0,
        yellowCardsInMatch: 0,
        redCardsInMatch: 0,
        injuredInMatch: false,
        performanceScore: 6.0
      }))
    ];

    // Stats compilation
    let homeScore = 0;
    let awayScore = 0;
    let homeShots = 0;
    let awayShots = 0;
    let homeShotsOnTarget = 0;
    let awayShotsOnTarget = 0;
    let homePassAttempts = 0;
    let homePassSuccess = 0;
    let awayPassAttempts = 0;
    let awayPassSuccess = 0;
    let homeFouls = 0;
    let awayFouls = 0;
    let homeYellows = 0;
    let awayYellows = 0;
    let homeReds = 0;
    let awayReds = 0;
    let homeCorners = 0;
    let awayCorners = 0;
    let homeOffsides = 0;
    let awayOffsides = 0;
    let injuriesOccurred = 0;

    const chronicle: MatchEvent[] = [
      {
        minute: 0,
        type: 'COMMENT',
        teamId: 'system',
        playerName: 'Hakem',
        detail: `Hakem maçı başlattı! Hava durumu: ${weatherProfile.name}. Hakem: ${refProfile.name}. Başarılar.`
      }
    ];

    // Ball location: 'DEF_HOME', 'MID_HOME', 'MID_AWAY', 'DEF_AWAY'
    let ballZone: 'DEF_HOME' | 'MID' | 'DEF_AWAY' = 'MID';
    let currentPossession: 'home' | 'away' = rng.next() < 0.5 ? 'home' : 'away';

    let homeAvgPower = 60;
    let awayAvgPower = 60;

    // Simulation loop minute-by-minute
    for (let min = 1; min <= 90; min++) {
      // 1. STAMINA DECAY COMPUTATION
      simPlayers.forEach(p => {
        if (p.injuredInMatch || p.redCardsInMatch > 0) return;

        // Base fatigue decay based on position
        let baseDecay = 0.45;
        if (p.position === 'GK') baseDecay = 0.1;
        else if (p.position === 'DEF') baseDecay = 0.4;
        else if (p.position === 'MID') baseDecay = 0.55;
        else if (p.position === 'ATT') baseDecay = 0.5;

        // Mentalities influence physical workload
        const sideMentality = p.teamSide === 'home' ? homeMentality : awayMentality;
        const mentalityMultiplier = sideMentality === 'OVERLOAD' ? 1.25 : sideMentality === 'ATTACKING' ? 1.12 : sideMentality === 'DEFENSIVE' ? 0.9 : 1.0;
        
        // Intensity multiplier
        const intensityMul = intensity === 'HIGH' ? 1.25 : intensity === 'LOW' ? 0.8 : 1.0;

        // Weather multiplier
        const weatherMul = weatherProfile.staminaDecayMultiplier;

        // Decay calculation
        const deltaStamina = baseDecay * mentalityMultiplier * intensityMul * weatherMul * (1 + (p.pace || 65) * 0.001);
        p.currentStamina = Math.max(15, p.currentStamina - deltaStamina);

        // Stamina penalty modifies player active attributes
        p.tempRating = Math.round(p.rating * (0.65 + 0.35 * (p.currentStamina / 100)));
      });

      // Half time commentary
      if (min === 45) {
        chronicle.push({
          minute: 45,
          type: 'COMMENT',
          teamId: 'system',
          playerName: 'Spiker',
          detail: `İlk yarı sona erdi: ${homeClub.name} ${homeScore} - ${awayScore} ${awayClub.name}. Oyuncular soyunma odasına yöneliyor.`
        });
        continue;
      }
      if (min === 46) {
        chronicle.push({
          minute: 46,
          type: 'COMMENT',
          teamId: 'system',
          playerName: 'Spiker',
          detail: `İkinci yarı hakem düdüğüyle başladı! Bakalım takımlar ikinci devrede nasıl reaksiyon gösterecek.`
        });
        continue;
      }

      // 2. TACTICAL TRANSITIONS AND INCIDENTS
      // Probability factor adjusted on mentality
      const baseChance = rng.next();

      // Side relative team power adjusted with stamina
      homeAvgPower = simPlayers.filter(p => p.teamSide === 'home' && !p.injuredInMatch && p.redCardsInMatch === 0).reduce((avg, p) => avg + p.tempRating, 0) / 11;
      awayAvgPower = simPlayers.filter(p => p.teamSide === 'away' && !p.injuredInMatch && p.redCardsInMatch === 0).reduce((avg, p) => avg + p.tempRating, 0) / 11;

      // Adjust possession probabilities based on rating & zone
      const adjustedHomePoss = 50 + (homeAvgPower - awayAvgPower) * 1.5 + (homeMentality === 'OVERLOAD' ? 5 : homeMentality === 'DEFENSIVE' ? -5 : 0);
      const safeHomePoss = Math.max(30, Math.min(70, adjustedHomePoss));

      // Calculate passes in this minute
      const actsInMin = Math.floor(rng.range(2, 6));
      for (let act = 0; act < actsInMin; act++) {
        if (currentPossession === 'home') homePassAttempts++; else awayPassAttempts++;

        // Pass success calculation
        const teamSide = currentPossession;
        const currentMidfielders = simPlayers.filter(p => p.teamSide === teamSide && p.position === 'MID' && !p.injuredInMatch);
        const passer = currentMidfielders.length > 0 ? rng.choice(currentMidfielders) : rng.choice(simPlayers.filter(p => p.teamSide === teamSide && !p.injuredInMatch));
        
        if (!passer) continue;

        const basePassProb = (passer.passing || 70) * weatherProfile.passAccuracyMultiplier;
        const successLimit = 40 + basePassProb * 0.45;

        if (rng.range(0, 100) < successLimit) {
          if (teamSide === 'home') homePassSuccess++; else awayPassSuccess++;
          
          // Ball moves up the field zone
          if (ballZone === 'DEF_HOME' && teamSide === 'home') ballZone = 'MID';
          else if (ballZone === 'MID' && teamSide === 'home') ballZone = 'DEF_AWAY';
          else if (ballZone === 'DEF_AWAY' && teamSide === 'away') ballZone = 'MID';
          else if (ballZone === 'MID' && teamSide === 'away') ballZone = 'DEF_HOME';
        } else {
          // Pass intercepted
          currentPossession = teamSide === 'home' ? 'away' : 'home';
          const defendersSide = currentPossession;
          const activeDefenders = simPlayers.filter(p => p.teamSide === defendersSide && p.position === 'DEF' && !p.injuredInMatch);
          const interceptor = activeDefenders.length > 0 ? rng.choice(activeDefenders) : undefined;
          if (interceptor) {
            interceptor.tacklesInMatch++;
            interceptor.performanceScore = Math.min(10.0, interceptor.performanceScore + 0.15);
          }
          break; // Action chain broken
        }
      }

      // Foul occurrence calculation based on Ref and Intensity
      const foulLimit = 0.08 * refProfile.foulFrequency * (intensity === 'HIGH' ? 1.3 : 1.0);
      if (rng.next() < foulLimit) {
        const offendingSide = rng.next() < 0.5 ? 'home' : 'away';
        const crimeSquad = simPlayers.filter(p => p.teamSide === offendingSide && p.position !== 'GK' && !p.injuredInMatch);
        const criminal = crimeSquad.length > 0 ? rng.choice(crimeSquad) : undefined;

        if (criminal) {
          if (offendingSide === 'home') homeFouls++; else awayFouls++;
          criminal.foulsCommitted++;
          criminal.performanceScore = Math.max(3.0, criminal.performanceScore - 0.25);

          // Card assessment
          const cardThreshold = 0.22 * refProfile.cardFrequency;
          const cardRoll = rng.next();

          if (cardRoll < cardThreshold) {
            // Yellow card
            if (criminal.yellowCardsInMatch === 1) {
              // Red card (second yellow)
              criminal.yellowCardsInMatch++;
              criminal.redCardsInMatch = 1;
              if (offendingSide === 'home') { homeReds++; } else { awayReds++; }
              criminal.performanceScore = 3.0;

              chronicle.push({
                minute: min,
                type: 'RED',
                teamId: offendingSide === 'home' ? homeClub.id : awayClub.id,
                playerName: criminal.name,
                detail: `İkinci sarı karttan kırmızı kart! ${criminal.name} oyun dışı kaldı!`
              });
            } else if (criminal.yellowCardsInMatch === 0) {
              criminal.yellowCardsInMatch = 1;
              if (offendingSide === 'home') { homeYellows++; } else { awayYellows++; }

              chronicle.push({
                minute: min,
                type: 'YELLOW',
                teamId: offendingSide === 'home' ? homeClub.id : awayClub.id,
                playerName: criminal.name,
                detail: `Sert müdahaleden dolayı hakem sarı kartını gösteriyor.`
              });
            }
          }

          // Offside calculation
          if (rng.next() < 0.15) {
            if (offendingSide === 'home') awayOffsides++; else homeOffsides++;
            chronicle.push({
              minute: min,
              type: 'COMMENT',
              teamId: offendingSide === 'home' ? awayClub.id : homeClub.id,
              playerName: 'Ofsayt',
              detail: `Yardımcı hakem ofsayt bayrağını kaldırıyor.`
            });
          }
        }
      }

      // Injury calculation
      const injuryLimit = 0.005 * weatherProfile.injuryRiskMultiplier * (intensity === 'HIGH' ? 1.4 : 1.0);
      if (rng.next() < injuryLimit) {
        const victimSide = rng.next() < 0.5 ? 'home' : 'away';
        const targetSquad = simPlayers.filter(p => p.teamSide === victimSide && !p.injuredInMatch);
        const victim = targetSquad.length > 0 ? rng.choice(targetSquad) : undefined;

        if (victim) {
          victim.injuredInMatch = true;
          victim.performanceScore = Math.max(4.0, victim.performanceScore - 1.0);
          injuriesOccurred++;

          // Attempting tactical replacement instantly
          const benchPool = victimSide === 'home' 
            ? (squads[homeTeamId] || []).filter(p => !p.isStarting && p.injuryWeeks === 0 && !simPlayers.some(sp => sp.id === p.id))
            : (squads[awayTeamId] || []).filter(p => !p.isStarting && p.injuryWeeks === 0 && !simPlayers.some(sp => sp.id === p.id));
          
          let subDetail = "Sakatlandı ve oyuna devam edemiyor.";
          if (benchPool.length > 0) {
            const subIn = rng.choice(benchPool);
            subDetail = `${subIn.name} oyuna girerken sakatlanan ${victim.name} sedyeyle taşınıyor.`;
            // Add sub to active trackers
            simPlayers.push({
              ...subIn,
              teamSide: victimSide,
              currentStamina: 100,
              tempRating: subIn.rating,
              goalsInMatch: 0,
              assistsInMatch: 0,
              tacklesInMatch: 0,
              savesInMatch: 0,
              foulsCommitted: 0,
              yellowCardsInMatch: 0,
              redCardsInMatch: 0,
              injuredInMatch: false,
              performanceScore: 6.0
            });
          }

          chronicle.push({
            minute: min,
            type: 'INJURY',
            teamId: victimSide === 'home' ? homeClub.id : awayClub.id,
            playerName: victim.name,
            detail: subDetail
          });
        }
      }

      // 3. SHOT INITIATION / GOAL PHYSICS CHALLENGE
      // Check if team has advanced into opponent's box zone
      if (ballZone === 'DEF_AWAY' && currentPossession === 'home') {
        homeShots++;
        
        // Attacker selected
        const strikers = simPlayers.filter(p => p.teamSide === 'home' && (p.position === 'ATT' || p.position === 'MID') && !p.injuredInMatch);
        const shooter = strikers.length > 0 ? rng.choice(strikers) : rng.choice(simPlayers.filter(p => p.teamSide === 'home' && !p.injuredInMatch));
        
        if (shooter) {
          const isTarget = rng.next() < 0.6 * weatherProfile.shootAccuracyMultiplier;
          if (isTarget) {
            homeShotsOnTarget++;
            
            // Goalkeeper challenge
            const homeGoalKeeper = simPlayers.find(p => p.teamSide === 'away' && p.position === 'GK');
            const goalkeeperSkill = homeGoalKeeper ? homeGoalKeeper.tempRating : 65;
            const gkFactor = goalkeeperSkill * weatherProfile.gkReactionMultiplier * (0.8 + rng.next() * 0.4);

            const shooterPower = shooter.shooting || 70;
            const shootFactor = shooterPower * (0.8 + rng.next() * 0.4);

            // Did it beat the keeper?
            if (shootFactor > gkFactor) {
              homeScore++;
              shooter.goalsInMatch++;
              shooter.performanceScore = Math.min(10.0, shooter.performanceScore + 1.25);
              
              if (homeGoalKeeper) {
                homeGoalKeeper.performanceScore = Math.max(3.5, homeGoalKeeper.performanceScore - 0.4);
              }

              // Assist search
              const teamBuddies = simPlayers.filter(p => p.teamSide === 'home' && p.id !== shooter.id && !p.injuredInMatch);
              const assister = teamBuddies.length > 0 && rng.next() < 0.75 ? rng.choice(teamBuddies) : undefined;
              if (assister) {
                assister.assistsInMatch++;
                assister.performanceScore = Math.min(10.0, assister.performanceScore + 0.65);
              }

              chronicle.push({
                minute: min,
                type: 'GOAL',
                teamId: homeClub.id,
                playerName: shooter.name,
                detail: assister ? `${assister.name} nefis pasla asist yaptı.` : "Ceza sahası dışından sert vole."
              });
            } else {
              // Saved
              if (homeGoalKeeper) {
                homeGoalKeeper.savesInMatch++;
                homeGoalKeeper.performanceScore = Math.min(10.0, homeGoalKeeper.performanceScore + 0.35);
              }

              if (rng.next() < 0.45) {
                homeCorners++;
                chronicle.push({
                  minute: min,
                  type: 'COMMENT',
                  teamId: homeClub.id,
                  playerName: shooter.name,
                  detail: `Kaleci topu kornere çeldi! Şutu çeken: ${shooter.name}.`
                });
              }
            }
          } else {
            // Out
            if (rng.next() < 0.22) {
              chronicle.push({
                minute: min,
                type: 'COMMENT',
                teamId: homeClub.id,
                playerName: shooter.name,
                detail: `${shooter.name} ile gol şansı! Vuruşu üstten direğe çarparak auta gidiyor.`
              });
            }
          }
        }
        
        // Reset zone to midfield
        ballZone = 'MID';
        currentPossession = 'away';
      } 
      else if (ballZone === 'DEF_HOME' && currentPossession === 'away') {
        awayShots++;
        
        const strikers = simPlayers.filter(p => p.teamSide === 'away' && (p.position === 'ATT' || p.position === 'MID') && !p.injuredInMatch);
        const shooter = strikers.length > 0 ? rng.choice(strikers) : rng.choice(simPlayers.filter(p => p.teamSide === 'away' && !p.injuredInMatch));
        
        if (shooter) {
          const isTarget = rng.next() < 0.6 * weatherProfile.shootAccuracyMultiplier;
          if (isTarget) {
            awayShotsOnTarget++;
            
            // Goalkeeper challenge
            const awayGoalKeeper = simPlayers.find(p => p.teamSide === 'home' && p.position === 'GK');
            const goalkeeperSkill = awayGoalKeeper ? awayGoalKeeper.tempRating : 65;
            const gkFactor = goalkeeperSkill * weatherProfile.gkReactionMultiplier * (0.8 + rng.next() * 0.4);

            const shooterPower = shooter.shooting || 70;
            const shootFactor = shooterPower * (0.8 + rng.next() * 0.4);

            if (shootFactor > gkFactor) {
              awayScore++;
              shooter.goalsInMatch++;
              shooter.performanceScore = Math.min(10.0, shooter.performanceScore + 1.25);
              
              if (awayGoalKeeper) {
                awayGoalKeeper.performanceScore = Math.max(3.5, awayGoalKeeper.performanceScore - 0.4);
              }

              // Assist search
              const teamBuddies = simPlayers.filter(p => p.teamSide === 'away' && p.id !== shooter.id && !p.injuredInMatch);
              const assister = teamBuddies.length > 0 && rng.next() < 0.75 ? rng.choice(teamBuddies) : undefined;
              if (assister) {
                assister.assistsInMatch++;
                assister.performanceScore = Math.min(10.0, assister.performanceScore + 0.65);
              }

              chronicle.push({
                minute: min,
                type: 'GOAL',
                teamId: awayClub.id,
                playerName: shooter.name,
                detail: assister ? `${assister.name} asist yaptı.` : "Karambolde ceza sahasında sert yer vuruşu."
              });
            } else {
              // Saved
              if (awayGoalKeeper) {
                awayGoalKeeper.savesInMatch++;
                awayGoalKeeper.performanceScore = Math.min(10.0, awayGoalKeeper.performanceScore + 0.35);
              }

              if (rng.next() < 0.45) {
                awayCorners++;
                chronicle.push({
                  minute: min,
                  type: 'COMMENT',
                  teamId: awayClub.id,
                  playerName: shooter.name,
                  detail: `Kaleci müthiş uzandı! Korner. Şut: ${shooter.name}.`
                });
              }
            }
          } else {
            // Out
            if (rng.next() < 0.22) {
              chronicle.push({
                minute: min,
                type: 'COMMENT',
                teamId: awayClub.id,
                playerName: shooter.name,
                detail: `${shooter.name} karşı karşıya kaçırdı! Top yan ağlarda kaldı.`
              });
            }
          }
        }

        ballZone = 'MID';
        currentPossession = 'home';
      }
    }

    chronicle.push({
      minute: 90,
      type: 'COMMENT',
      teamId: 'system',
      playerName: 'Hakem',
      detail: `MAÇ SONA ERDİ! Karşılaşma sonucu: ${homeClub.name} ${homeScore} - ${awayScore} ${awayClub.name}.`
    });

    const calculatedHomePoss = Math.max(30, Math.min(70, Math.round(50 + (homeAvgPower - awayAvgPower) * 1.6 + (homePassSuccess - awayPassSuccess) * 0.3)));
    
    // Set simulated result panel
    setSimulationResult({
      seed,
      homeClub,
      awayClub,
      homeScore,
      awayScore,
      weather: weatherProfile,
      referee: refProfile,
      chronicle: chronicle.filter(e => e.type !== 'COMMENT' || (e.detail && e.detail.length > 0)),
      players: simPlayers,
      stats: {
        homePoss: calculatedHomePoss,
        awayPoss: 100 - calculatedHomePoss,
        homeShots,
        awayShots,
        homeShotsOnTarget,
        awayShotsOnTarget,
        homePassAccuracy: homePassAttempts > 0 ? Math.round((homePassSuccess / homePassAttempts) * 100) : 75,
        awayPassAccuracy: awayPassAttempts > 0 ? Math.round((awayPassSuccess / awayPassAttempts) * 100) : 73,
        homeFouls,
        awayFouls,
        homeYellows,
        awayYellows,
        homeReds,
        awayReds,
        homeCorners,
        awayCorners,
        homeOffsides,
        awayOffsides,
        injuriesOccurred
      }
    });

    setActiveTabSub('CHRONICLE');
  };

  // Run automatically on first render or when seed changes
  useEffect(() => {
    if (homeTeamId && awayTeamId && homeTeamId !== awayTeamId) {
      handleSimulate90Minutes();
    }
  }, [homeTeamId, awayTeamId, seed, weather, referee, homeMentality, awayMentality, intensity]);

  const activeHomePlayers = simulationResult ? simulationResult.players.filter((p: any) => p.teamSide === 'home') : [];
  const activeAwayPlayers = simulationResult ? simulationResult.players.filter((p: any) => p.teamSide === 'away') : [];

  return (
    <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-90 w-full shadow-2xl relative space-y-6 overflow-hidden" id="football-debug-sandbox">
      {/* Background neon ambient color */}
      <div className="absolute top-0 right-10 w-44 h-44 bg-[#FF007A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-44 h-44 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Title & Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-850 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-[#FF007A]/20 text-[#FF007A] text-[10px] font-mono font-extrabold uppercase tracking-widest rounded-full border border-[#FF007A]/40 flex items-center gap-1 leading-none shadow-sm shadow-[#FF007A]/15">
              <Cpu className="w-3.5 h-3.5" /> Geliştirici Sandbox Modu
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 tracking-tight">
            Football Simulation Engine Debugger
          </h2>
          <p className="text-xs text-zinc-550 leading-relaxed max-w-2xl font-mono">
            Tohum (seed) eşleştirmelerine duyarlı deterministik futbol simülatörü. Fiziksel dayanıklılık kaybı, zemin/hava durumu gecikmeleri, hakem kart sertliği ve kaleci refleks modellerini grafikler halinde anında raporlayın.
          </p>
        </div>

        {/* Refresh seed trigger */}
        <button
          type="button"
          onClick={generateRandomSeed}
          className="shrink-0 flex items-center gap-2 py-2 px-4 bg-zinc-900 hover:bg-zinc-805 text-zinc-200 border border-zinc-800 text-xs font-mono font-bold rounded-2xl transition-all cursor-pointer shadow-md select-none group"
        >
          <Sparkles className="w-4 h-4 text-[#FF007A] group-hover:animate-bounce" /> Rastgele Tohum (Seed) Üret
        </button>
      </div>

      {/* Simulator Inputs Grid Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 bg-zinc-900/40 p-5 rounded-3xl border border-zinc-900 shadow-inner">
        
        {/* Teams & Manual Seed Input */}
        <div className="md:col-span-5 space-y-4 font-mono text-xs">
          <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-[#FF007A]" />
            <span>Kondisyon ve Takım Belirleme</span>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-500 font-bold text-[10px] uppercase">Seçili Tohum No (Deterministic Seed):</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={seed}
                onChange={(e) => onSeedChange(parseInt(e.target.value) || 0)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 font-bold font-mono text-xs text-zinc-200 focus:outline-none focus:border-[#FF007A]"
                placeholder="Örn: 3089422"
              />
              <button
                type="button"
                onClick={handleSimulate90Minutes}
                className="py-2.5 px-4 bg-[#FF007A] hover:bg-[#FF007A]/92 text-white font-black rounded-xl transition-all flex items-center gap-1 cursor-pointer text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Yenile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-500 font-bold text-[10px] uppercase">Ev Sahibi (Home):</label>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-zinc-300 font-black cursor-pointer"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 font-bold text-[10px] uppercase">Deplasman (Away):</label>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-zinc-300 font-black cursor-pointer"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Environmental Factors (Physics Engine Parameters) */}
        <div className="md:col-span-4 space-y-4 font-mono text-xs">
          <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-wider">
            <Thermometer className="w-4 h-4 text-cyan-400" />
            <span>Fiziksel Saha Koşulları</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-500 font-bold text-[10px] uppercase flex items-center gap-1">Hava Durumu:</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-zinc-300 font-bold cursor-pointer"
              >
                {Object.keys(WEATHER_PROFILES).map(k => (
                  <option key={k} value={k}>{WEATHER_PROFILES[k].name.split(' (')[0]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500 font-bold text-[10px] uppercase">Hakem Profili:</label>
              <select
                value={referee}
                onChange={(e) => setReferee(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-zinc-300 font-bold cursor-pointer"
              >
                {Object.keys(REFEREE_PROFILES).map(k => (
                  <option key={k} value={k}>{REFEREE_PROFILES[k].name.split(' / ')[0]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-500 font-bold text-[10px] uppercase">Antrenman/Oyun Şiddeti (Intensity):</label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-850">
              {(['LOW', 'NORMAL', 'HIGH'] as const).map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntensity(i)}
                  className={`py-1 text-[10px] font-bold rounded-lg transition-all ${intensity === i ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
                >
                  {i === 'LOW' ? 'Hafif / Düşük' : i === 'HIGH' ? 'Pres / Yüksek' : 'Dengeli'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tactical Mentality Factors Checklist */}
        <div className="md:col-span-3 space-y-4 font-mono text-xs border-t md:border-t-0 md:border-l border-zinc-850 md:pl-5">
          <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-wider">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Taktiksel Yapay Zeka</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="space-y-1">
              <label className="text-zinc-500 text-[9px] uppercase font-bold">Ev Sahibi Mentalite:</label>
              <select
                value={homeMentality}
                onChange={(e) => setHomeMentality(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 text-xs text-zinc-300"
              >
                <option value="DEFENSIVE">Otobüsü Çek (Defans)</option>
                <option value="BALANCED">Sistem Dengesi</option>
                <option value="ATTACKING">Hücum Ağırlıklı</option>
                <option value="OVERLOAD">Tam Saha Baskı (Xtreme)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500 text-[9px] uppercase font-bold">Deplasman Mentalite:</label>
              <select
                value={awayMentality}
                onChange={(e) => setAwayMentality(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 text-xs text-zinc-300"
              >
                <option value="DEFENSIVE">Otobüsü Çek (Defans)</option>
                <option value="BALANCED">Sistem Dengesi</option>
                <option value="ATTACKING">Hücum Ağırlıklı</option>
                <option value="OVERLOAD">Tam Saha Baskı (Xtreme)</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* Weather and Ref description labels */}
      <div className="bg-zinc-900/10 border border-zinc-900/60 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-mono text-zinc-400">
        <BadgeInfo className="w-4 h-4 text-[#FF007A] shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-zinc-300">Zemin Etkisi:</strong> {WEATHER_PROFILES[weather].description} • 
          <strong className="text-zinc-300"> Hakem Sertliği:</strong> Kart şansı {REFEREE_PROFILES[referee].cardFrequency} kat, faul şansı {REFEREE_PROFILES[referee].foulFrequency} kat duyarlıdır.
        </p>
      </div>

      {/* Actual Deterministic Live Preview results when ready */}
      {simulationResult && (
        <div className="space-y-5 animate-fade-in">
          
          {/* Main Forecast Scoreboard Banner */}
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 rounded-3xl border border-zinc-850 flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative">
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Home Club */}
            <div className="flex items-center gap-4 text-center md:text-left flex-1 justify-end">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-zinc-100">{simulationResult.homeClub.name}</h3>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  {homeMentality}
                </span>
              </div>
              <img 
                src={simulationResult.homeClub.badge} 
                alt={simulationResult.homeClub.name} 
                className="w-12 h-12 object-contain shrink-0"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Score Center display */}
            <div className="flex flex-col items-center shrink-0 border-x border-zinc-800/80 px-10 text-center">
              <span className="text-[10px] bg-[#FF007A]/10 text-[#FF007A] px-2 py-0.5 rounded-md border border-[#FF007A]/20 font-mono font-bold uppercase tracking-widest">
                SEED: {simulationResult.seed} TAHMİNİ
              </span>
              <div className="flex items-center gap-5 mt-2.5">
                <span className="text-4xl font-mono font-black text-white">{simulationResult.homeScore}</span>
                <span className="text-zinc-500 font-mono text-xl font-bold">-</span>
                <span className="text-4xl font-mono font-black text-white">{simulationResult.awayScore}</span>
              </div>
              <p className="text-[9px] text-zinc-400 font-mono font-bold uppercase mt-2 tracking-widest">DETERMİNİSTİK 90 DAKİKA</p>
            </div>

            {/* Away Club */}
            <div className="flex items-center gap-4 text-center md:text-right flex-1 justify-start flex-row-reverse md:flex-row">
              <img 
                src={simulationResult.awayClub.badge} 
                alt={simulationResult.awayClub.name} 
                className="w-12 h-12 object-contain shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1">
                <h3 className="text-lg font-black text-zinc-100">{simulationResult.awayClub.name}</h3>
                <span className="text-[10px] bg-zinc-805 text-zinc-400 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  {awayMentality}
                </span>
              </div>
            </div>
          </div>

          {/* Quick analysis summary badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-zinc-900 border border-zinc-850 p-3 rounded-2xl flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500">Topla Oynama:</span>
              <span className="font-bold text-zinc-200">%{simulationResult.stats.homePoss} - %{simulationResult.stats.awayPoss}</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-850 p-3 rounded-2xl flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500">Toplam Şut:</span>
              <span className="font-bold text-zinc-200">{simulationResult.stats.homeShots} - {simulationResult.stats.awayShots}</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-850 p-3 rounded-2xl flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500">İsabetli Şut:</span>
              <span className="font-bold text-zinc-200">{simulationResult.stats.homeShotsOnTarget} - {simulationResult.stats.awayShotsOnTarget}</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-850 p-3 rounded-2xl flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500">Korner/Ofsayt:</span>
              <span className="font-bold text-zinc-200">{simulationResult.stats.homeCorners + simulationResult.stats.awayCorners} / {simulationResult.stats.homeOffsides + simulationResult.stats.awayOffsides}</span>
            </div>
          </div>

          {/* Forecast Analysis Mode Tabs */}
          <div className="flex justify-start border-b border-zinc-850 gap-1 pb-px">
            <button
              onClick={() => setActiveTabSub('CHRONICLE')}
              className={`py-2.5 px-5 font-mono text-xs font-black transition-all flex items-center gap-1.5 relative ${
                activeTabSub === 'CHRONICLE' 
                  ? 'text-white border-b-2 border-[#FF007A]' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Cpu className="w-4 h-4 text-[#FF007A]" /> 90 Dakika Kronik Akış (Chronicle)
            </button>
            <button
              onClick={() => setActiveTabSub('FATIGUE')}
              className={`py-2.5 px-5 font-mono text-xs font-black transition-all flex items-center gap-1.5 relative ${
                activeTabSub === 'FATIGUE' 
                  ? 'text-white border-b-2 border-[#FF007A]' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <HeartPulse className="w-4 h-4 text-emerald-450" /> Fiziksel Yorgunluk Analizi (Fatigue Decay)
            </button>
            <button
              onClick={() => setActiveTabSub('ANALYSIS')}
              className={`py-2.5 px-5 font-mono text-xs font-black transition-all flex items-center gap-1.5 relative ${
                activeTabSub === 'ANALYSIS' 
                  ? 'text-white border-b-2 border-[#FF007A]' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-cyan-450" /> Kaleci & Hakem Analitiği
            </button>
          </div>

          {/* Sub Tab Panel Displays */}
          {activeTabSub === 'CHRONICLE' && (
            <div className="bg-[#090b0e] p-5 rounded-3xl border border-zinc-900 shadow-inner h-[380px] overflow-y-auto space-y-3.5 pr-2">
              <div className="border-b border-zinc-900 pb-2.5">
                <span className="text-[10px] bg-zinc-800 text-zinc-400 py-1 px-2.5 rounded-md font-mono font-bold uppercase tracking-wider">
                  Detaylı Simülasyon Olayları
                </span>
              </div>

              {simulationResult.chronicle.map((event: MatchEvent, idx: number) => {
                const isGoal = event.type === 'GOAL';
                const isCard = event.type === 'YELLOW' || event.type === 'RED';
                const isInjury = event.type === 'INJURY';

                let bgClass = "bg-zinc-950/40 border-zinc-900";
                let textClass = "text-zinc-300";
                let badge = "ℹ️ Yorum";

                if (isGoal) {
                  bgClass = "bg-yellow-500/5 border-yellow-500/25 shadow-sm";
                  textClass = "text-yellow-400 font-bold";
                  badge = "⚽ GOL";
                } else if (isCard) {
                  bgClass = event.type === 'RED' ? "bg-red-550/10 border-red-500/25 shadow-sm" : "bg-amber-500/5 border-amber-500/20";
                  textClass = event.type === 'RED' ? "text-rose-450 font-bold" : "text-amber-400";
                  badge = event.type === 'RED' ? "🟥 KIRMIZI KART" : "🟨 SARI KART";
                } else if (isInjury) {
                  bgClass = "bg-rose-500/5 border-rose-500/20";
                  textClass = "text-rose-300 font-medium";
                  badge = "🩹 SAKATALIK DEĞİŞİKLİĞİ";
                }

                return (
                  <div key={idx} className={`p-3 rounded-2xl border text-xs font-mono transition-all hover:scale-[1.005] flex justify-between items-center gap-4 ${bgClass}`}>
                    <div className="flex gap-3 items-center min-w-0">
                      <span className="text-[#FF007A] font-black shrink-0">{event.minute}'</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-950 border border-zinc-850 font-extrabold uppercase shrink-0 leading-none">
                        {badge}
                      </span>
                      <p className={`truncate leading-relaxed ${textClass}`}>
                        <strong className="text-zinc-100">{event.playerName}</strong> {event.detail}
                      </p>
                    </div>
                    {event.type === 'GOAL' && (
                      <span className="text-lg animate-bounce leading-none shrink-0 select-none">🔥</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTabSub === 'FATIGUE' && (
            <div className="space-y-4">
              <div className="bg-zinc-900/40 p-4 rounded-3xl border border-zinc-900 text-xs font-mono text-zinc-400 leading-relaxed flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-emerald-450 shrink-0" />
                <p>
                  <strong className="text-zinc-200">Kondisyon Çöküş Teoris:</strong> 90 dakika boyunca her sprinting, tackling ve şut girişimi stamina kaybettirir. Stamina değeri %50'nin altına düşen oyuncuların efektif genel reytingleri (OVR) aşırı yorgunluktan dolayı %35'e kadar düşer; bu da pas hatası riskini artırır.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Home Fatigue */}
                <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4">
                  <h4 className="text-xs font-mono font-black text-[#FF007A] uppercase border-b border-zinc-850 pb-2">
                    {simulationResult.homeClub.name} Yorgunluk Tablosu
                  </h4>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {activeHomePlayers.map((p: any) => {
                      const staminaColor = p.currentStamina < 45 ? 'bg-red-500' : p.currentStamina < 70 ? 'bg-amber-500' : 'bg-green-500';
                      return (
                        <div key={p.id} className="text-xs font-mono space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-300 font-bold">{p.name} ({p.position})</span>
                            <span className="text-zinc-500">Kalan: <strong className="text-zinc-200">{Math.round(p.currentStamina)}%</strong> (Efektif OVR: <strong className="text-zinc-200">{p.tempRating}</strong>)</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850 flex">
                            <div className={`${staminaColor} transition-all duration-300`} style={{ width: `${p.currentStamina}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Away Fatigue */}
                <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4">
                  <h4 className="text-xs font-mono font-black text-cyan-400 uppercase border-b border-zinc-850 pb-2">
                    {simulationResult.awayClub.name} Yorgunluk Tablosu
                  </h4>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {activeAwayPlayers.map((p: any) => {
                      const staminaColor = p.currentStamina < 45 ? 'bg-red-500' : p.currentStamina < 70 ? 'bg-amber-500' : 'bg-green-500';
                      return (
                        <div key={p.id} className="text-xs font-mono space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-300 font-bold">{p.name} ({p.position})</span>
                            <span className="text-zinc-500">Kalan: <strong className="text-zinc-200">{Math.round(p.currentStamina)}%</strong> (Efektif OVR: <strong className="text-zinc-200">{p.tempRating}</strong>)</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850 flex">
                            <div className={`${staminaColor} transition-all duration-300`} style={{ width: `${p.currentStamina}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTabSub === 'ANALYSIS' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* GK reflexes */}
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4 font-mono text-xs">
                <h4 className="font-black text-[#FF007A] uppercase border-b border-zinc-850 pb-2">👐 KALECİ REAKSİYONU</h4>
                
                {simulationResult.players.filter((p: any) => p.position === 'GK').map((gk: any) => {
                  return (
                    <div key={gk.id} className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-850 space-y-3">
                      <div>
                        <span className="inline-block text-[10px] font-black text-violet-400 bg-violet-600/10 px-2 py-0.5 rounded uppercase leading-none mb-1">
                          {gk.teamSide === 'home' ? 'Home GK' : 'Away GK'}
                        </span>
                        <h5 className="font-bold text-zinc-100">{gk.name}</h5>
                        <p className="text-[10px] text-zinc-500">Reyting: {gk.rating} • Başlangıç Kondisyonu: 100%</p>
                      </div>

                      <div className="space-y-1.5 border-t border-zinc-850 pt-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Yapılan Kurtarışlar:</span>
                          <span className="font-bold text-zinc-100">{gk.savesInMatch}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Yenilen Goller:</span>
                          <span className="font-bold text-zinc-100">{gk.teamSide === 'home' ? simulationResult.awayScore : simulationResult.homeScore}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Mac Reytingi:</span>
                          <span className={`${gk.performanceScore >= 7.0 ? 'text-green-400' : gk.performanceScore < 6.0 ? 'text-red-400' : 'text-zinc-300'} font-bold`}>
                            {gk.performanceScore.toFixed(1)} / 10
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Referee strictness report */}
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4 font-mono text-xs">
                <h4 className="font-black text-amber-500 uppercase border-b border-zinc-850 pb-2">🟨 HAKEM VE DİSİPLİN RAPORU</h4>
                
                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-850 space-y-3.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500">Hakem Seviyesi / Sertlik:</span>
                    <span className="bg-amber-400/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-black">
                      STRICTNESS: {simulationResult.referee.strictness}/10
                    </span>
                  </div>

                  <div className="space-y-1.5 border-t border-zinc-850 pt-2 text-[11px]">
                    <div className="flex justify-between text-zinc-400">
                      <span>Toplam Fauller:</span>
                      <strong className="text-zinc-200">{simulationResult.stats.homeFouls + simulationResult.stats.awayFouls}</strong>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Sarı Kartlar:</span>
                      <strong className="text-zinc-200">{simulationResult.stats.homeYellows + simulationResult.stats.awayYellows} (🟨)</strong>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Kırmızı Kartlar:</span>
                      <strong className="text-rose-500 font-bold">{simulationResult.stats.homeReds + simulationResult.stats.awayReds} (🟥)</strong>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Sakatlık Adeti:</span>
                      <strong className="text-zinc-200">{simulationResult.stats.injuriesOccurred}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/10 border border-zinc-900 p-3 rounded-2xl text-[10px] leading-relaxed text-zinc-550">
                  ⚠️ <strong className="text-zinc-400">Disiplin Notu:</strong> Sert baskı uygulayan takımlarda yorulan defans oyuncuları, çalım yediğinde daha çok faul yapma eğilimindedir. Hakem kararlarını bu parametre belirler.
                </div>
              </div>

              {/* Match Top Performers */}
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4 font-mono text-xs">
                <h4 className="font-black text-cyan-400 uppercase border-b border-zinc-850 pb-2">⭐MAÇIN EN İYİLERİ</h4>
                
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {simulationResult.players
                    .slice()
                    .sort((a: any, b: any) => b.performanceScore - a.performanceScore)
                    .slice(0, 5)
                    .map((p: any, idx: number) => {
                      const color = p.teamSide === 'home' ? 'text-[#FF007A]' : 'text-cyan-400';
                      return (
                        <div key={idx} className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-850 flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-zinc-500">#{idx + 1} ⭐</span>
                            <h5 className="font-bold text-zinc-200 truncate">{p.name}</h5>
                            <p className="text-[9px] text-zinc-500">OVR {p.rating} • {p.position} • <span className={color}>{p.teamSide === 'home' ? 'HOME' : 'AWAY'}</span></p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-1 rounded font-black">
                              {p.performanceScore.toFixed(1)}
                            </span>
                            <p className="text-[8px] text-zinc-500 font-bold tracking-tighter mt-1">
                              {p.goalsInMatch > 0 ? `⚽${p.goalsInMatch}` : ''} {p.assistsInMatch > 0 ? `🅰️${p.assistsInMatch}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
