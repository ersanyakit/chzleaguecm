import React from 'react';
import { TrainingAllocation, Player } from '../types';
import { Sparkles, Dumbbell, Shield, Award, Sparkle, Settings2 } from 'lucide-react';

interface TrainingTabProps {
  allocation: TrainingAllocation;
  squad: Player[];
  onUpdateAllocation: (updated: TrainingAllocation) => void;
}

export default function TrainingTab({ allocation, squad, onUpdateAllocation }: TrainingTabProps) {

  const handleSliderChange = (key: keyof TrainingAllocation, value: number) => {
    const updated = { ...allocation, [key]: value };
    
    // Check total and auto-scale other values proportional or simply calculate remaining
    const sum = Object.keys(updated).reduce((acc, k) => acc + (updated[k as keyof TrainingAllocation] || 0), 0);
    
    onUpdateAllocation(updated);
  };

  const autoBalance = () => {
    onUpdateAllocation({
      fitness: 20,
      tactical: 20,
      defense: 20,
      attacking: 20,
      goalkeeping: 20
    });
  };

  // Sum total allocation
  const totalAlloc = Object.values(allocation).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="training-tab-view">
      {/* Training Sliders Control Panel */}
      <div className="lg:col-span-7 bg-zinc-950/40 p-6 rounded-3xl border border-zinc-800 backdrop-blur-md flex flex-col justify-between">
        <div className="space-y-5">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-805">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-[#FF007A]" /> Antrenman Programı
            </h2>
            <button
              onClick={autoBalance}
              type="button"
              className="text-xs text-zinc-400 font-mono hover:text-[#FF007A] transition-all flex items-center gap-1 hover:underline"
            >
              <Settings2 className="w-3.5 h-3.5" /> Eşit Dağıt (%20)
            </button>
          </div>

          <p className="text-xs text-zinc-500 font-mono leading-relaxed">
            Haftalık antrenman bütçesi toplamı tam olarak <span className="font-bold text-zinc-300">%100</span> olmalıdır. Antrenman odağınız oyuncuların gelişim gelişimlerini ve toparlanma hızlarını doğrudan etkiler.
          </p>

          <div className="space-y-4">
            {/* Fitness Slider */}
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#FF007A] rounded-full" /> Kondisyon & Stamina (Fitness)
                </span>
                <span className="text-[#FF007A] font-bold">%{allocation.fitness}</span>
              </div>
              <input
                type="range" min="0" max="60"
                value={allocation.fitness}
                onChange={(e) => handleSliderChange('fitness', parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FF007A]"
              />
              <p className="text-[10px] text-zinc-500 font-mono">Maç sonrası toparlanmayı hızlandırır, kondisyon eksiğini azaltır.</p>
            </div>

            {/* Tactical Slider */}
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" /> Taktiksel Odak (Pas & Pozisyon)
                </span>
                <span className="text-violet-400 font-bold">%{allocation.tactical}</span>
              </div>
              <input
                type="range" min="0" max="50"
                value={allocation.tactical}
                onChange={(e) => handleSliderChange('tactical', parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
              />
              <p className="text-[10px] text-zinc-500 font-mono">Oyuncuların pas yapma, oyun kurma, vizyon ve karar verme yeteneklerini parlatır.</p>
            </div>

            {/* Defense Slider */}
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" /> Savunma Çalışması (Defending)
                </span>
                <span className="text-blue-400 font-bold">%{allocation.defense}</span>
              </div>
              <input
                type="range" min="0" max="50"
                value={allocation.defense}
                onChange={(e) => handleSliderChange('defense', parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
              <p className="text-[10px] text-zinc-500 font-mono">Defans oyuncularının kademe, top çalma ve fiziki dayanıklılık yeteneklerini artırır.</p>
            </div>

            {/* Attacking Slider */}
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Hücum & Bitiricilik (Attacking)
                </span>
                <span className="text-amber-400 font-bold">%{allocation.attacking}</span>
              </div>
              <input
                type="range" min="0" max="50"
                value={allocation.attacking}
                onChange={(e) => handleSliderChange('attacking', parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <p className="text-[10px] text-zinc-500 font-mono">Forvetlerin ceza sahası bitiriciliğini, şut isabetini ve hızı tetikler.</p>
            </div>

            {/* Goalkeeping Slider */}
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-teal-400 rounded-full" /> Kalecilik Eğitimi
                </span>
                <span className="text-teal-400 font-bold">%{allocation.goalkeeping}</span>
              </div>
              <input
                type="range" min="0" max="40"
                value={allocation.goalkeeping}
                onChange={(e) => handleSliderChange('goalkeeping', parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <p className="text-[10px] text-zinc-500 font-mono">Kalecinizin kurtarış yapma kabiliyetini ve reflekslerini optimize eder.</p>
            </div>
          </div>
        </div>

        {/* Dynamic validation indicator (Uniswap-style token meter) */}
        <div className={`mt-5 p-3 px-5 rounded-2xl border flex justify-between items-center text-xs font-mono font-bold ${
          totalAlloc === 100 
            ? 'bg-emerald-950/20 border-emerald-500/15 text-emerald-400' 
            : 'bg-red-950/20 border-red-500/15 text-rose-400'
        }`}>
          <span>Toplam Atama Durumu:</span>
          <span>%{totalAlloc} / %100</span>
        </div>
      </div>

      {/* Roster Current Stats View Panels */}
      <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-801 p-6 rounded-3xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-yellow-400" /> Yıldız Oyuncuların Gelişim Grafiği
          </h3>
          <p className="text-xs text-zinc-500 mt-1">Antrenman disipliniyle OVR ratinglerini en çok yükseltmeye meyilli oyuncular.</p>
        </div>

        <div className="space-y-3 font-mono">
          {squad.sort((a,b)=>b.rating - a.rating).slice(0, 5).map((player) => (
            <div key={player.id} className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/50 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                <span>{player.name}</span>
                <span className="text-[#FF007A]">OVR {player.rating}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-zinc-500">
                <span>Pozisyon: {player.position}</span>
                <span className="text-emerald-400 bg-emerald-400/10 px-1.5 rounded-md py-0.5 font-bold flex items-center gap-0.5">
                  <Sparkle className="w-2.5 h-2.5" /> Gelişmeye Açık
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
