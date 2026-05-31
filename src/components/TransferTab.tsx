import React, { useState } from 'react';
import { Player } from '../types';
import { Banknote, Search, Sparkles, Plus, CheckCircle, Trash2, ArrowUpDown } from 'lucide-react';

interface TransferTabProps {
  transferBudget: number;
  squad: Player[];
  onBuyPlayer: (player: Player) => void;
  onSellPlayer: (player: Player) => void;
  onNotify?: (title: string, message: string, variant?: 'info' | 'success' | 'warning' | 'danger') => void;
  onRequestConfirm?: (dialog: {
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'danger';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }) => void;
}

// Pre-seeded high quality global players in transfer market pool
const MARKET_PLAYERS_INITIAL: Player[] = [
  { id: "tm_1", name: "Erling Bellingham", age: 22, position: "ATT", rating: 85, pace: 89, shooting: 88, passing: 78, defending: 35, physical: 84, goalkeeping: 10, value: 54000000, wage: 120000, form: 7, fitness: 100, morale: 90, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_2", name: "Rodri Gündoğan", age: 29, position: "MID", rating: 84, pace: 68, shooting: 75, passing: 89, defending: 82, physical: 80, goalkeeping: 10, value: 41000000, wage: 95000, form: 8, fitness: 100, morale: 85, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_3", name: "Manuel Saliba", age: 23, position: "DEF", rating: 82, pace: 78, shooting: 40, passing: 72, defending: 85, physical: 83, goalkeeping: 10, value: 34500000, wage: 80000, form: 7, fitness: 100, morale: 80, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_4", name: "Marc Meslier", age: 24, position: "GK", rating: 78, pace: 45, shooting: 15, passing: 60, defending: 25, physical: 65, goalkeeping: 80, value: 12800000, wage: 32000, form: 7, fitness: 100, morale: 82, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_5", name: "Sami Kaplan", age: 19, position: "ATT", rating: 74, pace: 85, shooting: 74, passing: 68, defending: 30, physical: 66, goalkeeping: 10, value: 6500000, wage: 11000, form: 8, fitness: 100, morale: 95, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_6", name: "Jamie Whittaker", age: 21, position: "MID", rating: 72, pace: 75, shooting: 68, passing: 76, defending: 65, physical: 72, goalkeeping: 10, value: 4200000, wage: 8500, form: 7, fitness: 100, morale: 80, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_7", name: "Ben Davies", age: 25, position: "DEF", rating: 73, pace: 70, shooting: 45, passing: 65, defending: 74, physical: 75, goalkeeping: 10, value: 3804000, wage: 12000, form: 6, fitness: 100, morale: 78, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_8", name: "Declan Clarke", age: 27, position: "MID", rating: 77, pace: 72, shooting: 70, passing: 78, defending: 72, physical: 78, goalkeeping: 10, value: 9200000, wage: 25000, form: 7, fitness: 100, morale: 80, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_9", name: "Cody Sargent", age: 23, position: "ATT", rating: 76, pace: 80, shooting: 78, passing: 66, defending: 32, physical: 70, goalkeeping: 10, value: 8500000, wage: 21000, form: 7, fitness: 100, morale: 85, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
  { id: "tm_10", name: "John Smith", age: 31, position: "GK", rating: 73, pace: 35, shooting: 10, passing: 55, defending: 20, physical: 70, goalkeeping: 74, value: 1600000, wage: 8000, form: 6, fitness: 100, morale: 75, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0, ratingHistory: [], avgRating: 0, isStarting: false, pitchPosition: 0, isCaptain: false, isPenaltyTaker: false },
];

export default function TransferTab({ transferBudget, squad, onBuyPlayer, onSellPlayer, onNotify, onRequestConfirm }: TransferTabProps) {
  const [filterPos, setFilterPos] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT'>('ALL');
  const [marketPlayers, setMarketPlayers] = useState<Player[]>(MARKET_PLAYERS_INITIAL);
  const [searchQuery, setSearchQuery] = useState('');
  const [boughtPlayerIds, setBoughtPlayerIds] = useState<string[]>([]);

  const handleBuy = (player: Player) => {
    if (transferBudget < player.value) {
      onNotify?.('Bütçe Yetersiz', 'Kulüp bütçesi bu oyuncuyu almaya elverişli değil.', 'warning');
      return;
    }

    if (squad.length >= 25) {
      onNotify?.('Kadro Dolu', 'Kadronuzda en fazla 25 oyuncu barındırabilirsiniz. Lütfen önce bir oyuncu satın.', 'warning');
      return;
    }

    onRequestConfirm?.({
      title: 'Transferi Onayla',
      message: `${player.name} isimli oyuncuyu transfer etmek istiyor musunuz?\n\nDeğer: ${formatMoney(player.value)}`,
      variant: 'warning',
      confirmLabel: 'Sözleşme İmzala',
      onConfirm: () => {
      onBuyPlayer({ ...player, id: 'buy_' + Math.random().toString(36).substr(2, 9) });
      setBoughtPlayerIds([...boughtPlayerIds, player.id]);
      setMarketPlayers(marketPlayers.filter(p => p.id !== player.id));
      onNotify?.('Transfer Tamamlandı', `${player.name} kulübümüze katıldı.`, 'success');
      }
    });
  };

  const handleSell = (player: Player) => {
    if (squad.length <= 15) {
      onNotify?.('Kadro Çok Dar', 'Ligde oynamak için kadronuzda en az 15 oyuncu olmak zorundadır.', 'warning');
      return;
    }

    if (player.isStarting) {
      onNotify?.('İlk 11 Oyuncusu Satılamaz', 'Lütfen önce oyuncuyu yedeklere çekin.', 'warning');
      return;
    }

    onSellPlayer(player);
    onNotify?.('Oyuncu Satıldı', `${player.name} kulüpten ayrıldı. ${formatMoney(player.value)} bütçeye eklendi.`, 'success');
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  const filteredMarket = marketPlayers.filter(p => {
    const matchesPos = filterPos === 'ALL' || p.position === filterPos;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPos && matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="transfer-tab-view">
      {/* Search and Buy Portal */}
      <div className="lg:col-span-8 bg-zinc-950/40 p-5 rounded-3xl border border-zinc-805/70 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-[#FF007A]" />
            Oyuncu Pazarı (Transfer)
          </h2>
          
          {/* Market Balance Card */}
          <div className="bg-zinc-900 border border-zinc-800 p-2.5 px-4 rounded-2xl flex items-center gap-2 shrink-0">
            <Banknote className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-mono uppercase font-bold">Transfer Bütçesi</span>
              <span className="text-xs text-emerald-400 font-bold font-mono">{formatMoney(transferBudget)}</span>
            </div>
          </div>
        </div>

        {/* Search Input and Tabs */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Oyuncu ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-[#FF007A]"
            />
          </div>
          
          <div className="flex gap-1 overflow-x-auto p-0.5 bg-zinc-950 rounded-2xl border border-zinc-800/60 font-mono text-[10px]">
            {(['ALL', 'GK', 'DEF', 'MID', 'ATT'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setFilterPos(pos)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                  filterPos === pos
                    ? 'bg-[#FF007A] text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {pos === 'ALL' ? 'HEPSİ' : pos}
              </button>
            ))}
          </div>
        </div>

        {/* Transfer catalog list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 pb-2 text-zinc-500 font-mono text-xs">
                <th className="py-2.5">Adı</th>
                <th className="py-2.5 text-center">Pozisyon</th>
                <th className="py-2.5 text-center">Yaş</th>
                <th className="py-2.5 text-center">GÜÇ (OVR)</th>
                <th className="py-2.5 text-right">Haftalık Maaş</th>
                <th className="py-2.5 text-right">Değer</th>
                <th className="py-2.5 text-center">Transfer Et</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {filteredMarket.length > 0 ? (
                filteredMarket.map((player) => (
                  <tr key={player.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3 px-1">
                      <p className="font-semibold text-zinc-200">{player.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">Form: {player.form}/10 | Kondisyon: %{player.fitness}</p>
                    </td>
                    <td className="py-3 text-center">
                      <span className="bg-zinc-900 border border-zinc-800/80 text-zinc-300 font-bold px-2 py-0.5 rounded text-[10px] font-mono">{player.position}</span>
                    </td>
                    <td className="py-3 text-center text-zinc-300 font-mono">{player.age}</td>
                    <td className="py-3 text-center">
                      <span className="font-mono text-xs font-bold text-[#FF007A] bg-[#FF007A]/10 px-2 py-0.5 border border-[#FF007A]/20 rounded">{player.rating}</span>
                    </td>
                    <td className="py-3 text-right text-zinc-400 text-xs font-mono">{formatMoney(player.wage)}</td>
                    <td className="py-3 text-right text-emerald-400 font-semibold text-xs font-mono">{formatMoney(player.value)}</td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => handleBuy(player)}
                        className="p-1 px-3 bg-gradient-to-r from-violet-600 to-[#FF007A] text-white font-semibold text-xs rounded-xl hover:scale-105 transition-all shadow-md shadow-[#FF007A]/10"
                      >
                        Sözleşme İmzala
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-zinc-500 font-mono text-xs">Aradığınız kriterlere uygun oyuncu bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selling Excess / Budget Adjusting List */}
      <div className="lg:col-span-4 bg-zinc-900/90 border border-zinc-800 p-5 rounded-3xl flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Kadro Satış Paneli</h3>
          <p className="text-xs text-zinc-500 mt-1">Kulübünüze ek gelir getirmek ve bütçeyi korumak amacıyla satabileceğiniz oyuncu listesi.</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-1">
          {squad.filter(p => !p.isStarting).length > 0 ? (
            squad.filter(p => !p.isStarting).map((player) => (
              <div 
                key={player.id} 
                className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/60 flex justify-between items-center text-xs group hover:border-red-500/20 transition-all"
              >
                <div>
                  <p className="font-semibold text-zinc-200">{player.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">{player.position} OVR:{player.rating} • Değer: <span className="text-emerald-400 font-bold">{formatMoney(player.value)}</span></p>
                </div>
                <button
                  onClick={() => handleSell(player)}
                  title="Serbest Bırak / Kulüpten Sat"
                  className="p-2 ml-2 bg-red-950/20 hover:bg-red-950 border border-red-900/30 hover:border-red-600 rounded-xl text-rose-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-600 text-center py-6 font-mono font-medium">Satılabilecek yedek oyuncu bulunmuyor. İlk 11 oyuncularını satabilmek için önce onları kadroda yedeğe çekin.</p>
          )}
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800 p-3.5 rounded-2xl space-y-2 text-[10px] text-zinc-400 font-mono">
          <p className="font-bold text-[#FF007A] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Transfer Kuralları:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Kadro derinliği en az 15, en fazla 25 oyuncu olmalıdır.</li>
            <li>İlk 11 oyuncuları kulüpten doğrudan bu panelden satılamaz.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
