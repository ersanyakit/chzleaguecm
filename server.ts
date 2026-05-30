import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Gemini with safety checks
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini AI successfully initialized.");
  } catch (err) {
    console.error("Gemini AI initialization error:", err);
  }
} else {
  console.log("No GEMINI_API_KEY found. AI features will fallback to rule-based template generation.");
}

// Fallback high-quality Championship teams config
const FALLBACK_CHAMPIONSHIP = [
  { idTeam: "133602", strTeam: "Leeds United", strTeamShort: "LEE", strStadium: "Elland Road", strBadge: "https://www.thesportsdb.com/images/media/team/badge/7v9m8d1512140669.png", intFormedYear: "1919" },
  { idTeam: "133604", strTeam: "Leicester City", strTeamShort: "LEI", strStadium: "King Power Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/1vt45k1688126301.png", intFormedYear: "1884" },
  { idTeam: "133610", strTeam: "Southampton", strTeamShort: "SOU", strStadium: "St Mary's Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/8sre1k1513256082.png", intFormedYear: "1885" },
  { idTeam: "133597", strTeam: "Ipswich Town", strTeamShort: "IPS", strStadium: "Portman Road", strBadge: "https://www.thesportsdb.com/images/media/team/badge/pqtpsu1512401777.png", intFormedYear: "1878" },
  { idTeam: "133612", strTeam: "West Bromwich Albion", strTeamShort: "WBA", strStadium: "The Hawthorns", strBadge: "https://www.thesportsdb.com/images/media/team/badge/ypyrwq1343058882.png", intFormedYear: "1878" },
  { idTeam: "133608", strTeam: "Norwich City", strTeamShort: "NOR", strStadium: "Carrow Road", strBadge: "https://www.thesportsdb.com/images/media/team/badge/tuxrxw1343058869.png", intFormedYear: "1902" },
  { idTeam: "133601", strTeam: "Hull City", strTeamShort: "HUL", strStadium: "MKM Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/m0u63g1547466840.png", intFormedYear: "1904" },
  { idTeam: "133606", strTeam: "Middlesbrough", strTeamShort: "MID", strStadium: "Riverside Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/tuxvrq1343058837.png", intFormedYear: "1876" },
  { idTeam: "133599", strTeam: "Coventry City", strTeamShort: "COV", strStadium: "Coventry Building Society Arena", strBadge: "https://www.thesportsdb.com/images/media/team/badge/upruqt1437172545.png", intFormedYear: "1883" },
  { idTeam: "134293", strTeam: "Sunderland", strTeamShort: "SUN", strStadium: "Stadium of Light", strBadge: "https://www.thesportsdb.com/images/media/team/badge/vyvvvu1343058913.png", intFormedYear: "1879" },
  { idTeam: "134291", strTeam: "Watford", strTeamShort: "WAT", strStadium: "Vicarage Road", strBadge: "https://www.thesportsdb.com/images/media/team/badge/pvyrtv1470481078.png", intFormedYear: "1881" },
  { idTeam: "133607", strTeam: "Millwall", strTeamShort: "MIL", strStadium: "The Den", strBadge: "https://www.thesportsdb.com/images/media/team/badge/uxsswq1343058850.png", intFormedYear: "1885" },
  { idTeam: "133596", strTeam: "Blackburn Rovers", strTeamShort: "BLB", strStadium: "Ewood Park", strBadge: "https://www.thesportsdb.com/images/media/team/badge/rvtuxv1343058728.png", intFormedYear: "1875" },
  { idTeam: "133600", strTeam: "Queens Park Rangers", strTeamShort: "QPR", strStadium: "Loftus Road", strBadge: "https://www.thesportsdb.com/images/media/team/badge/vvwyps1434220311.png", intFormedYear: "1882" },
  { idTeam: "133611", strTeam: "Stoke City", strTeamShort: "STK", strStadium: "bet365 Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/xvyttx1343058897.png", intFormedYear: "1863" },
  { idTeam: "133595", strTeam: "Bristol City", strTeamShort: "BRC", strStadium: "Ashton Gate", strBadge: "https://www.thesportsdb.com/images/media/team/badge/xvtqqt1533202970.png", intFormedYear: "1894" },
  { idTeam: "133605", strTeam: "Preston North End", strTeamShort: "PNE", strStadium: "Deepdale", strBadge: "https://www.thesportsdb.com/images/media/team/badge/tttxuy1343058822.png", intFormedYear: "1880" },
  { idTeam: "133613", strTeam: "Cardiff City", strTeamShort: "CAR", strStadium: "Cardiff City Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/5puvpy1583689456.png", intFormedYear: "1899" },
  { idTeam: "133614", strTeam: "Swansea City", strTeamShort: "SWA", strStadium: "Swansea.com Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/ypttrw1343058933.png", intFormedYear: "1912" },
  { idTeam: "133609", strTeam: "Plymouth Argyle", strTeamShort: "PLY", strStadium: "Home Park", strBadge: "https://www.thesportsdb.com/images/media/team/badge/xrqwvv1355446059.png", intFormedYear: "1886" }
];

const FALLBACK_PREMIER_LEAGUE = [
  { idTeam: "133604", strTeam: "Arsenal", strTeamShort: "ARS", strStadium: "Emirates Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/73z51a1614182956.png", intFormedYear: "1886" },
  { idTeam: "133613", strTeam: "Aston Villa", strTeamShort: "AVL", strStadium: "Villa Park", strBadge: "https://www.thesportsdb.com/images/media/team/badge/ubwp0a1682434444.png", intFormedYear: "1874" },
  { idTeam: "133610", strTeam: "Chelsea", strTeamShort: "CHE", strStadium: "Stamford Bridge", strBadge: "https://www.thesportsdb.com/images/media/team/badge/yvwvtu1448810414.png", intFormedYear: "1905" },
  { idTeam: "133615", strTeam: "Everton", strTeamShort: "EVE", strStadium: "Goodison Park", strBadge: "https://www.thesportsdb.com/images/media/team/badge/vwwvuv1347377045.png", intFormedYear: "1878" },
  { idTeam: "133612", strTeam: "Liverpool", strTeamShort: "LIV", strStadium: "Anfield", strBadge: "https://www.thesportsdb.com/images/media/team/badge/uva70y1538153400.png", intFormedYear: "1892" },
  { idTeam: "134220", strTeam: "Manchester City", strTeamShort: "MCI", strStadium: "Etihad Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/72p12f1610480112.png", intFormedYear: "1880" },
  { idTeam: "133616", strTeam: "Manchester United", strTeamShort: "MUN", strStadium: "Old Trafford", strBadge: "https://www.thesportsdb.com/images/media/team/badge/z3f2b41639841808.png", intFormedYear: "1878" },
  { idTeam: "133611", strTeam: "Newcastle United", strTeamShort: "NEW", strStadium: "St James' Park", strBadge: "https://www.thesportsdb.com/images/media/team/badge/wxl94e1614182885.png", intFormedYear: "1892" },
  { idTeam: "133624", strTeam: "Tottenham Hotspur", strTeamShort: "TOT", strStadium: "Tottenham Hotspur Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/b96o8v1614184695.png", intFormedYear: "1882" },
  { idTeam: "133618", strTeam: "West Ham United", strTeamShort: "WHU", strStadium: "London Stadium", strBadge: "https://www.thesportsdb.com/images/media/team/badge/8s3b0i1538153482.png", intFormedYear: "1895" }
];

// Endpoint to proxy get soccer teams
app.get("/api/soccer/teams", async (req, res) => {
  const league = req.query.league as string || "English Championship";
  const url = `https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=${encodeURIComponent(league)}`;

  console.log(`Initializing soccer database for league: ${league}...`);
  try {
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      throw new Error(`TheSportsDB status ${fetchResponse.status}`);
    }
    const data = await fetchResponse.json();
    if (data && data.teams && data.teams.length > 0) {
      console.log(`Successfully fetched ${data.teams.length} teams from SportsDB.`);
      res.json({
        success: true,
        source: "api",
        teams: data.teams.map((t: any) => ({
          idTeam: t.idTeam,
          strTeam: t.strTeam,
          strTeamShort: t.strTeamShort || t.strTeam.substring(0, 3).toUpperCase(),
          strStadium: t.strStadium || "Unknown Stadium",
          strBadge: t.strBadge || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=128&q=80",
          intFormedYear: t.intFormedYear || "1900",
          strDescriptionEN: t.strDescriptionEN || ""
        }))
      });
    } else {
      throw new Error("Empty dataset");
    }
  } catch (err: any) {
    console.log(`Loaded real-time pre-seeded database for ${league}.`);
    const fallbackList = league.toLowerCase().includes("championship") ? FALLBACK_CHAMPIONSHIP : FALLBACK_PREMIER_LEAGUE;
    res.json({
      success: true,
      source: "fallback",
      teams: fallbackList
    });
  }
});

// Gemini AI Match Report / Narrative news endpoint
app.post("/api/gemini/analyze", async (req, res) => {
  const { matchDetails } = req.body;

  if (!matchDetails) {
    return res.status(400).json({ error: "Missing match details" });
  }

  const prompt = `
  Yönettiğim futbol takımı maçı tamamladı. Detayları aşağıdadır:
  Müsabaka: ${matchDetails.homeTeam} vs ${matchDetails.awayTeam} (${matchDetails.type})
  Skor: ${matchDetails.homeTeam} ${matchDetails.homeScore} - ${matchDetails.awayScore} ${matchDetails.awayTeam}
  Goller: ${JSON.stringify(matchDetails.scorers || [])}
  Kartlar / Önemli Olaylar: ${JSON.stringify(matchDetails.events || [])}
  Oyuncu Performansları ve İstatistikler: Şutlar: ${matchDetails.homeShots}-${matchDetails.awayShots}, Topla Oynama: %${matchDetails.homePos}-%${matchDetails.awayPos}
  Maaş bütçesi durumu, taraftar tepkisi ve lig sırası yansıması da dahil.

  Senden Championship Manager tarzında nostaljik, üst düzey bir futbol muhabiri veya antrenör raporu yazmanı istiyorum. 
  Metin tamamen TÜRKÇE, coşkulu ve son derece gerçekçi olmalı. Futbol jargonunu çok iyi kullan (örn. "üç puanı hanesine yazdırdı", "savunma arkasına sarkan", "kaleciyi çaresiz bırakan vuruş", "taktik deha").
  Format şu şekilde olsun:
  1. Başlık (Heyecanlı gazete başlığı gibi)
  2. Haber Metni (3-4 kısa paragraf)
  3. Yöneticiye Tavsiyeler (Bir sonraki maç için taktiksel 2 madde - hücum, kondisyon, pres vb.)

  Lütfen JSON formatında dön. Örnek çıktı şeması:
  {
    "title": "...",
    "report": "...",
    "tacticalAdvice": ["...", "..."]
  }
  `;

  if (!ai) {
    // Generate static mockup structured responses if Gemini is not available
    const isWin = matchDetails.managedTeamScore > matchDetails.opponentTeamScore;
    const isDraw = matchDetails.managedTeamScore === matchDetails.opponentTeamScore;
    let title = `${matchDetails.managedTeam} Sahada Resital Sundu!`;
    let report = `${matchDetails.managedTeam}, zorlu ${matchDetails.opponentTeam} mücadelesinde sahaya yansıttığı akılcı oyun planıyla hak ettiği bir sonuç aldı. Taraftarlarının desteğini arkasına alan ekip, hücum hattındaki etkili varyasyonlarıyla savunma kilidini açmayı başardı.`;
    let tacticalAdvice = [
      "Takımın kondisyon seviyesi oldukça iyi durumda, pres gücünü korumak için tempoyu yüksek tutmaya devam edelim.",
      "Aksayan sol kanat rotasyonu için antrenmanlarda taktik koordinasyona odaklanmalıyız."
    ];

    if (isDraw) {
      title = `${matchDetails.managedTeam} ile ${matchDetails.opponentTeam} Puanları Paylaştı`;
      report = `Nefes kesen 90 dakikada denge bozulmadı. İki takımın da orta alandaki yoğun mücadelesi ve taktik disiplini, seyir zevki yüksek faka skor üretmekte zorlanılan bir maç çıkardı. Kalecilerin kritik kurtarışları maça damga vurdu.`;
      tacticalAdvice = [
        "Orta sahadaki pas trafiğini hızlandırmak için yaratıcı oyun kurucu rolünü öne çıkarmalıyız.",
        "Şut tercihleri üzerinde çalışarak ceza sahası dışı denemelerini artırabiliriz."
      ];
    } else if (!isWin && !isDraw) {
      title = `Soğuk Duş! ${matchDetails.managedTeam} Şok Yenilgiyle Sarsıldı`;
      report = `${matchDetails.managedTeam}, sahasında ummadığı bir mağlubiyetle karşı karşıya kaldı. ${matchDetails.opponentTeam} takımının kontra atak taktiğine karşı savunmada boşluklar veren oyuncularımız, yakaladıkları fırsatları da cömertçe harcayınca yenilgi kaçınılmaz oldu.`;
      tacticalAdvice = [
        "Savunma hattındaki pozisyon hatalarını gidermek için taktiksel dar alan çalışmalarına ağırlık vermeliyiz.",
        "Kondisyon eksiği göze çarpan oyuncularımızı özel antrenman programına dahil edelim."
      ];
    }

    return res.json({ title, report, tacticalAdvice });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            report: { type: Type.STRING },
            tacticalAdvice: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "report", "tacticalAdvice"]
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Gemini Match Report error:", err.message);
    res.status(500).json({ error: "Failed to generate match report" });
  }
});

// Gemini AI Gossip and Board News Headlines
app.post("/api/gemini/news", async (req, res) => {
  const { teamName, leagueTrend } = req.body;
  const prompt = `
  Futbol Menajerlik oyunu için ${teamName} takımı hakkında 4 adet eğlenceli ve gerçekçi Türkçe spor manşeti/fısıltısı üret.
  Trend durumu: ${leagueTrend || "Sıradan lig haftası"}.
  Önemli oyuncular, transfer iddiaları, taraftar reaksiyonları, prim tartışmaları veya antrenmandaki komik olayları içerebilir.
  Uniswap kalitesinde modern bir spor portalında 'Flaş Haberler' olarak gösterilecektir.
  JSON olarak dön. Örnek:
  {
    "headlines": [
      { "tag": "DEDİKODU", "title": "...", "description": "..." },
      ...
    ]
  }
  `;

  if (!ai) {
    return res.json({
      headlines: [
        { tag: "DEDİKODU", title: `Yönetim ${teamName} Transfer Bütçesini Esnetiyor mu?`, description: "Kulüp başkanının dün akşam yabancı bir oyuncu temsilcisiyle yemek yediği iddia edildi." },
        { tag: "SÜRPRİZ", title: `Antrenmanda Neşeli Anlar!`, description: "Yarı saha çift kale maçta kaleye geçen forvet oyuncusunun gol yememe serisi tüm takımı eğlendirdi." },
        { tag: "ANALİZ", title: `Şampiyonluk Oranları Güncellendi`, description: "Analistler takımımızın son maçlardaki performansıyla gruptaki gücünü ispatladığını belirtiyor." },
        { tag: "TARAFTAR", title: `Büyük Maç Öncesi Biletler Tükendi!`, description: "Taraftarlar haftasonu oynanacak kritik derbi öncesi tüm biletleri 14 dakikada bitirdi." }
      ]
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headlines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tag: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["tag", "title", "description"]
              }
            }
          },
          required: ["headlines"]
        }
      }
    });
    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (err: any) {
    res.json({
      headlines: [
        { tag: "DEDİKODU", title: "Başkan Transfer Müjdesi Verdi", description: "Yönetimin kadro kalitesini artırmak için kolları sıvadığı bildirildi." }
      ]
    });
  }
});

// Vite Development Client integration, or Production Asset serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Championship Manager server spinning on http://localhost:${PORT}`);
  });
}

startServer();
