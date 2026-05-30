import React from 'react';
import { LeagueStanding, Club, Player } from '../types';
import { Trophy, Award, Activity, Sparkles, TrendingUp } from 'lucide-react';

interface StandingsTabProps {
  standings: LeagueStanding[];
  teams: Club[];
  managedTeamId: string;
  allPlayers: Player[]; // sorted globally
}

export default function StandingsTab({ standings, teams, managedTeamId, allPlayers }: StandingsTabProps) {
  
  // Find top goal scorers across all loaded players
  const topScorers = [...allPlayers]
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.appearances - b.appearances)
    .slice(0, 5);

  // Find top assist makers
  const topAssisters = [...allPlayers]
    .filter(p => p.assists > 0)
    .sort((a, b) => b.assists - a.assists || a.appearances - b.appearances)
    .slice(0, 5);

  // Find top averaged match ratings
  const topRated = [...allPlayers]
    .filter(p => p.appearances >= 1)
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="standings-tab-view">
      {/* League Table Standings */}
      <div className="lg:col-span-8 bg-zinc-950/40 p-5 rounded-3xl border border-zinc-800 backdrop-blur-md">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Lig Puan Tablosu
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/60 pb-2 text-zinc-500 font-mono text-xs">
                <th className="py-2.5 pl-2 text-center w-12">Sıra</th>
                <th className="py-2.5">Kulüp</th>
                <th className="py-2.5 text-center w-12">OM</th>
                <th className="py-2.5 text-center w-10">G</th>
                <th className="py-2.5 text-center w-10">B</th>
                <th className="py-2.5 text-center w-10">M</th>
                <th className="py-2.5 text-center w-14">AG-YG</th>
                <th className="py-2.5 text-center w-12">AV</th>
                <th className="py-2.5 text-center font-bold w-14">PUAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {standings.map((row, idx) => {
                const teamClub = teams.find(t => t.id === row.teamId);
                const isManaged = row.teamId === managedTeamId;

                // Color lines for promotions vs relegations
                let rankBorder = 'border-l-transparent';
                if (idx < 2) rankBorder = 'border-l-2 border-l-emerald-400'; // Direct Promotion
                else if (idx >= 2 && idx < 6) rankBorder = 'border-l-2 border-l-blue-400'; // Play-offs
                else if (idx >= standings.length - 3) rankBorder = 'border-l-2 border-l-rose-500'; // Relegation zone

                return (
                  <tr 
                    key={row.teamId}
                    className={`hover:bg-zinc-900/40 transition-colors duration-150 ${isManaged ? 'bg-[#FF007A]/10 font-medium' : ''}`}
                  >
                    <td className={`py-3 pl-2 text-center font-mono text-xs ${rankBorder}`}>
                      {idx + 1}
                    </td>
                    <td className="py-3 flex items-center gap-2.5">
                      {teamClub?.badge ? (
                        <img 
                          src={teamClub.badge} 
                          alt={row.teamName} 
                          className="w-5 h-5 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center font-mono text-[9px]">
                          {row.teamName.substring(0, 3)}
                        </div>
                      )}
                      <span className={`${isManaged ? 'text-zinc-500 font-bold' : 'text-zinc-200'}`}>
                        {row.teamName}
                        {isManaged && <span className="ml-1.5 text-[9px] bg-[#FF007A] text-white px-1 py-0.5 rounded uppercase font-bold font-mono">SEN</span>}
                      </span>
                    </td>
                    <td className="py-3 text-center text-zinc-300 font-mono">{row.played}</td>
                    <td className="py-3 text-center text-zinc-400 font-mono">{row.won}</td>
                    <td className="py-3 text-center text-zinc-400 font-mono">{row.drawn}</td>
                    <td className="py-3 text-center text-zinc-400 font-mono">{row.lost}</td>
                    <td className="py-3 text-center text-zinc-500 font-mono text-xs">{row.goalsFor}-{row.goalsAgainst}</td>
                    <td className={`py-3 text-center text-xs font-mono font-bold ${row.goalDifference > 0 ? 'text-emerald-500' : row.goalDifference < 0 ? 'text-rose-500' : 'text-zinc-500'}`}>
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                    <td className={`py-3 text-center font-mono font-bold text-sm ${isManaged ? 'text-[#FF007A]' : 'text-zinc-100'}`}>
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Player Stats Side Bento Lists */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Top Scorers Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-3xl space-y-3">
          <h3 className="text-xs font-mono font-bold text-[#FF007A] uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Gol Krallığı
          </h3>
          {topScorers.length > 0 ? (
            <div className="space-y-2">
              {topScorers.map((player, index) => (
                <div key={player.id} className="flex justify-between items-center text-xs py-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-mono font-bold bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500">{index + 1}</span>
                    <div className="truncate">
                      <p className="font-semibold text-zinc-200 truncate">{player.name}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#FF007A] shrink-0 bg-[#FF007A]/10 px-2 py-0.5 rounded-full">{player.goals} Gol</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-2 font-mono">Lig henüz başlamadı veya hiç gol atılmadı.</p>
          )}
        </div>

        {/* Top Assists Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-3xl space-y-3">
          <h3 className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <Award className="w-3.5 h-3.5" /> Asist Krallığı
          </h3>
          {topAssisters.length > 0 ? (
            <div className="space-y-2">
              {topAssisters.map((player, index) => (
                <div key={player.id} className="flex justify-between items-center text-xs py-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-mono font-bold bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500">{index + 1}</span>
                    <div className="truncate">
                      <p className="font-semibold text-zinc-200 truncate">{player.name}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-violet-400 shrink-0 bg-violet-400/10 px-2 py-0.5 rounded-full">{player.assists} Asist</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-2 font-mono">Henüz assist istatistiği bulunmuyor.</p>
          )}
        </div>

        {/* Performance Top Rated Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-3xl space-y-3">
          <h3 className="text-xs font-mono font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> En Yüksek Dereceli Oyuncular
          </h3>
          {topRated.length > 0 ? (
            <div className="space-y-2">
              {topRated.map((player, index) => (
                <div key={player.id} className="flex justify-between items-center text-xs py-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-mono font-bold bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500">{index + 1}</span>
                    <p className="font-semibold text-zinc-200 truncate">{player.name}</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-yellow-400 shrink-0 bg-yellow-400/10 px-2 py-0.5 rounded-full">{player.avgRating.toFixed(2)} OVR</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-2 font-mono">Henüz hiçbir oyuncunun puanı hesaplanmadı.</p>
          )}
        </div>
      </div>
    </div>
  );
}
