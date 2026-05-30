import React, { useState } from 'react';
import { Mail, Player } from '../types';
import { Mail as MailIcon, MailOpen, Trash2, Award, Zap, Heart, AlertTriangle, Sparkles, Wand2 } from 'lucide-react';

interface InboxTabProps {
  inbox: Mail[];
  week: number;
  squad: Player[];
  onReadMail: (mailId: string) => void;
  onDeleteMail: (mailId: string) => void;
}

export default function InboxTab({ inbox, week, squad, onReadMail, onDeleteMail }: InboxTabProps) {
  const [activeMail, setActiveMail] = useState<Mail | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);

  const handleSelectMail = (mail: Mail) => {
    setActiveMail(mail);
    onReadMail(mail.id);
  };

  // Trigger Gemini AI advisor feedback from server
  const handleGetAiAdvice = async () => {
    if (!activeMail) return;
    setIsGeneratingAdvice(true);
    setAiAdvice(null);
    
    try {
      // Simulate/request dynamic tactical advice review
      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchDetails: {
            homeTeam: "Senin Takımın",
            awayTeam: activeMail.sender,
            type: "E-posta Analizi",
            homeScore: 0,
            awayScore: 0,
            scorers: [],
            events: [activeMail.subject],
            homeShots: 10,
            awayShots: 10,
            homePos: 50,
            awayPos: 50,
            managedTeam: "Senin Takımın",
            managedTeamScore: 0,
            opponentTeam: activeMail.sender,
            opponentTeamScore: 0
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiAdvice(data.report || "AI Danışmanınız durumu inceledi ve başarılı analizler çıkardı!");
      } else {
        throw new Error("HTTP error");
      }
    } catch (err) {
      // Fallback local robust generation
      setTimeout(() => {
        const lowMoralPlayers = squad.filter(p => p.morale < 70).map(p => p.name);
        const lowStaminaPlayers = squad.filter(p => p.fitness < 80).map(p => p.name);
        
        let report = `Sayın Menajer, e-posta içeriğinizi ve takım yapınızı detaylıca inceledim.\n\n`;
        
        if (activeMail.type === 'MEDICAL') {
          report += `Sakatlık problemi kadro düzenimizi sarsabilir. Antrenman programında 'Kondisyon (Fitness)' bütçesini %35'e çekerek diğer oyuncuların aşırı yüklenmesini önlemenizi şiddetle tavsiye ederim.`;
        } else if (activeMail.type === 'SCOUT') {
          report += `Görünen o ki scout ekibimiz geniş bir liste hazırlamış. Yeni oyuncu almadan önce bütçe optimizasyonu için verimsiz yedekleri transfer listesine koymak akıllıca olacaktır.`;
        } else {
          if (lowStaminaPlayers.length > 0) {
            report += `Kadroda ${lowStaminaPlayers[0]} gibi kritik oyuncuların kondisyon seviyeleri çok düşük (%80 altı). Onları sonraki maçta yedek kulübesinde başlatıp dinlendirmek taktik bütünlük için elzemdir.`;
          } else if (lowMoralPlayers.length > 0) {
            report += `Kadroda ${lowMoralPlayers[0]} gibi oyuncuların moralleri düşük görünüyor. Onları ilk 11'e alarak veya antrenman dozunu esneterek takıma kazandırabilirsiniz.`;
          } else {
            report += `Mevcut kadronun taktik uyumu (%${Math.round(squad.filter(p=>p.isStarting).reduce((acc, p)=>acc+p.rating,0)/11)} OVR) oldukça ideal. Pas stili TİKİ-TAKA olarak belirlenip kısa paslarla rakip sahada egemenlik kurulabilir.`;
          }
        }
        setAiAdvice(report);
      }, 500);
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const getMailTagDetails = (type: Mail['type']) => {
    switch (type) {
      case 'NEWS': return { label: 'Basın', bg: 'bg-indigo-505/10 text-indigo-400 border-indigo-400/20' };
      case 'BOARD': return { label: 'Yönetim', bg: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
      case 'SCOUT': return { label: 'Scout', bg: 'bg-purple-500/10 text-purple-400 border-purple-400/20' };
      case 'MEDICAL': return { label: 'Sağlık', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      default: return { label: 'Haber', bg: 'bg-zinc-800 text-zinc-400 border-zinc-700/50' };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="inbox-tab-view">
      {/* Mail List */}
      <div className="lg:col-span-5 bg-zinc-950/40 rounded-3xl border border-zinc-800 backdrop-blur-md flex flex-col h-[520px] overflow-hidden">
        <div className="p-4 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/10">
          <span className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <MailIcon className="w-4 h-4 text-[#FF007A]" /> Menajerlik Postası (Hafta {week})
          </span>
          <span className="text-[10px] font-mono text-zinc-500 font-bold bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
            {inbox.length} E-posta
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/40">
          {inbox.length > 0 ? (
            inbox.map((mail, idx) => {
              const tag = getMailTagDetails(mail.type);
              const isSelected = activeMail?.id === mail.id;
              
              return (
                <div
                  key={mail.id ? `${mail.id}_${idx}` : idx}
                  onClick={() => handleSelectMail(mail)}
                  className={`p-4 cursor-pointer hover:bg-zinc-900/30 transition-all flex flex-col gap-1.5 relative ${isSelected ? 'bg-zinc-900/45 border-l-2 border-l-[#FF007A]' : ''} ${!mail.read ? 'bg-zinc-900/15' : ''}`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-semibold text-xs text-zinc-200 truncate group-hover:text-[#FF007A] transition-colors">{mail.sender}</span>
                    <span className="text-[9px] font-mono text-zinc-500 shrink-0">Hafta {mail.weekReceived}</span>
                  </div>
                  <h4 className={`text-xs truncate ${!mail.read ? 'text-[#FF007A] font-bold' : 'text-zinc-300'}`}>
                    {mail.subject}
                  </h4>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{mail.content}</p>

                  <div className="flex justify-between items-center mt-1">
                    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-lg ${tag.bg}`}>
                      {tag.label}
                    </span>
                    {!mail.read && (
                      <span className="w-1.5 h-1.5 bg-[#FF007A] rounded-full animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <MailOpen className="w-10 h-10 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500 font-mono">Gelen kutunuz bomboş.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mail Active Reader */}
      <div className="lg:col-span-7 flex flex-col h-[520px]">
        {activeMail ? (
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-3xl border border-zinc-805/90 shadow-2xl p-6 flex flex-col h-full overflow-hidden text-sm relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF007A]/5 rounded-full blur-3xl pointer-events-none" />

            {/* Mail Header */}
            <div className="border-b border-zinc-800/80 pb-4 mb-4 flex justify-between items-start gap-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-zinc-500">Gönderen:</span>
                <h3 className="text-sm font-bold text-zinc-100">{activeMail.sender}</h3>
                <h2 className="text-base font-semibold text-[#FF007A] leading-tight mt-1">{activeMail.subject}</h2>
              </div>
              <button 
                onClick={() => {
                  onDeleteMail(activeMail.id);
                  setActiveMail(null);
                  setAiAdvice(null);
                }}
                className="p-2 bg-zinc-950 border border-zinc-800/60 text-zinc-500 hover:text-rose-400 hover:border-red-950 hover:bg-red-950/20 rounded-xl transition-all cursor-pointer shrink-0"
                title="E-postayı Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Mail Body Paragraphs */}
            <div className="flex-1 overflow-y-auto text-zinc-300 font-mono text-xs leading-relaxed space-y-3 pr-1">
              {activeMail.content.split('\n\n').map((p, index) => (
                <p key={index}>{p}</p>
              ))}

              {/* Dynamic AI Advisor Section (Gemini integration trigger button) */}
              <div className="mt-8 border-t border-zinc-800/80 pt-5 space-y-4">
                <div className="flex justify-between items-center bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800">
                  <span className="text-zinc-400 font-bold text-[11px] flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF007A] animate-pulse" /> Gemini AI Taktiksel Danışman Önersi
                  </span>
                  
                  <button
                    disabled={isGeneratingAdvice}
                    onClick={handleGetAiAdvice}
                    className="p-2 px-3 bg-gradient-to-r from-violet-600 to-[#FF007A] text-white font-bold text-[10px] uppercase tracking-wide rounded-xl hover:scale-[1.01] transition-all disabled:opacity-40"
                  >
                    {isGeneratingAdvice ? (
                      <span className="flex items-center gap-1">İnceleniyor...</span>
                    ) : (
                      <span className="flex items-center gap-1"><Wand2 className="w-3.5 h-3.5" /> Akıllı Yorum Yazdır</span>
                    )}
                  </button>
                </div>

                {/* AI Advice Output Container */}
                {aiAdvice && (
                  <div className="p-4 bg-zinc-950 border border-violet-500/15 rounded-2xl shadow-inner relative text-violet-300 space-y-2 text-xs">
                    <div className="flex items-center gap-1 font-bold text-violet-400 uppercase tracking-wider text-[10px] border-b border-violet-500/10 pb-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#FF007A]" /> AI Koç Analiz Raporu:
                    </div>
                    <div className="leading-relaxed font-mono whitespace-pre-line text-zinc-300">
                      {aiAdvice}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-zinc-800/50 p-8 rounded-3xl text-center flex flex-col items-center justify-center h-full">
            <MailIcon className="w-12 h-12 text-zinc-800 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-300">İçerik Seçilmedi</h3>
            <p className="text-xs text-zinc-500 max-w-[240px] mt-1.5">Maddeleri, taraftar mektuplarını veya raporları okumak için soldan bir e-posta seçin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
