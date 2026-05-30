import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Club } from '../types';

interface BroadcastBannerProps {
  fxState: {
    type: 'GOAL' | 'SAVE' | 'MISS' | 'CARD' | 'RED_CARD' | 'FOUL' | 'INJURY' | 'NONE';
    text?: string;
    team?: 'home' | 'away';
    x?: number;
    y?: number;
  } | null;
  homeClub: Club;
  awayClub: Club;
}

export default function BroadcastBanner({ fxState, homeClub, awayClub }: BroadcastBannerProps) {
  if (!fxState || !fxState.text) return null;

  const { type, text, team } = fxState;
  const activeClub = team === 'home' ? homeClub : team === 'away' ? awayClub : null;

  // Determine elegant television visual theme setups
  let badgeColor = 'bg-[#FF007A]';
  let textHighlight = 'text-[#FF007A]';
  let titleText = 'CANLI MAÇ MERKEZİ';
  let glowColor = 'shadow-[#FF007A]/15';
  let animationType: 'GOAL' | 'CARD' | 'ALERT' = 'ALERT';

  if (type === 'GOAL') {
    animationType = 'GOAL';
    badgeColor = 'bg-rose-600';
    textHighlight = 'text-rose-400';
    titleText = 'GOL • SKOR DEĞİŞTİ';
    glowColor = 'shadow-rose-600/35';
  } else if (type === 'CARD' || type === 'RED_CARD') {
    animationType = 'CARD';
    badgeColor = type === 'RED_CARD' ? 'bg-red-600' : 'bg-yellow-500';
    textHighlight = type === 'RED_CARD' ? 'text-red-400' : 'text-yellow-400';
    titleText = type === 'RED_CARD' ? 'KIRMIZI KART • İHRAÇ' : 'HAKEM • SARI KART';
    glowColor = type === 'RED_CARD' ? 'shadow-red-600/35' : 'shadow-yellow-500/25';
  } else if (type === 'SAVE') {
    badgeColor = 'bg-cyan-500';
    textHighlight = 'text-cyan-400';
    titleText = 'REAKSİYON • KURTARIŞ';
    glowColor = 'shadow-cyan-500/25';
  } else if (type === 'INJURY') {
    badgeColor = 'bg-amber-600';
    textHighlight = 'text-amber-400';
    titleText = 'MEDİKAL SAKATLIK';
    glowColor = 'shadow-amber-600/25';
  } else if (type === 'MISS') {
    badgeColor = 'bg-slate-500';
    textHighlight = 'text-slate-400';
    titleText = 'KAÇAN FIRSAT • OUT';
    glowColor = 'shadow-slate-500/10';
  }

  // Strip prefix for clear elegant view
  const cleanDesc = text
    .replace(/GOOOL!\s*/ig, '')
    .replace(/GOOOL\s*/ig, '')
    .replace(/Sarı Kart:\s*/ig, '')
    .replace(/Kırmızı Kart:\s*/ig, '')
    .replace(/Sakatlandı!\s*/ig, '');

  return (
    <AnimatePresence>
      <div className="absolute left-4 top-14 pointer-events-none z-50 flex items-start justify-start">
        
        {/* 1. SEAMLESS GLASSY TRANSPARENT COMPACT GOAL HUD */}
         {animationType === 'GOAL' && (
          <motion.div
            initial={{ x: -250, opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: -250, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="w-72 sm:w-80 bg-zinc-950/90 backdrop-blur-md rounded-2xl border border-rose-500/70 p-3 flex flex-col gap-2 shadow-lg relative overflow-hidden pointer-events-auto"
            style={{ boxShadow: '0 4px 20px rgba(225, 29, 72, 0.25)' }}
          >
            {/* Elegant horizontal status top bar */}
            <div className="absolute top-0 inset-x-0 h-0.5 bg-rose-500" />
            
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
                className="w-7 h-7 bg-gradient-to-tr from-rose-600 to-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none shadow"
              >
                ⚽
              </motion.div>

              <div>
                <span className="px-1.5 py-0.2 bg-rose-500/15 border border-rose-500/30 rounded text-[7px] font-mono font-black tracking-widest text-rose-300 uppercase animate-pulse leading-none">
                  {titleText}
                </span>
                <h2 className="text-sm font-black tracking-tight text-white uppercase mt-0.5 leading-none shadow-sm">
                  G O O O L !
                </h2>
              </div>
            </div>

            {/* Scorer Player Name Text and Team badge */}
            <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-850 px-2.5 py-1.5 rounded-lg">
              {activeClub && (
                <img 
                  src={activeClub.badge} 
                  alt={activeClub.name} 
                  className="w-5 h-5 object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="min-w-0">
                <p className="text-[8px] text-zinc-400 font-mono font-bold uppercase truncate leading-none">{activeClub?.name || 'TAKIM'}</p>
                <p className="text-[11px] font-black text-rose-400 mt-0.5 font-sans leading-tight truncate">{cleanDesc || 'Oyuncu'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. REFEREE COMPACT CARD OVERLAY */}
        {animationType === 'CARD' && (
          <motion.div
            initial={{ x: -250, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -250, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className={`w-64 sm:w-72 bg-zinc-950/90 backdrop-blur-md rounded-xl border border-${type === 'RED_CARD' ? 'red-500/50' : 'yellow-500/50'} p-2.5 flex items-center gap-2.5 shadow-lg relative overflow-hidden pointer-events-auto`}
            style={{ boxShadow: `0 4px 16px rgba(${type === 'RED_CARD' ? '239,68,68' : '234,179,8'}, 0.15)` }}
          >
            {/* Visual Red/Yellow Card Shape */}
            <div className={`w-5 h-7 shrink-0 rounded flex items-center justify-center font-bold text-[10px] border ${type === 'RED_CARD' ? 'bg-red-500 border-red-400' : 'bg-yellow-400 border-yellow-300'} shadow-sm`}>
              {type === 'RED_CARD' ? '🟥' : '🟨'}
            </div>

            <div className="flex-1 min-w-0">
              <span className={`text-[7px] font-mono font-black tracking-widest uppercase block ${textHighlight} leading-none`}>
                {titleText}
              </span>
              <h3 className="text-[11px] font-black text-zinc-100 font-sans truncate mt-0.5 leading-none">
                {cleanDesc}
              </h3>
              <div className="flex items-center gap-1 mt-1 leading-none">
                {activeClub && (
                  <img src={activeClub.badge} alt={activeClub.name} className="w-3.5 h-3.5 object-contain shrink-0" referrerPolicy="no-referrer" />
                )}
                <span className="text-[8px] text-zinc-400 font-mono font-bold uppercase truncate">{activeClub?.name}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* 3. NORMAL COMMENTARY ALERT GLASSY HUD */}
        {animationType === 'ALERT' && (
          <motion.div
            initial={{ x: -250, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -250, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="w-64 sm:w-72 bg-zinc-950/90 backdrop-blur-md rounded-xl border border-zinc-800 p-2.5 flex items-center gap-2 shadow-lg relative pointer-events-auto"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
          >
            {/* Accent Glowing Color Left Bar */}
            <div className={`w-1 h-6 rounded-full shrink-0 ${badgeColor}`} />

            <div className="flex-1 min-w-0 leading-none">
              <div className="flex items-center gap-1">
                <span className={`text-[7px] font-mono font-black tracking-widest uppercase ${textHighlight}`}>
                  {titleText}
                </span>

                {activeClub && (
                  <span className="inline-flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded text-[7px] font-mono text-zinc-400">
                    {activeClub.shortName}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-zinc-100 mt-1 truncate font-sans">
                {cleanDesc}
              </p>
            </div>
          </motion.div>
        )}

      </div>
    </AnimatePresence>
  );
}
