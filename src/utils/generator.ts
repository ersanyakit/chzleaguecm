import { Player, Club } from "../types";

// Pools of realistic first and last names for generating immersive squads
const FIRST_NAMES = [
  "Ersan", "Sezgin", "Alex", "Altug", "General", "Aytek", "Ersoy", "Sauza", "FanFan", "David",
  "Carlos", "Auxili", "Barcenz", "Baran", "Aytac", "Can", "Burak", "Aykut", "Kaplan", "Ahmet",
  "Sedat", "Emrah"
];

const LAST_NAMES = [
  "Yakıt", "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Öztürk", "Özdemir", "Aydın",
  "Erdoğan", "Aslan", "Yıldırım", "Kılıç", "Bulut", "Yalçın", "Arslan", "Doğan", "Koç", "Polat", "Acar", "Güneş"
];

function generateUuid(): string {
  return 'p_' + Math.random().toString(36).substr(2, 9);
}

export function generateRosterForTeam(teamId: string, teamName: string, reputation: number): Player[] {
  const players: Player[] = [];
  
  // Guard against undefined or NaN reputation
  const safeRep = typeof reputation === 'number' && !isNaN(reputation) ? reputation : 50;
  
  // High reputation teams (like Arsenal, Man City) get higher overall rating bounds
  // Low reputation teams (like Plymouth) get lower bounds
  const baseOvr = 64 + Math.round((safeRep / 100) * 16); // 64 to 80 range of base ratings
  
  // Positions distribution: 2 GK, 6 DEF, 6 MID, 4 ATT = 18 elements
  const positions: Array<'GK' | 'DEF' | 'MID' | 'ATT'> = [
    'GK', 'GK',
    'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
    'MID', 'MID', 'MID', 'MID', 'MID', 'MID',
    'ATT', 'ATT', 'ATT', 'ATT'
  ];

  // Map to store generated names to avoid duplicates within a team
  const usedNames = new Set<string>();

  positions.forEach((pos, idx) => {
    let name = "";
    do {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      name = `${first} ${last}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const age = Math.floor(Math.random() * 16) + 18; // 18 to 33 years old
    
    // Calculate randomized rating based on position indexing (stars vs bench)
    let ratingModifier = 0;
    if (idx === 0) ratingModifier = +4; // Star GK
    if (idx === 2 || idx === 3 || idx === 8 || idx === 9 || idx === 14) ratingModifier = +6; // Star key players
    if (idx === 1 || idx === 6 || idx === 7 || idx === 12 || idx === 13 || idx === 17) ratingModifier = -5; // Bench/Youth depth
    
    // Add small individual variance
    const variance = Math.floor(Math.random() * 5) - 2; // -2 to +2
    const rating = Math.max(55, Math.min(99, baseOvr + ratingModifier + variance));

    // Stats distribution based on position
    let pace = Math.max(40, Math.min(99, rating + (Math.floor(Math.random() * 20) - 10)));
    let shooting = Math.max(30, Math.min(99, rating + (Math.floor(Math.random() * 20) - 10)));
    let passing = Math.max(40, Math.min(99, rating + (Math.floor(Math.random() * 20) - 10)));
    let defending = Math.max(30, Math.min(99, rating + (Math.floor(Math.random() * 20) - 10)));
    let physical = Math.max(45, Math.min(99, rating + (Math.floor(Math.random() * 20) - 10)));
    let goalkeeping = 10;

    if (pos === 'GK') {
      goalkeeping = Math.max(60, Math.min(99, rating + 5));
      shooting = Math.max(10, Math.min(35, shooting - 40));
      defending = Math.max(15, Math.min(45, defending - 20));
      pace = Math.max(30, Math.min(65, pace - 15));
    } else if (pos === 'DEF') {
      defending = Math.round(rating * 1.1) + Math.floor(Math.random() * 5);
      shooting = Math.round(rating * 0.6) - Math.floor(Math.random() * 10);
      physical = Math.round(rating * 1.05) + Math.floor(Math.random() * 5);
    } else if (pos === 'MID') {
      passing = Math.round(rating * 1.1) + Math.floor(Math.random() * 5);
      pace = Math.round(rating * 0.95);
      defending = Math.round(rating * 0.82);
      shooting = Math.round(rating * 0.85);
    } else if (pos === 'ATT') {
      shooting = Math.round(rating * 1.15) + Math.floor(Math.random() * 5);
      pace = Math.round(rating * 1.1) + Math.floor(Math.random() * 5);
      defending = Math.round(rating * 0.4);
    }

    // Dynamic player valuations
    // Exponential value based on Overall Rating (similar to actual FIFA/FM curves)
    const multiplier = Math.pow(1.18, rating - 55);
    const baseValue = 400000;
    const ageFactor = age < 24 ? 1.4 : age > 30 ? 0.6 : 1.0;
    const value = Math.round((baseValue * multiplier * ageFactor) / 10000) * 10000;

    // Weekly wages based on rating and club hierarchy
    const wage = Math.round((value * 0.002 + Math.floor(Math.random() * 1500)) / 100) * 100;

    // Is starter selection
    // Top 11 players sorted are starting by default
    let isStarting = false;
    let pitchPosition = 0;

    players.push({
      id: generateUuid(),
      name,
      age,
      position: pos,
      rating,
      pace: Math.min(99, Math.max(20, pace)),
      shooting: Math.min(99, Math.max(10, shooting)),
      passing: Math.min(99, Math.max(20, passing)),
      defending: Math.min(99, Math.max(10, defending)),
      physical: Math.min(99, Math.max(20, physical)),
      goalkeeping: Math.min(99, Math.max(10, goalkeeping)),
      value: Math.max(50000, value),
      wage: Math.max(1000, wage),
      form: 6 + Math.floor(Math.random() * 3), // starts with form 6-8
      fitness: 100,
      morale: 80 + Math.floor(Math.random() * 20), // starts happy
      injuryWeeks: 0,
      goals: 0,
      assists: 0,
      appearances: 0,
      yellowCards: 0,
      redCards: 0,
      ratingHistory: [],
      avgRating: 0,
      isStarting,
      pitchPosition,
      isCaptain: false,
      isPenaltyTaker: false
    });
  });

  // Assign starting XI based on 4-4-2 default
  // Need: GK: 1, DEF: 4, MID: 4, ATT: 2
  const gks = players.filter(p => p.position === 'GK').sort((a,b) => b.rating - a.rating);
  const defs = players.filter(p => p.position === 'DEF').sort((a,b) => b.rating - a.rating);
  const mids = players.filter(p => p.position === 'MID').sort((a,b) => b.rating - a.rating);
  const atts = players.filter(p => p.position === 'ATT').sort((a,b) => b.rating - a.rating);

  let activeIndex = 0;
  
  // Starters assignment
  if (gks[0]) { gks[0].isStarting = true; gks[0].pitchPosition = 1; } // GK
  
  for (let i = 0; i < 4; i++) {
    if (defs[i]) { defs[i].isStarting = true; defs[i].pitchPosition = 2 + i; } // LB (2), LCB (3), RCB (4), RB (5)
  }
  for (let i = 0; i < 4; i++) {
    if (mids[i]) { mids[i].isStarting = true; mids[i].pitchPosition = 6 + i; } // LM (6), LCM (7), RCM (8), RM (9)
  }
  for (let i = 0; i < 2; i++) {
    if (atts[i]) { atts[i].isStarting = true; atts[i].pitchPosition = 10 + i; } // LS (10), RS (11)
  }

  // Choose captain (highest leadership/rating midfielder or defender)
  const outfieldStarters = players.filter(p => p.isStarting && p.position !== 'GK').sort((a,b) => b.rating - a.rating);
  if (outfieldStarters[0]) outfieldStarters[0].isCaptain = true;
  
  // Penalty taker (best shooting forward)
  const startersSortedByShoting = players.filter(p => p.isStarting).sort((a,b) => b.shooting - a.shooting);
  if (startersSortedByShoting[0]) startersSortedByShoting[0].isPenaltyTaker = true;

  return players;
}

export function generateLeagueSchedule(teams: Club[]): { fixtures: any[], totalWeeks: number } {
  let cleanTeams = [...teams];
  if (cleanTeams.length % 2 !== 0) {
    cleanTeams = cleanTeams.slice(0, -1);
  }
  const fixtures: any[] = [];
  const teamIds = cleanTeams.map(t => t.id);
  const numTeams = teamIds.length;
  
  if (numTeams < 2) {
    return { fixtures: [], totalWeeks: 0 };
  }
  
  // Round-robin scheduling algorithm (Berger tables / Circle method)
  const list = [...teamIds];
  const rounds = (numTeams - 1) * 2; // Home & Away
  const halfSize = numTeams / 2;
  
  let fixtureCounter = 1;
  const fixturesByWeek: any[] = [];

  for (let round = 0; round < rounds; round++) {
    const week = round + 1;
    const isAwayRound = round >= numTeams - 1;

    for (let i = 0; i < halfSize; i++) {
      const homeIdx = i;
      const awayIdx = numTeams - 1 - i;
      
      let home = list[homeIdx];
      let away = list[awayIdx];

      // Alternating home/away matches
      if (isAwayRound) {
        // swap home/away for the second leg
        const temp = home;
        home = away;
        away = temp;
      } else if (round % 2 === 1) {
        const temp = home;
        home = away;
        away = temp;
      }

      fixtures.push({
        id: `fix_w${week}_${home}_${away}`,
        week,
        homeTeamId: home,
        awayTeamId: away,
        played: false,
        scorers: [],
        events: []
      });
    }

    // Rotate elements (keeping first one fixed for round robin)
    list.splice(1, 0, list.pop()!);
  }

  return { fixtures, totalWeeks: rounds };
}
