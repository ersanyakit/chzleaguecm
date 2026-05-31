import React, { useState, useEffect } from 'react';
import { Club, Player, Fixture, LeagueStanding, Mail, Tactics, TrainingAllocation } from './types';
import { generateRosterForTeam, generateLeagueSchedule } from './utils/generator';
import SquadTab from './components/SquadTab';
import TacticsTab from './components/TacticsTab';
import StandingsTab from './components/StandingsTab';
import TransferTab from './components/TransferTab';
import InboxTab from './components/InboxTab';
import TrainingTab from './components/TrainingTab';
import MatchEngine from './components/MatchEngine';
import DebugTab from './components/DebugTab';
import { Trophy, Mail as MailIcon, Dumbbell, Shield, ArrowUpDown, Swords, Play, Sparkles, AlertCircle, RefreshCw, ShoppingBag, Landmark, Cpu, ArrowLeft } from 'lucide-react';

const STORAGE_KEY = 'CM_RETRO_GAME_STATE_v2';

type AppDialog = {
  title: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

const DEFAULT_TACTICS: Tactics = {
  formation: '4-4-2',
  mentality: 'BALANCED',
  style: 'TIKI_TAKA',
  tempo: 'NORMAL',
  passing: 'MIXED'
};

const getUnixSeed = () => Math.floor(Date.now() / 1000);

class AppSeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed || 1;
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
    return arr[Math.floor(this.next() * arr.length)];
  }
}

const hashSeed = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export default function App() {
  // Load existing session synchronously to prevent race conditions on mount
  const savedState = (() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log("Existing Championship Manager game state read from storage synchronously.");
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse saved game session on initial load:", e);
    }
    return null;
  })();

  // Game Setup States
  const [isLobby, setIsLobby] = useState(!savedState);
  const [selectedLeague, setSelectedLeague] = useState('English Championship');
  const [teams, setTeams] = useState<Club[]>(savedState?.teams || []);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [managedTeamId, setManagedTeamId] = useState<string>(savedState?.managedTeamId || '');

  // Core Simulation States
  const [week, setWeek] = useState(savedState?.week || 1);
  const [totalWeeks, setTotalWeeks] = useState(savedState?.totalWeeks || 46);
  const [squads, setSquads] = useState<Record<string, Player[]>>(savedState?.squads || {});
  const [fixtures, setFixtures] = useState<Fixture[]>(savedState?.fixtures || []);
  const [standings, setStandings] = useState<LeagueStanding[]>(savedState?.standings || []);
  const [inbox, setInbox] = useState<Mail[]>(savedState?.inbox || []);
  const [tactics, setTactics] = useState<Tactics>({
    ...DEFAULT_TACTICS,
    ...(savedState?.tactics || {})
  });
  const [trainingAllocation, setTrainingAllocation] = useState<TrainingAllocation>(savedState?.trainingAllocation || {
    fitness: 20,
    tactical: 20,
    defense: 20,
    attacking: 20,
    goalkeeping: 20
  });

  // Active UI Navigation Tab
  const [activeTab, setActiveTab] = useState<'SQUAD' | 'TACTICS' | 'STANDINGS' | 'TRANSFERS' | 'INBOX' | 'TRAINING' | 'DEBUG'>('INBOX');
  
  // Live Match Screen Controller
  const [activeMatchFixture, setActiveMatchFixture] = useState<Fixture | null>(null);
  const [appDialog, setAppDialog] = useState<AppDialog | null>(null);

  // General gossip news ticker
  const [gossipFeed, setGossipFeed] = useState<Array<{tag: string, title: string}>>([
    { tag: "DEDİKODU", title: "Leeds United transfer pazarına bomba gibi girmeye hazırlanıyor!" }
  ]);

  // Read logging purely for reassurance on mount
  useEffect(() => {
    if (savedState) {
      console.log("Existing Championship Manager game state synced successfully into React state.");
    }
  }, []);

  // Fetch real soccer teams from API proxy server (active check to protect loaded states from race condition)
  useEffect(() => {
    if (!isLobby) return;
    
    let active = true;
    const fetchTeams = async () => {
      setIsLoadingTeams(true);
      try {
        const res = await fetch(`/api/soccer/teams?league=${encodeURIComponent(selectedLeague)}`);
        const data = await res.json();
        
        if (active && data.success && data.teams) {
          // Format raw api objects into Club types
          let rawTeams = data.teams;
          if (rawTeams.length % 2 !== 0) {
            rawTeams = rawTeams.slice(0, -1); // Force even number of teams safely for pairing matches!
          }
          const clubsList: Club[] = rawTeams.map((team: any, idx: number) => {
            // Distribute budgets based on reputation (reputation scale from 10 to 90)
            const reputation = selectedLeague.includes('Premier') ? 80 - idx * 2 : 65 - idx * 1.5;
            const transferBudget = Math.round((Math.pow(1.1, reputation) * 120000) / 500000) * 500000;
            const wageBudget = Math.round(transferBudget * 0.015 / 5000) * 5000;
            
            let boardExpectation = "Kümede Kalma Mücadelesi";
            if (idx < 5) boardExpectation = "Zirve Yarışı / Şampiyonluk";
            else if (idx < 12) boardExpectation = "Play-off Hedefleri";
            else if (idx < 18) boardExpectation = "Orta Sıralarda İstikrar";

            return {
              id: team.idTeam || `club_${idx}`,
              name: team.strTeam,
              shortName: team.strTeamShort || team.strTeam.substring(0, 3).toUpperCase(),
              stadium: team.strStadium || "Retro Arena",
              badge: team.strBadge || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&q=80",
              founded: team.intFormedYear || "1905",
              reputation: Math.max(20, reputation),
              transferBudget: Math.max(1000000, transferBudget),
              wageBudget: Math.max(10000, wageBudget),
              weeklyWageExpense: 0,
              boardExpectation
            };
          });
          setTeams(clubsList);
        }
      } catch (err) {
        console.error("Failure fetching teams proxy:", err);
      } finally {
        setIsLoadingTeams(false);
      }
    };

    fetchTeams();
  }, [isLobby, selectedLeague]);

  // Fetch Gossip Portal Headlines dynamically
  useEffect(() => {
    if (isLobby || !managedTeamId) return;

    const fetchGossip = async () => {
      try {
        const teamObj = teams.find(t=>t.id === managedTeamId);
        const res = await fetch("/api/gemini/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            teamName: teamObj?.name || "Leeds", 
            leagueTrend: `Week ${week} overview. Active standings.` 
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.headlines && data.headlines.length > 0) {
            setGossipFeed(data.headlines);
          }
        }
      } catch (err) {
        console.warn("Gossip ticker simulation fetch failed.");
      }
    };
    
    fetchGossip();
  }, [week, isLobby, managedTeamId]);

  const [matchSeedSeed, setMatchSeedSeed] = useState<number>(savedState?.matchSeedSeed || getUnixSeed());

  const showNotice = (title: string, message: string, variant: AppDialog['variant'] = 'info') => {
    setAppDialog({ title, message, variant, confirmLabel: 'Tamam' });
  };

  const requestConfirmation = (dialog: AppDialog & { onConfirm: () => void }) => {
    setAppDialog({
      cancelLabel: 'Vazgeç',
      confirmLabel: 'Onayla',
      variant: 'warning',
      ...dialog
    });
  };

  const renderAppDialog = () => {
    if (!appDialog) return null;

    const variantClass = appDialog.variant === 'danger'
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      : appDialog.variant === 'success'
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        : appDialog.variant === 'warning'
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : 'text-[#FF007A] bg-[#FF007A]/10 border-[#FF007A]/30';

    return (
      <div className="fixed inset-0 z-[300] bg-[#07080A]/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[28px] shadow-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${variantClass}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-zinc-100 tracking-wide">{appDialog.title}</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-1 whitespace-pre-line">{appDialog.message}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
            {appDialog.onConfirm && (
              <button
                type="button"
                onClick={() => setAppDialog(null)}
                className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-black transition-colors"
              >
                {appDialog.cancelLabel || 'Vazgeç'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const onConfirm = appDialog.onConfirm;
                setAppDialog(null);
                onConfirm?.();
              }}
              className={`px-4 py-2 rounded-xl text-white text-xs font-black transition-all shadow-lg ${
                appDialog.variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/10'
                  : 'bg-[#FF007A] hover:bg-[#ff1a8c] shadow-[#FF007A]/15'
              }`}
            >
              {appDialog.confirmLabel || 'Tamam'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Handle Game Initialization
  const handleStartGame = (chosenTeamId: string) => {
    const chosenClub = teams.find(t => t.id === chosenTeamId);
    if (!chosenClub) return;

    setManagedTeamId(chosenTeamId);
    
    // 1. Generate deep squads rosters for ALL clubs in league
    const teamSquads: Record<string, Player[]> = {};
    teams.forEach(club => {
      teamSquads[club.id] = generateRosterForTeam(club.id, club.name, club.reputation);
    });

    // 2. Generate fixture matches schedule (Berger method)
    const { fixtures: generatedFixt, totalWeeks: totWk } = generateLeagueSchedule(teams);
    
    // 3. Setup initial league table standings
    const initialStandings: LeagueStanding[] = teams.map(club => ({
      teamId: club.id,
      teamName: club.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0
    }));

    // 4. Draft welcome inbox mails
    const welcomeInbox: Mail[] = [
      {
        id: "welcome_board",
        sender: "Kulüp Yönetim Kurulu",
        subject: "Yeni Menajerimize Görkemli Hoş Geldin!",
        content: `Sayın Menajer,\n\n${chosenClub.name} kulübünün geleceğini ellerinize emanet etmekten gurur duyuyoruz. Bu sezon yönetim olarak sizden temel beklentimiz: ${chosenClub.boardExpectation}.\n\nSize sunulan Transfer Bütçesi: ${formatMoney(chosenClub.transferBudget)}. Maaş limitleri dahilinde akıllıca hamleler yapmanızı ve taraftarımızın gönlünü kazanmanızı diliyoruz.\n\nBol şans dileriz,\nYönetim Başkanlığı`,
        weekReceived: 1,
        read: false,
        type: "BOARD"
      },
      {
        id: "scout_intro",
        sender: "Scout Şefi",
        subject: "Geniş Oyuncu Gözlem Raporu Hazır",
        content: `Merhaba Şef,\n\nKadromuzu genişletmek amacıyla transfer pazarına göz attım ve pazar payı yüksek heyecan verici birkaç adayı işaretledim. 'Transfer' sekmesine giderek bütçemize uygun teklifleri değerlendirebilir, fazlalıkları elden çıkarabilirsiniz. Başarılar!\n\nSaygılarımla,\nBaş Gözlemci`,
        weekReceived: 1,
        read: false,
        type: "SCOUT"
      }
    ];

    setSquads(teamSquads);
    setFixtures(generatedFixt);
    setStandings(initialStandings);
    setInbox(welcomeInbox);
    setTotalWeeks(totWk);
    setWeek(1);
    setIsLobby(false);

    // Save initial load state
    const newState = {
      teams,
      managedTeamId: chosenTeamId,
      week: 1,
      totalWeeks: totWk,
      squads: teamSquads,
      fixtures: generatedFixt,
      standings: initialStandings,
      inbox: welcomeInbox,
      tactics: DEFAULT_TACTICS,
      matchSeedSeed,
      trainingAllocation: {
        fitness: 20,
        tactical: 20,
        defense: 20,
        attacking: 20,
        goalkeeping: 20
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  // Save changes to storage utility
  const saveStateToStorage = (updates: Partial<any>) => {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      const data = current ? JSON.parse(current) : {};
      const merged = { ...data, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch(err) {
      console.error("Local storage sync error:", err);
    }
  };

  // Auto Reset state
  const handleResetSave = () => {
    requestConfirmation({
      title: 'Sezonu Sıfırla',
      message: 'Bu sezondaki tüm ilerlemeniz sıfırlanacaktır. Bu işlem kayıtlı sezonu kaldırır.',
      variant: 'danger',
      confirmLabel: 'Sezonu Sıfırla',
      onConfirm: () => {
      localStorage.removeItem(STORAGE_KEY);
      setIsLobby(true);
      setManagedTeamId('');
      setWeek(1);
      }
    });
  };

  const handleUpdateSquad = (updated: Player[]) => {
    const nextSquads = { ...squads, [managedTeamId]: updated };
    setSquads(nextSquads);
    saveStateToStorage({ squads: nextSquads });
  };

  const handleUpdateTactics = (updated: Tactics) => {
    setTactics(updated);
    saveStateToStorage({ tactics: updated });
  };

  const handleUpdateAllocation = (updated: TrainingAllocation) => {
    // Total allocation must sum to 100%
    setTrainingAllocation(updated);
    saveStateToStorage({ trainingAllocation: updated });
  };

  const handleMatchSeedChange = (seed: number) => {
    setMatchSeedSeed(seed);
    saveStateToStorage({ matchSeedSeed: seed });
  };

  // Purchasing transfers
  const handleBuyPlayer = (player: Player) => {
    const updatedUserSquad = [...squads[managedTeamId], player];
    const userClubIndex = teams.findIndex(t => t.id === managedTeamId);
    
    if (userClubIndex !== -1) {
      const nextTeams = [...teams];
      nextTeams[userClubIndex].transferBudget -= player.value;
      setTeams(nextTeams);
      
      const nextSquads = { ...squads, [managedTeamId]: updatedUserSquad };
      setSquads(nextSquads);
      
      saveStateToStorage({ teams: nextTeams, squads: nextSquads });
    }
  };

  // Selling redundant players
  const handleSellPlayer = (player: Player) => {
    const updatedUserSquad = squads[managedTeamId].filter(p => p.id !== player.id);
    const userClubIndex = teams.findIndex(t => t.id === managedTeamId);

    if (userClubIndex !== -1) {
      const nextTeams = [...teams];
      nextTeams[userClubIndex].transferBudget += player.value;
      setTeams(nextTeams);
      
      const nextSquads = { ...squads, [managedTeamId]: updatedUserSquad };
      setSquads(nextSquads);
      
      saveStateToStorage({ teams: nextTeams, squads: nextSquads });
    }
  };

  // Sub fixture action generator (speed auto simulate on other non-user games)
  const simulateAiMatch = (homeId: string, awayId: string): { homeScore: number; awayScore: number; scorers: string[] } => {
    const rng = new AppSeededRandom(matchSeedSeed + week * 1009 + hashSeed(`${homeId}:${awayId}`));
    const homeSquadList = squads[homeId] || [];
    const awaySquadList = squads[awayId] || [];
    const homeClubOvr = homeSquadList.length > 0 ? Math.round(homeSquadList.reduce((acc, p) => acc + (p.rating || 65), 0) / homeSquadList.length) : 70;
    const awayClubOvr = awaySquadList.length > 0 ? Math.round(awaySquadList.reduce((acc, p) => acc + (p.rating || 65), 0) / awaySquadList.length) : 70;

    const homeStrength = homeClubOvr + 4; // home advantage
    const awayStrength = awayClubOvr;

    let homeScore = 0;
    let awayScore = 0;

    const diff = homeStrength - awayStrength; // -20 to +20 range
    
    // Simple Gaussian-style scores projection
    const goalProb = rng.next();
    if (goalProb < 0.2) {
      homeScore = Math.floor(rng.range(0, 2));
      awayScore = Math.floor(rng.range(0, 2));
    } else if (goalProb < 0.6) {
      homeScore = Math.floor(rng.range(0, 3)) + (diff > 5 ? 1 : 0);
      awayScore = Math.floor(rng.range(0, 2)) + (diff < -5 ? 1 : 0);
    } else {
      homeScore = Math.floor(rng.range(0, 4)) + (diff > 8 ? 2 : 0);
      awayScore = Math.floor(rng.range(0, 3)) + (diff < -8 ? 2 : 0);
    }

    // Map randomized scorer rosters
    const homeSqr = squads[homeId] || [];
    const awaySqr = squads[awayId] || [];
    const scorers: string[] = [];

    for (let i = 0; i < homeScore; i++) {
      const player = homeSqr[Math.floor(rng.range(0, homeSqr.length))];
      if (player) scorers.push(`${Math.floor(rng.range(1, 89))}'. ${player.name}`);
    }
    for (let i = 0; i < awayScore; i++) {
      const player = awaySqr[Math.floor(rng.range(0, awaySqr.length))];
      if (player) scorers.push(`${Math.floor(rng.range(1, 89))}'. ${player.name}`);
    }

    return { homeScore, awayScore, scorers };
  };

  // Launching the active match simulation
  const handleLaunchMatch = () => {
    // Find our current week matching fixture (using numeric coercion for safely finding matchday)
    const currentWeekFixt = fixtures.filter(f => Number(f.week) === Number(week));
    let userMatch = currentWeekFixt.find(f => String(f.homeTeamId) === String(managedTeamId) || String(f.awayTeamId) === String(managedTeamId));
    
    // Self-healing: Look if this team has any fixtures at all in the database, or if fixtures are empty or misaligned
    if (!userMatch && teams.length > 0) {
      const isSeasonCompleted = Number(week) > Number(totalWeeks);
      if (isSeasonCompleted) {
        showNotice(
          'Sezon Tamamlandı',
          'Tebrikler Sayın Menajer. Harika bir sezonu geride bıraktınız. Lig tablosundaki performansınız tescillendi.\n\nKulüp yönetim kurulu ve taraftarlar yeni sezon heyecanını hissederken mevcut bütçeniz ve kadro yapınız korunarak yeni sezon fikstürü hazırlanıyor.',
          'success'
        );
      } else {
        console.warn("Self-healing: No active fixture found for managed team. Healing schedule mismatch...");
      }

      const { fixtures: generatedFixt, totalWeeks: totWk } = generateLeagueSchedule(teams);
      
      // Populate missing rosters for any teams that don't have them
      const nextSquads = { ...squads };
      teams.forEach(club => {
        if (!nextSquads[club.id] || nextSquads[club.id].length === 0) {
          nextSquads[club.id] = generateRosterForTeam(club.id, club.name, club.reputation);
        }
      });

      // Reset standings for the new season
      const freshStandings: LeagueStanding[] = teams.map(club => ({
        teamId: club.id,
        teamName: club.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      }));

      setFixtures(generatedFixt);
      setTotalWeeks(totWk);
      setWeek(1);
      setSquads(nextSquads);
      setStandings(freshStandings);
      
      const welcomeInbox: Mail[] = [
        {
          id: `sys_schedule_regen_${Date.now()}`,
          sender: "Lig Federasyonu Başkanlığı",
          subject: isSeasonCompleted ? "Yeni Sezon Fikstürü ve Tebrikler!" : "Fikstür Düzenlemesi ve Güncelleme",
          content: isSeasonCompleted 
            ? "Sayın Menajer,\n\nYeni futbol sezonu fikstür çekimi tamamlanmıştır. İlk 11 kalitenizi koruyarak ve yeni antrenman programlarıyla transfer hamlelerinizi güçlendirerek yeni kupalar kazanmanızı dileriz!\n\nSaygılarımızla,\nFederasyon Yönetim Kurulu"
            : "Sayın Menajer,\n\nLig yapısındaki takım id güncellemeleri veya lig uyumsuzlukları nedeniyle kulübünüz için fikstür tablosu Federasyon tarafından yenilenmiştir. Yeni maç haftası takviminiz 1. haftadan itibaren aktif hale getirilmiştir.\n\nBaşarılar dileriz.",
          weekReceived: 1,
          read: false,
          type: "BOARD"
        },
        ...inbox
      ];
      setInbox(welcomeInbox);

      saveStateToStorage({ 
        fixtures: generatedFixt, 
        totalWeeks: totWk, 
        week: 1,
        squads: nextSquads,
        standings: freshStandings,
        inbox: welcomeInbox
      });
      
      // Retry match acquisition on week 1
      const retriedWeekFixt = generatedFixt.filter(f => Number(f.week) === 1);
      userMatch = retriedWeekFixt.find(f => String(f.homeTeamId) === String(managedTeamId) || String(f.awayTeamId) === String(managedTeamId));
    }

    if (!userMatch) {
      showNotice('Fikstür Bulunamadı', "Bu hafta için aktif bir fikstür eşleşmeniz bulunmuyor. Sonraki tura ilerleyin veya 'Taktikler' / 'Kadro' düzenleyerek devam edin.", 'warning');
      return;
    }

    if (userMatch.played) {
      showNotice('Maç Zaten Tamamlandı', "Bu haftaki maçınızı zaten tamamladınız. Yeni haftaya ilerlemek için 'Gelen Kutusu' veya yönetim panellerini takip edin.", 'info');
      return;
    }

    const hClub = teams.find(t => String(t.id) === String(userMatch.homeTeamId)) || teams[0] || { id: userMatch.homeTeamId, name: "Ev Sahibi", badge: "", stadium: "Stadyum", reputation: 50 };
    const aClub = teams.find(t => String(t.id) === String(userMatch.awayTeamId)) || teams[1] || { id: userMatch.awayTeamId, name: "Deplasman", badge: "", stadium: "Stadyum", reputation: 50 };
    
    // Defensive check: is the user squad empty? Auto-regenerate if true to prevent crashes
    let userSquadRoster = squads[managedTeamId] || [];
    if (userSquadRoster.length === 0) {
      const chosenClub = teams.find(t => String(t.id) === String(managedTeamId)) || hClub || aClub;
      if (chosenClub) {
        userSquadRoster = generateRosterForTeam(managedTeamId, chosenClub.name, chosenClub.reputation);
        squads[managedTeamId] = userSquadRoster;
        setSquads(prev => ({
          ...prev,
          [managedTeamId]: userSquadRoster
        }));
      }
    }

    const activeStartersCount = userSquadRoster.filter(p => p.isStarting).length;
    const injuredStartersCount = userSquadRoster.filter(p => p.isStarting && p.injuryWeeks > 0).length;

    // Automatically arrange starting 11 if not exactly 11, or if there's any injured starter!
    if (activeStartersCount !== 11 || injuredStartersCount > 0) {
      // Sort players: healthy first, then by rating
      const sortedPlayers = [...userSquadRoster].sort((a, b) => {
        const aInjured = a.injuryWeeks > 0;
        const bInjured = b.injuryWeeks > 0;
        if (aInjured !== bInjured) return aInjured ? 1 : -1;
        return b.rating - a.rating;
      });

      // Determine formation counts
      let numDEF = 4;
      let numMID = 4;
      let numATT = 2;
      const form = tactics.formation;
      if (form === '4-3-3') {
        numDEF = 4; numMID = 3; numATT = 3;
      } else if (form === '3-5-2') {
        numDEF = 3; numMID = 5; numATT = 2;
      } else if (form === '4-2-3-1') {
        numDEF = 4; numMID = 5; numATT = 1;
      } else if (form === '5-3-2') {
        numDEF = 5; numMID = 3; numATT = 2;
      }

      const autoStarters: Player[] = [];
      const selectedIds = new Set<string>();

      // 1. Selector for Goalkeeper
      const gks = sortedPlayers.filter(p => p.position === 'GK' && p.injuryWeeks === 0);
      if (gks.length > 0) {
        autoStarters.push(gks[0]);
        selectedIds.add(gks[0].id);
      }

      // 2. Defenders
      const defs = sortedPlayers.filter(p => p.position === 'DEF' && p.injuryWeeks === 0 && !selectedIds.has(p.id));
      const neededDEF = numDEF;
      const defToPush = defs.slice(0, neededDEF);
      autoStarters.push(...defToPush);
      defToPush.forEach(p => selectedIds.add(p.id));

      // 3. Midfielders
      const mids = sortedPlayers.filter(p => p.position === 'MID' && p.injuryWeeks === 0 && !selectedIds.has(p.id));
      const neededMID = numMID;
      const midToPush = mids.slice(0, neededMID);
      autoStarters.push(...midToPush);
      midToPush.forEach(p => selectedIds.add(p.id));

      // 4. Attackers
      const atts = sortedPlayers.filter(p => p.position === 'ATT' && p.injuryWeeks === 0 && !selectedIds.has(p.id));
      const neededATT = numATT;
      const attToPush = atts.slice(0, neededATT);
      autoStarters.push(...attToPush);
      attToPush.forEach(p => selectedIds.add(p.id));

      // Fill remaining players up to 11 if positions were not satisfied or list is incomplete
      const remainingAvailable = sortedPlayers.filter(p => p.injuryWeeks === 0 && !selectedIds.has(p.id));
      while (autoStarters.length < 11 && remainingAvailable.length > 0) {
        const p = remainingAvailable.shift()!;
        autoStarters.push(p);
        selectedIds.add(p.id);
      }

      // Fill with injured as a last resort
      if (autoStarters.length < 11) {
        const remainingInjured = sortedPlayers.filter(p => !selectedIds.has(p.id));
        while (autoStarters.length < 11 && remainingInjured.length > 0) {
          const p = remainingInjured.shift()!;
          autoStarters.push(p);
          selectedIds.add(p.id);
        }
      }

      const startersIds = new Set(autoStarters.slice(0, 11).map(p => p.id));
      const updatedRoster = userSquadRoster.map((player) => {
        const starts = startersIds.has(player.id);
        return {
          ...player,
          isStarting: starts,
          pitchPosition: starts ? Array.from(startersIds).indexOf(player.id) + 1 : 0
        };
      });

      // Update squad state in place
      setSquads(prev => ({
        ...prev,
        [managedTeamId]: updatedRoster
      }));

      const explanation = activeStartersCount !== 11
        ? `Kadronuzda tam 11 oyuncu seçilmemişti (${activeStartersCount}/11 oyuncu seçili).`
        : `Kadronuzda sakat durumunda ilk 11 oyuncusu bulunuyordu (${injuredStartersCount} sakat oyuncu).`;

      showNotice('İlk 11 Otomatik Düzenlendi', `${explanation}\n\nEn yüksek güce sahip ve sağlıklı oyuncularınız otomatik olarak ilk 11'e yerleştirildi ve maça geçiliyor.`, 'info');
    }

    setActiveMatchFixture(userMatch);
  };

  // Wrap up week matchday
  const handleMatchSimulationFinished = (result: {
    homeScore: number;
    awayScore: number;
    scorers: string[];
    events: any[];
    stats: any;
  }) => {
    const weekRng = new AppSeededRandom(matchSeedSeed + week * 4099 + hashSeed(managedTeamId));

    // 1. Record completed scoreboard in our fixtures array
    const weekFix = fixtures.filter(f => Number(f.week) === Number(week));
    const userFixIndex = fixtures.findIndex(f => Number(f.week) === Number(week) && (String(f.homeTeamId) === String(managedTeamId) || String(f.awayTeamId) === String(managedTeamId)));
    
    if (userFixIndex !== -1) {
      const updatedFixtObj = {
        ...fixtures[userFixIndex],
        played: true,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        scorers: result.scorers,
        events: result.events,
        stats: result.stats
      };
      
      const nextFixt = [...fixtures];
      nextFixt[userFixIndex] = updatedFixtObj;

      // 2. Automate Simulating all other AI fixtures of this week
      nextFixt.forEach((f, idx) => {
        if (Number(f.week) === Number(week) && !f.played) {
          const aiResult = simulateAiMatch(f.homeTeamId, f.awayTeamId);
          f.played = true;
          f.homeScore = aiResult.homeScore;
          f.awayScore = aiResult.awayScore;
          f.scorers = aiResult.scorers;
        }
      });

      // 3. Recalculate Points Standings
      const nextStandings = teams.map(club => {
        const stats = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
        
        nextFixt.forEach(f => {
          if (!f.played) return;
          
          if (String(f.homeTeamId) === String(club.id)) {
            stats.played += 1;
            stats.goalsFor += f.homeScore!;
            stats.goalsAgainst += f.awayScore!;
            
            if (f.homeScore! > f.awayScore!) {
              stats.won += 1;
              stats.points += 3;
            } else if (f.homeScore! === f.awayScore!) {
              stats.drawn += 1;
              stats.points += 1;
            } else {
              stats.lost += 1;
            }
          } else if (String(f.awayTeamId) === String(club.id)) {
            stats.played += 1;
            stats.goalsFor += f.awayScore!;
            stats.goalsAgainst += f.homeScore!;
            
            if (f.awayScore! > f.homeScore!) {
              stats.won += 1;
              stats.points += 3;
            } else if (f.awayScore! === f.homeScore!) {
              stats.drawn += 1;
              stats.points += 1;
            } else {
              stats.lost += 1;
            }
          }
        });

        stats.goalDifference = stats.goalsFor - stats.goalsAgainst;

        return {
          teamId: club.id,
          teamName: club.name,
          ...stats
        };
      }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);

      // 4. Update managed player stats (goals, assists, physical recovery / fatigue, injuries)
      const nextSquads = { ...squads };
      const weekFixturesWithPoints = nextFixt.filter(f => f.week === week);
      
      Object.keys(nextSquads).forEach(scId => {
        const squadRoster = nextSquads[scId];
        const teamFix = weekFixturesWithPoints.find(f => f.homeTeamId === scId || f.awayTeamId === scId);
        
        if (teamFix) {
          const isHome = teamFix.homeTeamId === scId;
          const userTeamScore = isHome ? teamFix.homeScore! : teamFix.awayScore!;
          const opponentScore = isHome ? teamFix.awayScore! : teamFix.homeScore!;

          squadRoster.forEach(player => {
            if (player.isStarting) {
              player.appearances += 1;
              
              // Stamina costs per match
              player.fitness = Math.max(40, player.fitness - 15 - Math.floor(weekRng.range(0, 10)));

              // Goal Scoring mapped to scorers array matching names
              const matchingScorer = teamFix.scorers?.find(s => s.includes(player.name.split(' ')[1] || player.name));
              if (matchingScorer) {
                player.goals += 1;
              }
              
              // Small rate of match evaluation updates
              const performance = 6 + Math.floor(weekRng.range(0, 4)) - (opponentScore > userTeamScore ? 1 : 0);
              player.avgRating = player.appearances === 1 
                ? performance 
                : (player.avgRating * (player.appearances - 1) + performance) / player.appearances;
            } else {
              // Non players recover stamina
              player.fitness = Math.min(100, player.fitness + 15);
            }

            // Injury cooling down weeks decrement
            if (player.injuryWeeks > 0) {
              player.injuryWeeks -= 1;
            }
          });
        }
      });

      // 5. Training progression triggers
      Object.keys(nextSquads).forEach(scId => {
        const squadRoster = nextSquads[scId];
        squadRoster.forEach(player => {
          // Increase OVR depending on training balances
          const randomDevelopment = weekRng.next();
          if (randomDevelopment < 0.2) {
            player.rating = Math.min(99, player.rating + 1);
            if (player.position === 'ATT') player.shooting = Math.min(99, player.shooting + 1);
            if (player.position === 'DEF') player.defending = Math.min(99, player.defending + 1);
            if (player.position === 'MID') player.passing = Math.min(99, player.passing + 1);
          }
        });
      });

      // 6. Medical / Gossip Inbox Mails Generation based on Match results
      const userMatchResult = weekFixturesWithPoints.find(f => f.homeTeamId === managedTeamId || f.awayTeamId === managedTeamId);
      const isHome = userMatchResult?.homeTeamId === managedTeamId;
      const userScore = isHome ? userMatchResult?.homeScore! : userMatchResult?.awayScore!;
      const oppScore = isHome ? userMatchResult?.awayScore! : userMatchResult?.homeScore!;
      const isWin = userScore > oppScore;

      let matchBriefSubject = isWin ? "İstisnai Galibiyet Tebriği" : userScore === oppScore ? "Beraberlik Sonrası Değerlendirme" : "Beklenmedik Mağlubiyet Analizi";
      let matchBriefContent = isWin 
        ? "Son maçta gösterdiğimiz üst düzey taktik disiplin ve hücum pres gücü yönetim kurulunca takdirle karşılandı. İlk 11 kalitemizi korumak sonraki haftalardaki momentumumuz için kilit öneme sahip!"
        : userScore === oppScore ? "Zorlu bir mücadeleden beraberlikle ayrıldık. Sahadaki pas uyumu ve direnç fena değildi fakat hücum hattında bitiricilik konusunda birkaç özel çalışma yapmamız gerekebilir." 
        : "Maalesef sahadan mağlubiyetle ayrıldık. Yönetim kurulu maçtaki konsantrasyon kaybından rahatsız. Önümüzdeki antrenmanlarda savunma hattımızın uyum yeteneklerini geliştirerek açıkları kapatalım.";

      const matchReportMail: Mail = {
        id: `m_rep_w${week}_${Math.floor(weekRng.range(0, 1_000_000_000)).toString(36)}`,
        sender: "Teknik Heyet Şefi",
        subject: matchBriefSubject,
        content: matchBriefContent,
        weekReceived: week,
        read: false,
        type: "NEWS"
      };

      // Set state transitions
      setFixtures(nextFixt);
      setStandings(nextStandings);
      setSquads(nextSquads);
      
      const updatedInbox = [matchReportMail, ...inbox];
      setInbox(updatedInbox);

      setActiveMatchFixture(null);
      setWeek(prev => prev + 1);

      // Persist state updates
      const updatedState = {
        teams,
        squads: nextSquads,
        fixtures: nextFixt,
        standings: nextStandings,
        inbox: updatedInbox,
        week: week + 1,
        totalWeeks,
        matchSeedSeed
      };
      saveStateToStorage(updatedState);
      
      showNotice('Hafta Tamamlandı', 'Hafta maçları tamamlandı. Puan tablosu, oyuncu stamina değerleri ve email gelen kutusu güncellendi.', 'success');
    }
  };

  const handleReadMail = (mailId: string) => {
    const updated = inbox.map(m => {
      if (m.id === mailId) return { ...m, read: true };
      return m;
    });
    setInbox(updated);
    saveStateToStorage({ inbox: updated });
  };

  const handleDeleteMail = (mailId: string) => {
    const updated = inbox.filter(m => m.id !== mailId);
    setInbox(updated);
    saveStateToStorage({ inbox: updated });
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  // -------------------------------------------------------------
  // RENDER LOBBY CHOICE SCREEN
  if (isLobby) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 relative font-sans">
        {renderAppDialog()}
        {/* Glow ambient decorations */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[340px] h-[340px] bg-[#FF007A]/15 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-2xl w-full text-center space-y-8 z-10">
          <div className="space-y-3.5 select-none">
            <span className="p-1 px-3 bg-gradient-to-r from-violet-600/20 to-[#FF007A]/20 text-[#FF007A] font-mono text-[10px] font-bold uppercase tracking-widest border border-[#FF007A]/30 rounded-full">
              Championship Manager: Retro Edition
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-100 to-zinc-400">
              Retro Football Manager
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-mono">
              TheSportsDB Real data ve Gemini AI destekli, Uniswap kalitesinde premium menajerlik tecrübesi.
            </p>
          </div>

          {/* Configuration Card */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-6 rounded-3xl shadow-3xl text-left space-y-6">
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-mono font-bold uppercase tracking-wider">Lig Seçimi</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-2xl border border-zinc-850 text-xs font-mono">
                <button
                  type="button" 
                  onClick={() => setSelectedLeague('English Championship')}
                  className={`py-2 rounded-xl font-bold transition-all ${selectedLeague.includes('Championship') ? 'bg-[#FF007A] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
                >
                  Championship (2. Lig)
                </button>
                <button
                  type="button" 
                  onClick={() => setSelectedLeague('English Premier League')}
                  className={`py-2 rounded-xl font-bold transition-all ${selectedLeague.includes('Premier') ? 'bg-[#FF007A] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
                >
                  Premier League (1. Lig)
                </button>
              </div>
            </div>

            {/* Choose the team selection */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-mono font-bold uppercase tracking-wider">Kulüp Seçin</label>
              {isLoadingTeams ? (
                <div className="flex justify-center items-center py-8">
                  <RefreshCw className="w-6 h-6 text-[#FF007A] animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {teams.map((club) => (
                    <div
                      key={club.id}
                      onClick={() => handleStartGame(club.id)}
                      className="p-3 bg-zinc-950 hover:bg-[#FF007A]/5 border border-zinc-850 hover:border-[#FF007A]/50 rounded-2xl cursor-pointer transition-all flex items-center gap-2.5 group"
                    >
                      <img 
                        src={club.badge} 
                        alt={club.name} 
                        className="w-8 h-8 object-contain shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="truncate shrink-1">
                        <p className="text-xs font-bold text-zinc-200 truncate group-hover:text-[#FF007A] transition-colors">{club.name}</p>
                        <p className="text-[9px] font-mono text-zinc-500 leading-none mt-0.5">OVR {club.reputation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ACTIVE MATCH DAY OVERLAY INTERFACE
  if (activeMatchFixture) {
    const hClub = teams.find(t => t.id === activeMatchFixture.homeTeamId) || teams[0] || { id: activeMatchFixture.homeTeamId, name: "Ev Sahibi", badge: "", shortName: "HOME", stadium: "Stadyum", reputation: 50 };
    const aClub = teams.find(t => t.id === activeMatchFixture.awayTeamId) || teams[1] || { id: activeMatchFixture.awayTeamId, name: "Deplasman", badge: "", shortName: "AWAY", stadium: "Stadyum", reputation: 50 };

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans relative">
        {renderAppDialog()}
        <header className="sticky top-0 z-[120] border-b border-zinc-800 bg-zinc-950/96 backdrop-blur-xl shadow-lg shadow-black/20">
          <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveMatchFixture(null)}
              className="h-9 w-9 sm:w-auto sm:px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
              aria-label="Ana ekrana dön"
              title="Ana ekrana dön"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-black uppercase tracking-wider">Geri</span>
            </button>

            <div className="min-w-0 flex-1 flex flex-col items-center justify-center leading-none">
              <span className="text-[11px] sm:text-sm font-black text-zinc-100 uppercase tracking-wider">Maç Günü</span>
              <span className="mt-1 text-[9px] font-mono font-bold text-zinc-500 truncate max-w-full">
                {hClub.shortName || hClub.name} vs {aClub.shortName || aClub.name}
              </span>
            </div>

            <div className="hidden sm:flex items-center justify-center px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-black text-zinc-400 shrink-0">
              Hafta {week}
            </div>
          </div>
        </header>
        <main className="max-w-5xl w-full mx-auto p-1.5 sm:p-4">
          <MatchEngine
            homeClub={hClub}
            awayClub={aClub}
            homeSquad={squads[activeMatchFixture.homeTeamId] && squads[activeMatchFixture.homeTeamId].length > 0 ? squads[activeMatchFixture.homeTeamId] : generateRosterForTeam(activeMatchFixture.homeTeamId, hClub.name, hClub.reputation)}
            awaySquad={squads[activeMatchFixture.awayTeamId] && squads[activeMatchFixture.awayTeamId].length > 0 ? squads[activeMatchFixture.awayTeamId] : generateRosterForTeam(activeMatchFixture.awayTeamId, aClub.name, aClub.reputation)}
            userTactics={tactics}
            isUserHome={activeMatchFixture.homeTeamId === managedTeamId}
            initialSeed={matchSeedSeed}
            onMatchFinished={handleMatchSimulationFinished}
            onNotify={showNotice}
          />
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEFENSIVE LOADING CHECK FOR IN-PROGRESS OR LOADED GAMES
  if (!isLobby && (teams.length === 0 || !managedTeamId)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center font-sans">
        {renderAppDialog()}
        <RefreshCw className="w-8 h-8 text-[#FF007A] animate-spin mb-4" />
        <p className="text-sm font-mono text-zinc-400">Veritabanı yükleniyor, lütfen bekleyin...</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN OFFICE DASHBOARD INTERFACE
  const userClub = teams.find(t => t.id === managedTeamId) || teams[0] || { id: "temp", name: "Menajersiz", badge: "", stadium: "Arena", founded: "1905", reputation: 50, transferBudget: 1000000, wageBudget: 10000, weeklyWageExpense: 0, boardExpectation: "Hedef Yok" };
  const userSquad = squads[managedTeamId] || [];
  const currentStandings = standings;

  return (
    <div className="min-h-screen bg-[#07080A] text-zinc-100 font-sans pb-16 relative">
      {renderAppDialog()}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#FF007A]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Modern Uniswap Styled Ticker Bar */}
      <div className="bg-zinc-950 border-b border-zinc-900 py-2.5 px-4 overflow-hidden relative">
        <div className="flex gap-8 animate-marquee whitespace-nowrap text-xs text-zinc-400 font-mono">
          {gossipFeed.map((item, idx) => (
            <span key={idx} className="inline-flex gap-2 items-center">
              <span className="bg-[#FF007A]/15 text-[#FF007A] text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{item.tag}</span>
              {item.title} • <span className="text-zinc-600">{item.description || "Gelişmeler takip ediliyor."}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Ribbon Profile */}
        <div className="bg-zinc-950 p-4 sm:p-5 rounded-3xl border border-zinc-900/60 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-center md:text-left">
            <img 
              src={userClub?.badge} 
              alt={userClub?.name} 
              className="w-12 h-12 object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-zinc-100">{userClub?.name}</h1>
                <span className="bg-emerald-450/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  Sözleşme Var
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                Stadyum: {userClub?.stadium} • Hafta {week} / {totalWeeks}
              </p>
            </div>
          </div>

          {/* Treasury stats row */}
          <div className="flex flex-wrap justify-center items-center gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-2 px-4 rounded-2xl flex items-center gap-2 font-mono text-xs">
              <Landmark className="w-4 h-4 text-[#FF007A]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Transfer Bütçesi</span>
                <span className="text-zinc-200 font-bold">{formatMoney(userClub?.transferBudget || 0)}</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-2 px-4 rounded-2xl flex items-center gap-2 font-mono text-xs">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Lig Sıralaması</span>
                <span className="text-zinc-200 font-bold">
                  {currentStandings.findIndex(s=>s.teamId === managedTeamId) !== -1 
                    ? `${currentStandings.findIndex(s=>s.teamId === managedTeamId) + 1}. Sıra` 
                    : '1. Sıra'}
                </span>
              </div>
            </div>

            {/* Premium Seed Value Input */}
            <div className="bg-zinc-900 border border-zinc-800 p-2 px-3 rounded-2xl flex items-center gap-2 font-mono text-xs text-left">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Maç Tohumu (Seed)</span>
                <input
                  type="number"
                  value={matchSeedSeed}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    handleMatchSeedChange(val);
                  }}
                  className="bg-transparent border-0 text-zinc-100 font-bold focus:outline-none w-28 text-[11px] p-0 leading-tight"
                  placeholder="Rastgele Tohum"
                />
              </div>
            </div>

            {/* CTA action trigger button */}
            <button
              onClick={handleLaunchMatch}
              className="py-3 px-5 bg-gradient-to-r from-violet-600 to-[#FF007A] text-white font-bold text-xs uppercase tracking-wider rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#FF007A]/10 flex items-center gap-1.5 cursor-pointer"
            >
              <Swords className="w-4 h-4" /> Maça Git (Oyna)
            </button>
          </div>
        </div>

        {/* Uniswap Styled Tab Pill Menu bar */}
        <div className="flex justify-start sm:justify-center items-center">
          <div className="inline-flex overflow-x-auto p-1 bg-zinc-950 rounded-2xl border border-zinc-900 w-full sm:w-auto font-mono text-xs font-bold leading-none gap-0.5">
            <button
              onClick={() => setActiveTab('INBOX')}
              className={`p-2.5 px-5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'INBOX' 
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-md' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <MailIcon className="w-4 h-4 text-[#FF007A]" /> Gelen Kutusu
            </button>
            <button
              onClick={() => setActiveTab('SQUAD')}
              className={`p-2.5 px-5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'SQUAD' 
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-md' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Shield className="w-4 h-4 text-blue-400" /> Kadro
            </button>
            <button
              onClick={() => setActiveTab('TACTICS')}
              className={`p-2.5 px-5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'TACTICS' 
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-md' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Swords className="w-4 h-4 text-emerald-400" /> Taktikler
            </button>
            <button
              onClick={() => setActiveTab('STANDINGS')}
              className={`p-2.5 px-5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'STANDINGS' 
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-md' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Trophy className="w-4 h-4 text-yellow-400" /> Puan Tablosu
            </button>
            <button
              onClick={() => setActiveTab('TRANSFERS')}
              className={`p-2.5 px-5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'TRANSFERS' 
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-md' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-purple-400" /> Transfer
            </button>
            <button
              onClick={() => setActiveTab('TRAINING')}
              className={`p-2.5 px-5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'TRAINING' 
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-md' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Dumbbell className="w-4 h-4 text-amber-500" /> Antrenman
            </button>
            <button
              onClick={() => setActiveTab('DEBUG')}
              className={`p-2.5 px-5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'DEBUG' 
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-md font-bold' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Cpu className="w-4 h-4 text-[#FF007A]" /> Sandbox / Debug
            </button>
          </div>
        </div>

        {/* Tab content display render block */}
        <div className="relative mt-2">
          {activeTab === 'INBOX' && (
            <InboxTab 
              inbox={inbox} 
              week={week} 
              squad={userSquad}
              onReadMail={handleReadMail}
              onDeleteMail={handleDeleteMail}
            />
          )}

          {activeTab === 'SQUAD' && (
            <SquadTab 
              squad={userSquad} 
              transferBudget={userClub?.transferBudget || 0}
              onUpdateSquad={handleUpdateSquad}
              onSellPlayer={handleSellPlayer}
              onNotify={showNotice}
              onRequestConfirm={requestConfirmation}
            />
          )}

          {activeTab === 'TACTICS' && (
            <TacticsTab 
              tactics={tactics} 
              squad={userSquad} 
              onUpdateTactics={handleUpdateTactics}
              onUpdateSquad={handleUpdateSquad}
            />
          )}

          {activeTab === 'STANDINGS' && (
            <StandingsTab 
              standings={currentStandings} 
              teams={teams} 
              managedTeamId={managedTeamId}
              allPlayers={Object.values(squads).flat() as Player[]}
            />
          )}

          {activeTab === 'TRANSFERS' && (
            <TransferTab 
              transferBudget={userClub?.transferBudget || 0} 
              squad={userSquad}
              onBuyPlayer={handleBuyPlayer}
              onSellPlayer={handleSellPlayer}
              onNotify={showNotice}
              onRequestConfirm={requestConfirmation}
            />
          )}

          {activeTab === 'TRAINING' && (
            <TrainingTab 
              allocation={trainingAllocation} 
              squad={userSquad}
              onUpdateAllocation={handleUpdateAllocation}
            />
          )}

          {activeTab === 'DEBUG' && (
            <DebugTab 
              teams={teams}
              squads={squads}
              seed={matchSeedSeed}
              onSeedChange={handleMatchSeedChange}
              onNotify={showNotice}
            />
          )}
        </div>

        {/* Outer Utilities footer block */}
        <div className="flex justify-between items-center border-t border-zinc-900 pt-6 mt-10 text-xs text-zinc-600 font-mono">
          <span>Championship Manager: Retro • Lisanslı Verilerle Simülasyon</span>
          <button 
            onClick={handleResetSave}
            title="Sezon Sıfırla"
            className="p-1 px-3 bg-zinc-900/40 hover:bg-red-950/20 text-zinc-500 hover:text-rose-400 border border-zinc-850 hover:border-red-900/30 rounded-xl transition-all cursor-pointer"
          >
            Sezonu Sıfırla (Reset)
          </button>
        </div>
      </div>
    </div>
  );
}
