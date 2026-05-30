import React, { useState } from 'react';
import { Player } from '../types';
import { Shield, Award, Sparkles, Heart, Activity, AlertCircle, ShoppingBag } from 'lucide-react';

interface SquadTabProps {
  squad: Player[];
  transferBudget: number;
  onUpdateSquad: (updatedSquad: Player[]) => void;
  onSellPlayer?: (player: Player) => void;
}

export default function SquadTab({ squad, transferBudget, onUpdateSquad, onSellPlayer }: SquadTabProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Toggle starting status
  const handleToggleStarter = (player: Player) => {
    // If setting to start, verify position count limits
    if (!player.isStarting) {
      const activeStartersCount = squad.filter(p => p.isStarting).length;
      if (activeStartersCount >= 11) {
        alert("En fazla 11 oyuncu ilk 11'de başlayabilir. Lütfen önce bir oyuncuyu yedeğe çekin.");
        return;
      }
    }

    const updated = squad.map(p => {
      if (p.id === player.id) {
        return { ...p, isStarting: !p.isStarting };
      }
      return p;
    });

    onUpdateSquad(updated);
    if (selectedPlayer && selectedPlayer.id === player.id) {
      setSelectedPlayer({ ...selectedPlayer, isStarting: !player.isStarting });
    }
  };

  // Assign Captain
  const handleSetCaptain = (player: Player) => {
    const updated = squad.map(p => ({
      ...p,
      isCaptain: p.id === player.id
    }));
    onUpdateSquad(updated);
    if (selectedPlayer) {
      setSelectedPlayer({ ...selectedPlayer, isCaptain: player.id === selectedPlayer.id });
    }
  };

  // Assign Penalty Taker
  const handleSetPenaltyTaker = (player: Player) => {
    const updated = squad.map(p => ({
      ...p,
      isPenaltyTaker: p.id === player.id
    }));
    onUpdateSquad(updated);
    if (selectedPlayer) {
      setSelectedPlayer({ ...selectedPlayer, isPenaltyTaker: player.id === selectedPlayer.id });
    }
  };

  // Format currency pounds
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 80) return 'text-[#FF007A] bg-[#FF007A]/10 border-[#FF007A]/20';
    if (rating >= 70) return 'text-violet-400 bg-violet-400/10 border-violet-400/20';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  };

  const positionsSorted = [...squad].sort((a, b) => {
    // Starters first
    if (a.isStarting && !b.isStarting) return -1;
    if (!a.isStarting && b.isStarting) return 1;
    
    // Sort by position order: GK, DEF, MID, ATT
    const posOrder = { GK: 1, DEF: 2, MID: 3, ATT: 4 };
    if (posOrder[a.position] !== posOrder[b.position]) {
      return posOrder[a.position] - posOrder[b.position];
    }
    return b.rating - a.rating;
  });

  const handleAutoPick = () => {
    // Sort players: healthy first, then by rating
    const sortedPlayers = [...squad].sort((a, b) => {
      const aInjured = a.injuryWeeks > 0;
      const bInjured = b.injuryWeeks > 0;
      if (aInjured !== bInjured) return aInjured ? 1 : -1;
      return b.rating - a.rating;
    });

    let numDEF = 4;
    let numMID = 4;
    let numATT = 2;

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

    // Fill with injured as last resort
    if (autoStarters.length < 11) {
      const remainingInjured = sortedPlayers.filter(p => !selectedIds.has(p.id));
      while (autoStarters.length < 11 && remainingInjured.length > 0) {
        const p = remainingInjured.shift()!;
        autoStarters.push(p);
        selectedIds.add(p.id);
      }
    }

    const startersIds = new Set(autoStarters.slice(0, 11).map(p => p.id));
    const updatedRoster = squad.map((player) => {
      const starts = startersIds.has(player.id);
      return {
        ...player,
        isStarting: starts,
        pitchPosition: starts ? Array.from(startersIds).indexOf(player.id) + 1 : 0
      };
    });

    onUpdateSquad(updatedRoster);
    alert("Otomatik İlk 11 dengeli formasyona (4-4-2) göre en formda ve sağlıklı oyuncularınızla dolduruldu!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="squad-tab-view">
      {/* Roster Table List */}
      <div className="lg:col-span-8 bg-zinc-950/40 p-4 rounded-3xl border border-zinc-800 backdrop-blur-md">
        <div className="flex justify-between items-center mb-4 gap-2">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FF007A]" />
            Oyuncu Kadrosu <span className="text-xs text-zinc-500 font-mono">({squad.filter(p=>p.isStarting).length}/11 İlk 11)</span>
          </h2>
          <button
            type="button"
            onClick={handleAutoPick}
            className="text-[10px] bg-zinc-900 hover:bg-[#FF007A] hover:text-white text-zinc-300 font-bold font-mono px-3 py-1.5 rounded-xl border border-zinc-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#FF007A]" />
            Otomatik İlk 11 Seç
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/60 pb-2 text-zinc-500 font-mono text-xs">
                <th className="py-2.5">Oyuncu</th>
                <th className="py-2.5 text-center">Poz</th>
                <th className="py-2.5 text-center">Yaş</th>
                <th className="py-2.5 text-center">GÜÇ (OVR)</th>
                <th className="py-2.5 text-center">Kondisyon</th>
                <th className="py-2.5 text-center">Moral</th>
                <th className="py-2.5 text-right">Maaş / Değer</th>
                <th className="py-2.5 text-center">Roller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {positionsSorted.map((player) => (
                <tr 
                  key={player.id} 
                  onClick={() => setSelectedPlayer(player)}
                  className={`group cursor-pointer hover:bg-zinc-900/50 transition-colors duration-150 ${player.isStarting ? 'bg-zinc-900/20 border-l-2 border-l-[#FF007A]' : ''} ${selectedPlayer?.id === player.id ? 'bg-zinc-900/60' : ''}`}
                >
                  <td className="py-3 px-2 flex items-center gap-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-100 group-hover:text-[#FF007A] transition-colors flex items-center gap-1.5">
                        {player.name}
                        {player.injuryWeeks > 0 && (
                          <span className="bg-red-500/15 border border-red-500/30 text-rose-400 text-[10px] px-1 rounded flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" /> {player.injuryWeeks}H
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        Gol: {player.goals} | Ast: {player.assists} | Maç: {player.appearances}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                      player.position === 'GK' ? 'bg-[#FF007A]/10 text-[#FF007A]' :
                      player.position === 'DEF' ? 'bg-blue-500/10 text-blue-400' :
                      player.position === 'MID' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {player.position}
                    </span>
                  </td>
                  <td className="py-3 text-center text-zinc-300 font-mono">{player.age}</td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded border text-xs font-mono font-bold ${getRatingColor(player.rating)}`}>
                      {player.rating}
                    </span>
                  </td>
                  <td className="py-3 text-center text-xs font-mono">
                    <span className={player.fitness > 85 ? 'text-emerald-400' : player.fitness > 65 ? 'text-amber-400' : 'text-rose-400'}>
                      %{player.fitness}
                    </span>
                  </td>
                  <td className="py-3 text-center text-xs font-mono">
                    <span className={player.morale > 75 ? 'text-emerald-400' : player.morale > 50 ? 'text-amber-400' : 'text-rose-400'}>
                      %{player.morale}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex flex-col">
                      <span className="text-xs text-zinc-300 font-mono">{formatMoney(player.value)}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{formatMoney(player.wage)}/hft</span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex justify-center items-center gap-1">
                      {player.isStarting && <span className="bg-zinc-800 text-[#FF007A] text-[9px] px-1 rounded font-mono font-bold">11</span>}
                      {player.isCaptain && <Award className="w-3.5 h-3.5 text-[#FF007A]" title="Kaptan" />}
                      {player.isPenaltyTaker && <Sparkles className="w-3.5 h-3.5 text-yellow-400" title="Penaltıcı" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Profile Card (Uniswap Web3 Card Styling) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {selectedPlayer ? (
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 rounded-3xl border border-zinc-800/80 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF007A]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <div className="flex justify-between items-start mb-5 relative">
              <div>
                <h3 className="text-xl font-bold text-zinc-100 duration-150 tracking-tight leading-6">{selectedPlayer.name}</h3>
                <span className="text-xs text-zinc-500 font-mono">{selectedPlayer.position} • {selectedPlayer.age} Yaşında</span>
              </div>
              <div className={`px-3 py-1.5 rounded-2xl border text-lg font-mono font-bold leading-none ${getRatingColor(selectedPlayer.rating)}`}>
                {selectedPlayer.rating}
              </div>
            </div>

            {/* Quick Stats Bars */}
            <div className="space-y-3.5 mb-5 relative">
              <h4 className="text-xs font-mono text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-800/40 pb-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#FF007A]" /> Detaylı Yetenekler
              </h4>
              
              {selectedPlayer.position === 'GK' ? (
                <div>
                  <div className="flex justify-between text-xs text-zinc-300 font-mono mb-1">
                    <span>Kalecilik</span>
                    <span>{selectedPlayer.goalkeeping}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-[#FF007A] rounded-full" style={{ width: `${selectedPlayer.goalkeeping}%` }}></div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 font-mono mb-1">
                      <span>Hız / Çeviklik</span>
                      <span>{selectedPlayer.pace}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-[#FF007A] rounded-full" style={{ width: `${selectedPlayer.pace}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 font-mono mb-1">
                      <span>Şut / Bitiricilik</span>
                      <span>{selectedPlayer.shooting}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-[#FF007A] rounded-full" style={{ width: `${selectedPlayer.shooting}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 font-mono mb-1">
                      <span>Pas / Oyun Kurma</span>
                      <span>{selectedPlayer.passing}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-[#FF007A] rounded-full" style={{ width: `${selectedPlayer.passing}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 font-mono mb-1">
                      <span>Savunma / Müdahale</span>
                      <span>{selectedPlayer.defending}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-[#FF007A] rounded-full" style={{ width: `${selectedPlayer.defending}%` }}></div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <div className="flex justify-between text-xs text-zinc-300 font-mono mb-1">
                  <span>Fizik / Güç</span>
                  <span>{selectedPlayer.physical}</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-[#FF007A] rounded-full" style={{ width: `${selectedPlayer.physical}%` }}></div>
                </div>
              </div>
            </div>

            {/* Contract & Finances */}
            <div className="bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/40 space-y-2 mb-5 font-mono text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Piyasa Değeri:</span>
                <span className="text-[#FF007A] font-bold">{formatMoney(selectedPlayer.value)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Haftalık Maaş:</span>
                <span className="text-zinc-200">{formatMoney(selectedPlayer.wage)} / hft</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Ortalama Puan:</span>
                <span className="text-[#FF007A]">{selectedPlayer.appearances > 0 ? selectedPlayer.avgRating.toFixed(2) : '-'}</span>
              </div>
            </div>

            {/* Strategic Management Actions */}
            <div className="space-y-2 relative">
              <button 
                onClick={() => handleToggleStarter(selectedPlayer)}
                className={`w-full py-2.5 rounded-2xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  selectedPlayer.isStarting 
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' 
                    : 'bg-[#FF007A] border-transparent text-white hover:bg-[#FF007A]/90 hover:scale-[1.01]'
                }`}
              >
                {selectedPlayer.isStarting ? 'Yedek Kulübesine Çek' : "İlk 11'e Al (Kadrodan)"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!selectedPlayer.isStarting}
                  onClick={() => handleSetCaptain(selectedPlayer)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedPlayer.isCaptain
                      ? 'bg-zinc-800 border-zinc-700 text-[#FF007A]'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none'
                  }`}
                >
                  Kaptan Yap
                </button>
                <button
                  disabled={!selectedPlayer.isStarting}
                  onClick={() => handleSetPenaltyTaker(selectedPlayer)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedPlayer.isPenaltyTaker
                      ? 'bg-zinc-800 border-zinc-700 text-yellow-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none'
                  }`}
                >
                  Penaltıcı Yap
                </button>
              </div>

              {onSellPlayer && (
                <button
                  onClick={() => {
                    if(confirm(`${selectedPlayer.name} isimli oyuncuyu transfer listesine koymak istiyor musunuz?`)) {
                      onSellPlayer(selectedPlayer);
                      setSelectedPlayer(null);
                    }
                  }}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-semibold border border-red-900/40 text-rose-400 bg-red-950/20 hover:bg-red-950/40 transition-all flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Satış Listesine Koy
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-zinc-800/60 p-8 rounded-3xl text-center flex flex-col items-center justify-center min-h-[300px]">
            <Award className="w-10 h-10 text-zinc-700 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-300">Oyuncu Seçilmedi</h3>
            <p className="text-xs text-zinc-500 max-w-[200px] mt-1.5">Niteliklerini, gelişimini ve rollerini görmek için bir oyuncuya tıklayın.</p>
          </div>
        )}
      </div>
    </div>
  );
}
