import React, { useState } from 'react';
import { Tactics, Player } from '../types';
import { Sliders, HelpCircle, Swords, Shuffle, Zap, X, RefreshCw, UserCheck } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

interface TacticsTabProps {
  tactics: Tactics;
  squad: Player[];
  onUpdateTactics: (updatedTactics: Tactics) => void;
  onUpdateSquad?: (updatedSquad: Player[]) => void;
}

// Tactical coordinate mapping for visual pitch representation
// Mapped as bottom-up (GK near bottom, ATT near top)
// percentages: { left: x%, bottom: y% }
const FORMATION_COORDINATES: Record<string, Record<number, { left: string; bottom: string; label: string }>> = {
  '4-4-2': {
    1: { left: '50%', bottom: '8%', label: 'KL' },
    2: { left: '15%', bottom: '26%', label: 'SLB' },
    3: { left: '38%', bottom: '26%', label: 'STP' },
    4: { left: '62%', bottom: '26%', label: 'STP' },
    5: { left: '85%', bottom: '26%', label: 'SĞB' },
    6: { left: '15%', bottom: '52%', label: 'SLO' },
    7: { left: '38%', bottom: '52%', label: 'OS' },
    8: { left: '62%', bottom: '52%', label: 'OS' },
    9: { left: '85%', bottom: '52%', label: 'SĞO' },
    10: { left: '35%', bottom: '78%', label: 'FOR' },
    11: { left: '65%', bottom: '78%', label: 'FOR' }
  },
  '4-3-3': {
    1: { left: '50%', bottom: '8%', label: 'KL' },
    2: { left: '15%', bottom: '26%', label: 'SLB' },
    3: { left: '38%', bottom: '26%', label: 'STP' },
    4: { left: '62%', bottom: '26%', label: 'STP' },
    5: { left: '85%', bottom: '26%', label: 'SĞB' },
    6: { left: '28%', bottom: '50%', label: 'LCM' },
    7: { left: '50%', bottom: '44%', label: 'DOS' },
    8: { left: '72%', bottom: '50%', label: 'RCM' },
    9: { left: '20%', bottom: '76%', label: 'SLA' },
    10: { left: '50%', bottom: '82%', label: 'FOR' },
    11: { left: '80%', bottom: '76%', label: 'SĞA' }
  },
  '3-5-2': {
    1: { left: '50%', bottom: '8%', label: 'KL' },
    2: { left: '25%', bottom: '26%', label: 'STP' },
    3: { left: '50%', bottom: '26%', label: 'STP' },
    4: { left: '75%', bottom: '26%', label: 'STP' },
    5: { left: '15%', bottom: '48%', label: 'SLKB' },
    6: { left: '38%', bottom: '48%', label: 'OS' },
    7: { left: '50%', bottom: '56%', label: 'OOS' },
    8: { left: '62%', bottom: '48%', label: 'OS' },
    9: { left: '85%', bottom: '48%', label: 'SĞKB' },
    10: { left: '35%', bottom: '78%', label: 'FOR' },
    11: { left: '65%', bottom: '78%', label: 'FOR' }
  },
  '4-2-3-1': {
    1: { left: '50%', bottom: '8%', label: 'KL' },
    2: { left: '15%', bottom: '26%', label: 'SLB' },
    3: { left: '38%', bottom: '26%', label: 'STP' },
    4: { left: '62%', bottom: '26%', label: 'STP' },
    5: { left: '85%', bottom: '26%', label: 'SĞB' },
    6: { left: '35%', bottom: '44%', label: 'DOS' },
    7: { left: '65%', bottom: '44%', label: 'DOS' },
    8: { left: '15%', bottom: '65%', label: 'SLO' },
    9: { left: '50%', bottom: '65%', label: 'OOS' },
    10: { left: '85%', bottom: '65%', label: 'SĞO' },
    11: { left: '50%', bottom: '82%', label: 'FOR' }
  },
  '5-3-2': {
    1: { left: '50%', bottom: '8%', label: 'KL' },
    2: { left: '15%', bottom: '24%', label: 'SLB' },
    3: { left: '32%', bottom: '24%', label: 'STP' },
    4: { left: '50%', bottom: '22%', label: 'LIB' },
    5: { left: '68%', bottom: '24%', label: 'STP' },
    6: { left: '85%', bottom: '24%', label: 'SĞB' },
    7: { left: '28%', bottom: '52%', label: 'OS' },
    8: { left: '50%', bottom: '52%', label: 'OS' },
    9: { left: '72%', bottom: '52%', label: 'OS' },
    10: { left: '35%', bottom: '78%', label: 'FOR' },
    11: { left: '65%', bottom: '78%', label: 'FOR' }
  }
};

export default function TacticsTab({ tactics, squad, onUpdateTactics, onUpdateSquad }: TacticsTabProps) {
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  const playTacticSound = () => {
    soundEngine.playCommentaryTick();
  };

  const handleFormationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    playTacticSound();
    onUpdateTactics({
      ...tactics,
      formation: e.target.value as Tactics['formation']
    });
  };

  const handleMentalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    playTacticSound();
    onUpdateTactics({
      ...tactics,
      mentality: e.target.value as Tactics['mentality']
    });
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    playTacticSound();
    onUpdateTactics({
      ...tactics,
      style: e.target.value as Tactics['style']
    });
  };

  const handleTempoChange = (val: Tactics['tempo']) => {
    playTacticSound();
    onUpdateTactics({ ...tactics, tempo: val });
  };

  const handlePassingChange = (val: Tactics['passing']) => {
    playTacticSound();
    onUpdateTactics({ ...tactics, passing: val });
  };

  const starters = squad.filter(p => p.isStarting);
  const benchPlayers = squad.filter(p => !p.isStarting && p.injuryWeeks === 0);
  const coords = FORMATION_COORDINATES[tactics.formation] || FORMATION_COORDINATES['4-4-2'];

  // Map starting players to exact slot indices 0 to 10 based on pitchPosition (1 to 11) or fill empty sequentially
  const slotPlayers: (Player | undefined)[] = Array(11).fill(undefined);
  const startersWithValidPos = starters.filter(p => p.pitchPosition >= 1 && p.pitchPosition <= 11);
  
  startersWithValidPos.forEach(p => {
    if (!slotPlayers[p.pitchPosition - 1]) {
      slotPlayers[p.pitchPosition - 1] = p;
    }
  });

  const startersWithoutValidPos = starters.filter(
    p => !startersWithValidPos.includes(p) || (p.pitchPosition >= 1 && p.pitchPosition <= 11 && slotPlayers[p.pitchPosition - 1] !== p)
  );

  let emptySlotIdx = 0;
  startersWithoutValidPos.forEach(p => {
    while (emptySlotIdx < 11 && slotPlayers[emptySlotIdx] !== undefined) {
      emptySlotIdx++;
    }
    if (emptySlotIdx < 11) {
      slotPlayers[emptySlotIdx] = p;
    }
  });

  const handleSwapPlayer = (benchPlayer: Player) => {
    if (activeSlotIndex === null || !onUpdateSquad) return;
    
    // Get player currently occupying activeSlotIndex among starters
    const currentStarter = slotPlayers[activeSlotIndex];
    
    const updatedSquad = squad.map(p => {
      if (currentStarter && p.id === currentStarter.id) {
        return { ...p, isStarting: false, pitchPosition: 0 };
      }
      if (p.id === benchPlayer.id) {
        return { ...p, isStarting: true, pitchPosition: activeSlotIndex + 1 };
      }
      return p;
    });
    
    onUpdateSquad(updatedSquad);
    soundEngine.playKick();
    setActiveSlotIndex(null);
  };

  const handleRemoveFromStarting = () => {
    if (activeSlotIndex === null || !onUpdateSquad) return;
    const currentStarter = slotPlayers[activeSlotIndex];
    if (!currentStarter) return;
    
    const updatedSquad = squad.map(p => {
      if (p.id === currentStarter.id) {
        return { ...p, isStarting: false, pitchPosition: 0 };
      }
      return p;
    });
    
    onUpdateSquad(updatedSquad);
    soundEngine.playMatchEnd();
    setActiveSlotIndex(null);
  };

  const activeSlotStarter = activeSlotIndex !== null ? slotPlayers[activeSlotIndex] : null;
  const activeSlotLabel = activeSlotIndex !== null ? coords[activeSlotIndex + 1]?.label : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="tactics-tab-view">
      {/* Visual Miniature Football Pitch */}
      <div className="lg:col-span-8 flex flex-col gap-3">
        <div className="bg-white p-4 rounded-[24px] border border-zinc-200 flex justify-between items-center shadow-sm">
          <span className="text-zinc-900 font-bold text-sm flex items-center gap-2">
            <Swords className="w-4 h-4 text-[#FF007A]" /> Retro Taktik Tahtası • {tactics.formation}
          </span>
          <span className="text-xs text-zinc-500 font-mono hidden sm:inline">Oyuncu değiştirmek için pozisyona tıklayın</span>
        </div>

        {/* Real Grass Visual 2D Pitch Canvas */}
        <div 
          className="w-full h-[380px] xs:h-[420px] sm:h-[480px] md:h-[530px] relative rounded-[32px] border-2 border-emerald-800 overflow-hidden shadow-lg select-none"
          style={{ backgroundColor: '#15803d' }}
        >
          {/* Real Lawn Stripes (Vertical) */}
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

          {/* Chalk Boundaries & Fields Lines (Thick bright white lines) */}
          <div className="absolute inset-4 border border-white/60 rounded-2xl pointer-events-none">
            {/* Penalty Box Bottom (Home GK end) */}
            <div className="absolute bottom-0 left-[20%] right-[20%] h-[18%] border-t border-x border-white/60 bg-white/5" />
            <div className="absolute bottom-0 left-[34%] right-[34%] h-[6%] border-t border-x border-white/60" />
            <div className="absolute bottom-[12%] left-[48%] right-[48%] h-1 bg-white/80 rounded-full" />
            
            {/* Center Circle & Halfline */}
            <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] aspect-square rounded-full border border-white/60" />
            <div className="absolute top-[50%] left-0 right-0 h-[1.5px] bg-white/60" />
            <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white" />

            {/* Penalty Box Top (Away end) */}
            <div className="absolute top-0 left-[20%] right-[20%] h-[18%] border-b border-x border-white/60 bg-white/5" />
            <div className="absolute top-0 left-[34%] right-[34%] h-[6%] border-b border-x border-white/60" />
            <div className="absolute top-[12%] left-[48%] right-[48%] h-1 bg-white/80 rounded-full" />

            {/* Corner Arc graphics */}
            <div className="absolute top-0 left-0 w-4 h-4 border-b border-r border-white/60 rounded-br-full" />
            <div className="absolute top-0 right-0 w-4 h-4 border-b border-l border-white/60 rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-t border-r border-white/60 rounded-tr-full" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-t border-l border-white/60 rounded-tl-full" />
          </div>

          {/* Goal netting outlines */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-0.5 w-24 h-3 bg-white/20 border-b-2 border-x-2 border-white/70 rounded-b pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -mb-0.5 w-24 h-3 bg-white/20 border-t-2 border-x-2 border-white/70 rounded-t pointer-events-none" />

          {/* Active Starter Spheres Rendered */}
          {Array.from({ length: 11 }).map((_, i) => {
            const posIndex = i + 1;
            const posConfig = coords[posIndex];
            if (!posConfig) return null;

            // Match starter player based on position mapping
            const player = slotPlayers[i];

            return (
              <div 
                key={posIndex}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none cursor-pointer group active:scale-95 transition-all duration-100 z-20"
                style={{ left: posConfig.left, bottom: posConfig.bottom }}
                onClick={() => {
                  playTacticSound();
                  setActiveSlotIndex(i);
                }}
              >
                {player ? (
                  <div className="flex flex-col items-center">
                    {/* Glowing Player SVG retro jersey shirt */}
                    <div className="relative w-11 h-11 drop-shadow-md select-none group-hover:scale-110 transition-transform">
                      <svg className="w-full h-full text-[#DA020E] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" viewBox="0 0 100 100" fill="currentColor">
                        {/* Sleeves */}
                        <path d="M 15 25 L 30 10 L 40 22 L 25 35 Z" fill="#DA020E" stroke="#ffffff" strokeWidth="2" />
                        <path d="M 85 25 L 70 10 L 60 22 L 75 35 Z" fill="#DA020E" stroke="#ffffff" strokeWidth="2" />
                        {/* Main Body */}
                        <path d="M 30 20 C 45 15, 55 15, 70 20 L 75 85 L 25 85 Z" fill="#DA020E" stroke="#ffffff" strokeWidth="3" />
                        {/* Collar Accent */}
                        <path d="M 45 18 C 50 25, 50 25, 55 18" stroke="#ffffff" strokeWidth="3" fill="none" />
                        {/* Stripe variations depending on position */}
                        {player.position === 'ATT' && <path d="M 40 22 L 40 85 M 60 22 L 60 85" stroke="#990000" strokeWidth="3" />}
                        {player.position === 'MID' && <path d="M 50 20 L 50 85" stroke="#ee3333" strokeWidth="4" />}
                        {player.position === 'DEF' && <path d="M 33 22 L 33 85 M 67 22 L 67 85" stroke="#1e3a8a" strokeWidth="2" />}
                      </svg>
                      {/* High-Contrast Bold Jersey Number Text right in the middle */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center -mt-0.5 select-none pointer-events-none">
                        <span className="font-mono text-white text-[11px] font-black leading-none drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,1)]">{player.rating}</span>
                        <span className="text-[7px] bg-black/60 px-0.5 rounded text-yellow-300 font-bold scale-[0.8] leading-none mt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] uppercase">{player.position}</span>
                      </div>
                    </div>
                    {/* Position & Surname Tag */}
                    <div className="mt-1.5 bg-black/92 border border-white/40 backdrop-blur-sm px-2 py-0.5 rounded-md text-center max-w-[90px] sm:max-w-[115px] truncate shadow-lg">
                      <p className="text-[8px] font-bold text-red-400 font-mono leading-tight">{posConfig.label}</p>
                      <p className="text-[9px] text-white truncate font-black leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">{player.name.split(' ')[1] || player.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    {/* Empty coordinate dashed SVG shirt */}
                    <div className="relative w-11 h-11 select-none flex items-center justify-center group-hover:scale-105 transition-all">
                      <svg className="w-full h-full text-emerald-950/30 stroke-white/40 fill-emerald-950/25" viewBox="0 0 100 100">
                        {/* Sleeves */}
                        <path d="M 15 25 L 30 10 L 40 22 L 25 35 Z" strokeDasharray="4,4" strokeWidth="2" />
                        <path d="M 85 25 L 70 10 L 60 22 L 75 35 Z" strokeDasharray="4,4" strokeWidth="2" />
                        {/* Main Body */}
                        <path d="M 30 20 C 45 15, 55 15, 70 20 L 75 85 L 25 85 Z" strokeDasharray="4,4" strokeWidth="2" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center -mt-1 select-none pointer-events-none text-center">
                        <span className="text-white/60 font-mono text-[7px] font-black uppercase tracking-wider scale-[0.85]">EKLE</span>
                        <span className="text-[6.5px] text-zinc-300/50 font-bold uppercase tracking-tighter leading-none mt-0.5">{posConfig.label}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 bg-emerald-950/80 border border-emerald-800/20 px-1.5 py-0.5 rounded-md text-center shadow-md">
                      <p className="text-[8px] font-bold text-zinc-400 font-mono leading-none">{posConfig.label}</p>
                      <p className="text-[9px] text-zinc-300 font-medium leading-tight">BOŞ</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Swap Drawer Overlay popup */}
          {activeSlotIndex !== null && (
            <div className="absolute inset-x-4 bottom-4 top-4 bg-zinc-950/95 backdrop-blur-md rounded-2xl z-40 border border-zinc-800 flex flex-col overflow-hidden animate-fade-in text-white p-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-[#FF007A] text-white text-[10px] font-black px-2 py-0.5 rounded font-mono uppercase">
                    {activeSlotLabel}
                  </span>
                  <h4 className="text-sm font-bold">
                    {activeSlotStarter ? `${activeSlotStarter.name} yerine oyuncu seç` : 'Pozisyona oyuncu yerleştir'}
                  </h4>
                </div>
                <button 
                  onClick={() => setActiveSlotIndex(null)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bench choices selection list */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {benchPlayers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                    <RefreshCw className="w-8 h-8 opacity-30 animate-spin mb-2" />
                    <p className="text-xs">Sakat veya formda olmayan yedek oyuncu bulunmuyor.</p>
                  </div>
                ) : (
                  benchPlayers
                    .sort((a, b) => b.rating - a.rating)
                    .map(player => (
                      <div
                        key={player.id}
                        onClick={() => handleSwapPlayer(player)}
                        className="p-2.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-800 border border-zinc-900 hover:border-zinc-700 cursor-pointer flex items-center justify-between transition-colors duration-155"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-zinc-100 truncate flex items-center gap-1.5">
                            {player.name}
                            <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1 rounded-sm uppercase">{player.position}</span>
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            Kondisyon %{player.fitness} | Moral %{player.morale} | Değer: £{(player.value / 1000000).toFixed(1)}M
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black font-mono bg-[#FF007A]/15 text-[#FF007A] px-2 py-0.5 rounded border border-[#FF007A]/25">
                            OVR: {player.rating}
                          </span>
                          <UserCheck className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100" />
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Remove player option if one occupied this slot */}
              {activeSlotStarter && (
                <div className="border-t border-zinc-800 pt-3 mt-1 flex justify-end">
                  <button
                    onClick={handleRemoveFromStarting}
                    className="bg-red-950/40 border border-red-900/50 hover:bg-red-900/30 text-rose-400 text-xs px-3 py-1.5 rounded-xl font-bold transition-all"
                  >
                    Mevcut Oyuncuyu Kadrodan Çıkar (Yedek Yap)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Control sliders & Playstyles config (Bento theme-compliant white slider card) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-white p-6 rounded-[24px] border border-zinc-200 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold text-zinc-800 font-mono uppercase tracking-wider flex items-center gap-2 border-b border-zinc-100 pb-2">
            <Sliders className="w-4 h-4 text-[#FF007A]" /> Taktik Ayarları
          </h2>

          {/* Formation Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-500 font-mono font-bold">Oyun Dizilişi</label>
            <select
              value={tactics.formation}
              onChange={handleFormationChange}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 font-mono font-bold focus:outline-none focus:border-[#FF007A]"
            >
              <option value="4-4-2">4-4-2 (Klasik İngiliz)</option>
              <option value="4-3-3">4-3-3 (Ofansif Kanatlar)</option>
              <option value="3-5-2">3-5-2 (Yoğun Orta Saha)</option>
              <option value="4-2-3-1">4-2-3-1 (Modern Dengeli)</option>
              <option value="5-3-2">5-3-2 (Geri Hat Kilidi)</option>
            </select>
          </div>

          {/* Mentality Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-500 font-mono font-bold">Oyun Temel Karakteri (Mentalite)</label>
            <select
              value={tactics.mentality}
              onChange={handleMentalityChange}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 font-mono font-bold focus:outline-none focus:border-[#FF007A]"
            >
              <option value="DEFENSIVE">Savunmacı (Geri Çekil)</option>
              <option value="CAUTIOUS">Dikkatli (Kontra)</option>
              <option value="BALANCED">Dengeli / Akıcı</option>
              <option value="ATTACKING">Hücum Ağırlıklı</option>
              <option value="OVERLOAD">Tam Saha Pres (Yüklen)</option>
            </select>
          </div>

          {/* Play Style Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-500 font-mono font-bold">Oyun Taktik Kimliği (Playstyle)</label>
            <select
              value={tactics.style}
              onChange={handleStyleChange}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 font-mono font-bold focus:outline-none focus:border-[#FF007A]"
            >
              <option value="TIKI_TAKA">Tiki-Taka (Kısa Pas & Kontrol)</option>
              <option value="GEGENPRESS">Gegenpressing (Önde Hızlı Pres)</option>
              <option value="WING_PLAY">Wing Play (Kanatlardan Akın)</option>
              <option value="COUNTER_ATTACK">Kontra Atak (Hızlı Geçişler)</option>
              <option value="PARK_BUS">Otobüsü Çek (Savunma Duvarı)</option>
            </select>
          </div>

          {/* Custom Toggle Pills for Tempo */}
          <div className="space-y-2 border-t border-zinc-100 pt-4">
            <span className="text-xs text-zinc-500 font-mono flex items-center gap-1 font-bold">
              <Zap className="w-3.5 h-3.5 text-yellow-500" /> Oyun Temposu
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-50 rounded-xl border border-zinc-200 font-mono text-[10px]">
              {(['LOW', 'NORMAL', 'HIGH'] as Array<Tactics['tempo']>).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTempoChange(t)}
                  className={`py-1.5 rounded-lg font-bold transition-all ${
                    tactics.tempo === t
                      ? 'bg-[#FF007A] text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {t === 'LOW' ? 'YAVAŞ' : t === 'NORMAL' ? 'NORMAL' : 'HIZLI'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Toggle Pills for Passing */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-500 font-mono flex items-center gap-1 font-bold">
              <Shuffle className="w-3.5 h-3.5 text-blue-500" /> Pas Dağıtımı
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-50 rounded-xl border border-zinc-200 font-mono text-[10px]">
              {(['SHORT', 'MIXED', 'DIRECT'] as Array<Tactics['passing']>).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePassingChange(p)}
                  className={`py-1.5 rounded-lg font-bold transition-all ${
                    tactics.passing === p
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {p === 'SHORT' ? 'KISA' : p === 'MIXED' ? 'KARIŞIK' : 'DİREKT'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tactical Helper Panel */}
        <div className="bg-white p-4 rounded-[24px] border border-zinc-200 text-xs text-zinc-500 font-mono flex gap-2 shadow-sm">
          <HelpCircle className="w-5 h-5 text-[#FF007A] shrink-0 mt-0.5" />
          <p>
            Taktikleriniz maç sırasındaki topla oynama oranlarını, şut şanslarını ve pas isabet oranlarını doğrudan belirler. Hızlı tempolu, yüksek pres oyunlarında oyuncularınız daha fazla kondisyon kaybedecektir!
          </p>
        </div>
      </div>
    </div>
  );
}
