import { MatchEventType } from '../types';

export type MatchEventCategory =
  | 'match_state'
  | 'restart'
  | 'possession'
  | 'duel'
  | 'defense'
  | 'attack'
  | 'goalkeeper'
  | 'discipline'
  | 'injury'
  | 'tactical'
  | 'review';

export interface MatchEventDefinition {
  type: MatchEventType;
  label: string;
  category: MatchEventCategory;
  commentary: string;
}

export const MATCH_EVENT_DEFINITIONS: MatchEventDefinition[] = [
  { type: 'KICK_OFF', label: 'Santra', category: 'match_state', commentary: '{player} oyunu başlatıyor.' },
  { type: 'HALF_TIME', label: 'Devre Arası', category: 'match_state', commentary: 'İlk yarı sona erdi.' },
  { type: 'SECOND_HALF_START', label: 'İkinci Yarı', category: 'match_state', commentary: 'İkinci yarı başladı.' },
  { type: 'FULL_TIME', label: 'Son Düdük', category: 'match_state', commentary: 'Maç sona erdi.' },
  { type: 'ADDED_TIME_ANNOUNCED', label: 'Uzatma', category: 'match_state', commentary: 'Dördüncü hakem uzatma süresini gösterdi.' },
  { type: 'STOPPAGE', label: 'Oyun Durdu', category: 'match_state', commentary: 'Hakem oyunu durdurdu.' },
  { type: 'BALL_OUT', label: 'Top Dışarıda', category: 'restart', commentary: 'Top oyun alanını terk etti.' },
  { type: 'BALL_IN_PLAY', label: 'Top Oyunda', category: 'restart', commentary: 'Top yeniden oyunda.' },
  { type: 'DROP_BALL', label: 'Hakem Atışı', category: 'restart', commentary: 'Oyun hakem atışıyla başlıyor.' },
  { type: 'THROW_IN_AWARDED', label: 'Taç Kararı', category: 'restart', commentary: '{player} taç atışını kullanacak.' },
  { type: 'PLAYER_TAKES_BALL_FOR_THROW', label: 'Taç Hazırlığı', category: 'restart', commentary: '{player} topu eline aldı.' },
  { type: 'THROW_IN_TAKEN', label: 'Taç Kullanıldı', category: 'restart', commentary: '{player} taç atışını kullandı.' },
  { type: 'LONG_THROW', label: 'Uzun Taç', category: 'restart', commentary: '{player} ceza sahasına uzun taç gönderdi.' },
  { type: 'CORNER_AWARDED', label: 'Korner Kararı', category: 'restart', commentary: '{player} korneri kullanacak.' },
  { type: 'PLAYER_PLACES_BALL_CORNER', label: 'Korner Hazırlığı', category: 'restart', commentary: '{player} topu korner yayına yerleştirdi.' },
  { type: 'CORNER_TAKEN', label: 'Korner Kullanıldı', category: 'restart', commentary: '{player} korneri kullandı.' },
  { type: 'SHORT_CORNER', label: 'Kısa Korner', category: 'restart', commentary: '{player} kısa korner organizasyonunu başlattı.' },
  { type: 'GOAL_KICK_AWARDED', label: 'Kale Vuruşu Kararı', category: 'restart', commentary: '{player} kale vuruşunu kullanacak.' },
  { type: 'GOALKEEPER_PLACES_BALL', label: 'Kale Vuruşu Hazırlığı', category: 'restart', commentary: '{player} topu altıpas içine yerleştirdi.' },
  { type: 'GOAL_KICK_TAKEN', label: 'Kale Vuruşu Kullanıldı', category: 'restart', commentary: '{player} kale vuruşunu kullandı.' },
  { type: 'FREE_KICK_AWARDED', label: 'Serbest Vuruş Kararı', category: 'restart', commentary: '{player} serbest vuruşu kullanacak.' },
  { type: 'PLAYER_STANDS_OVER_FREE_KICK', label: 'Frikik Hazırlığı', category: 'restart', commentary: '{player} topun başına geçti.' },
  { type: 'FREE_KICK_TAKEN', label: 'Serbest Vuruş Kullanıldı', category: 'restart', commentary: '{player} serbest vuruşu kullandı.' },
  { type: 'PENALTY_AWARDED', label: 'Penaltı Kararı', category: 'restart', commentary: 'Hakem penaltı noktasını gösterdi.' },
  { type: 'PLAYER_STANDS_OVER_PENALTY', label: 'Penaltı Hazırlığı', category: 'restart', commentary: '{player} penaltı için topun başına geçti.' },
  { type: 'PENALTY_TAKEN', label: 'Penaltı Kullanıldı', category: 'restart', commentary: '{player} penaltıyı kullandı.' },
  { type: 'PENALTY_MISS', label: 'Penaltı Kaçtı', category: 'restart', commentary: '{player} penaltıdan yararlanamadı.' },
  { type: 'OFFSIDE', label: 'Ofsayt', category: 'restart', commentary: '{player} ofsayta yakalandı.' },
  { type: 'PASS', label: 'Pas', category: 'possession', commentary: '{player} pasını oynadı.' },
  { type: 'KEY_PASS', label: 'Anahtar Pas', category: 'possession', commentary: '{player} savunma arasına anahtar pas attı.' },
  { type: 'THROUGH_BALL', label: 'Ara Pası', category: 'possession', commentary: '{player} savunma arkasına ara pası denedi.' },
  { type: 'CROSS', label: 'Orta', category: 'possession', commentary: '{player} ceza sahasına orta yaptı.' },
  { type: 'FIRST_TOUCH', label: 'İlk Kontrol', category: 'possession', commentary: '{player} topu ilk dokunuşta kontrol etti.' },
  { type: 'CONTROL', label: 'Kontrol', category: 'possession', commentary: '{player} topu kontrol altına aldı.' },
  { type: 'CARRY', label: 'Top Taşıma', category: 'possession', commentary: '{player} topu taşıyor.' },
  { type: 'DRIBBLE', label: 'Dripling', category: 'possession', commentary: '{player} driplinge kalktı.' },
  { type: 'TURNOVER', label: 'Top Kaybı', category: 'possession', commentary: '{player} topu kaybetti.' },
  { type: 'BALL_RECOVERY', label: 'Top Kazanma', category: 'possession', commentary: '{player} topu takımına kazandırdı.' },
  { type: 'PRESSURE', label: 'Pres', category: 'possession', commentary: '{player} baskıyı kurdu.' },
  { type: 'DUEL', label: 'İkili Mücadele', category: 'duel', commentary: '{player} ikili mücadeleye girdi.' },
  { type: 'AERIAL_DUEL', label: 'Hava Topu', category: 'duel', commentary: '{player} hava topuna çıktı.' },
  { type: 'LOOSE_BALL', label: 'Boşta Top', category: 'duel', commentary: 'Top boşta kaldı.' },
  { type: 'SECOND_BALL_WON', label: 'İkinci Top', category: 'duel', commentary: '{player} ikinci topu kazandı.' },
  { type: 'TACKLE', label: 'Müdahale', category: 'defense', commentary: '{player} müdahaleyi yaptı.' },
  { type: 'INTERCEPTION', label: 'Araya Girme', category: 'defense', commentary: '{player} pas arasına girdi.' },
  { type: 'CLEARANCE', label: 'Uzaklaştırma', category: 'defense', commentary: '{player} topu uzaklaştırdı.' },
  { type: 'BLOCK', label: 'Blok', category: 'defense', commentary: '{player} topun önüne set çekti.' },
  { type: 'BIG_CHANCE', label: 'Net Pozisyon', category: 'attack', commentary: '{player} net gol pozisyonuna girdi.' },
  { type: 'SHOT', label: 'Şut', category: 'attack', commentary: '{player} kaleyi denedi.' },
  { type: 'SHOT_ASSIST', label: 'Şut Pası', category: 'attack', commentary: '{player} doğrudan şut pası verdi.' },
  { type: 'HEADER', label: 'Kafa Vuruşu', category: 'attack', commentary: '{player} kafayı vurdu.' },
  { type: 'REBOUND', label: 'Seken Top', category: 'attack', commentary: '{player} seken topa hareketlendi.' },
  { type: 'GOAL', label: 'Gol', category: 'attack', commentary: '{player} topu ağlara gönderdi.' },
  { type: 'OWN_GOAL', label: 'Kendi Kalesine', category: 'attack', commentary: '{player} ters bir dokunuş yaptı.' },
  { type: 'GOAL_DISALLOWED', label: 'Gol İptal', category: 'attack', commentary: 'Gol geçerli değil.' },
  { type: 'SAVE', label: 'Kurtarış', category: 'goalkeeper', commentary: '{player} kurtarışı yaptı.' },
  { type: 'KEEPER_CATCH', label: 'Kaleci Tuttu', category: 'goalkeeper', commentary: '{player} topu kontrol etti.' },
  { type: 'KEEPER_PUNCH', label: 'Yumruklama', category: 'goalkeeper', commentary: '{player} topu yumrukladı.' },
  { type: 'KEEPER_ERROR', label: 'Kaleci Hatası', category: 'goalkeeper', commentary: '{player} hata yaptı.' },
  { type: 'FOUL', label: 'Faul', category: 'discipline', commentary: '{player} faul yaptı.' },
  { type: 'ADVANTAGE_PLAYED', label: 'Avantaj', category: 'discipline', commentary: 'Hakem avantajı oynattı.' },
  { type: 'HANDBALL', label: 'Elle Oynama', category: 'discipline', commentary: '{player} elle oynadı.' },
  { type: 'REFEREE_WARNING', label: 'Uyarı', category: 'discipline', commentary: 'Hakem {player} için uyarıda bulundu.' },
  { type: 'YELLOW_CARD', label: 'Sarı Kart', category: 'discipline', commentary: '{player} sarı kart gördü.' },
  { type: 'SECOND_YELLOW_RED', label: 'İkinci Sarı', category: 'discipline', commentary: '{player} ikinci sarıdan atıldı.' },
  { type: 'RED_CARD', label: 'Kırmızı Kart', category: 'discipline', commentary: '{player} kırmızı kart gördü.' },
  { type: 'DISSENT', label: 'İtiraz', category: 'discipline', commentary: '{player} hakeme itiraz etti.' },
  { type: 'TIME_WASTING', label: 'Zaman Geçirme', category: 'discipline', commentary: '{player} oyunu ağırdan aldı.' },
  { type: 'INJURY', label: 'Sakatlık', category: 'injury', commentary: '{player} yerde kaldı.' },
  { type: 'STAMINA_DROP', label: 'Yorgunluk', category: 'injury', commentary: '{player} yorgunluk sinyali veriyor.' },
  { type: 'SUBSTITUTION', label: 'Oyuncu Değişikliği', category: 'tactical', commentary: '{player} oyuna dahil oldu.' },
  { type: 'TACTIC_CHANGE', label: 'Taktik', category: 'tactical', commentary: 'Taktik ayar değişti.' },
  { type: 'MORALE_CHANGE', label: 'Moral', category: 'tactical', commentary: 'Moral dengesi değişti.' },
  { type: 'MOMENTUM_SHIFT', label: 'Momentum', category: 'tactical', commentary: 'Maçın momentumu değişti.' },
  { type: 'POSSESSION_CHANGE', label: 'Top El Değiştirdi', category: 'possession', commentary: 'Top el değiştirdi.' },
  { type: 'POSSESSION_RETAINED', label: 'Top Korundu', category: 'possession', commentary: 'Top aynı takımda kaldı.' },
  { type: 'SET_PIECE_ROUTINE', label: 'Duran Top Planı', category: 'tactical', commentary: 'Özel duran top organizasyonu denendi.' },
  { type: 'VAR_CHECK', label: 'VAR', category: 'review', commentary: 'VAR kontrolü başladı.' },
  { type: 'VAR_DECISION', label: 'VAR Sonucu', category: 'review', commentary: 'VAR kararı açıklandı.' },
  { type: 'COUNTER_ATTACK', label: 'Kontra Atak', category: 'attack', commentary: '{player} kontra atağı başlattı.' },
  { type: 'ATTACK_BUILDUP', label: 'Atak Kurulumu', category: 'attack', commentary: 'Atak olgunlaşıyor.' },
  { type: 'PENALTY_AREA_ENTRY', label: 'Ceza Sahası', category: 'attack', commentary: '{player} ceza sahasına girdi.' },
  { type: 'ONE_ON_ONE', label: 'Karşı Karşıya', category: 'attack', commentary: '{player} kaleciyle karşı karşıya.' },
  { type: 'POST_HIT', label: 'Direk', category: 'attack', commentary: 'Top direkten döndü.' }
];

const DEFINITION_BY_TYPE = MATCH_EVENT_DEFINITIONS.reduce<Partial<Record<MatchEventType, MatchEventDefinition>>>((acc, definition) => {
  acc[definition.type] = definition;
  return acc;
}, {});

export const getMatchEventDefinition = (type: MatchEventType) => DEFINITION_BY_TYPE[type];

export const getMatchEventLabel = (type: MatchEventType) => DEFINITION_BY_TYPE[type]?.label || type;

export const generateMatchCommentary = (type: MatchEventType, playerName: string, detail?: string) => {
  if (detail) return detail;
  const template = DEFINITION_BY_TYPE[type]?.commentary || '{player} oyunun akışında rol aldı.';
  return template.replace('{player}', playerName);
};
