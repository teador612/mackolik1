/* =========================================================
   SPOR TOTO VERİLERİ
   Sezon: 2026/2027
   1-7. haftalar: tamamlanmış
   8. hafta: devam eden program
   result:
   1 = ev sahibi
   X = beraberlik
   2 = deplasman
   Backtest sırasında bir haftanın sonucu,
   o haftanın tahmininde KULLANILMAZ.
========================================================= */
const SPORT_TOTO_DATA = {
  seasons: {
    "2026-2027": {
      weeks: {
        /* =================================================
           1. HAFTA
        ================================================= */
        "1": {
          status: "finished",
          matches: [
            { no:1,  home:"Galatasaray", away:"Çorum FK", score:"2-2", result:"X" },
            { no:2,  home:"Kasımpaşa", away:"Trabzonspor", score:"1-1", result:"X" },
            { no:3,  home:"Konyaspor", away:"Çaykur Rizespor", score:"0-1", result:"2" },
            { no:4,  home:"Gaziantep FK", away:"Corendon Alanyaspor", score:"1-1", result:"X" },
            { no:5,  home:"Gençlerbirliği", away:"Fenerbahçe", score:"2-1", result:"1" },
            { no:6,  home:"Rams Başakşehir", away:"Kocaelispor", score:"2-0", result:"1" },
            { no:7,  home:"Amed Sportif Faaliyetler", away:"Erzurumspor FK", score:"3-0", result:"1" },
            { no:8,  home:"Beşiktaş", away:"Eyüpspor", score:"1-0", result:"1" },
            { no:9,  home:"Samsunspor", away:"Göztepe", score:"3-3", result:"X" },
            { no:10, home:"Arsenal", away:"Manchester City", score:"3-0", result:"1" },
            { no:11, home:"Lens", away:"Paris St Germain", score:"1-0", result:"1" },
            { no:12, home:"Sevilla", away:"Rayo Vallecano", score:"2-1", result:"1" },
            { no:13, home:"Racing Santander", away:"Villarreal", score:"2-2", result:"X" },
            { no:14, home:"Espanyol", away:"Levante", score:"3-0", result:"1" },
            // Kaynakta skor "-" olmasına rağmen sonuç "1" verilmiş.
            // Backtest veri sızıntısı/yanlış sonuç riskini önlemek için dışarıda bırakıldı.
            { no:15, home:"Celta Vigo", away:"Osasuna", score:null, result:null }
          ]
        },
        /* =================================================
           2. HAFTA
        ================================================= */
        "2": {
          status: "finished",
          matches: [
            { no:1,  home:"Erzurumspor FK", away:"Galatasaray", score:"0-4", result:"2" },
            { no:2,  home:"Çaykur Rizespor", away:"Samsunspor", score:"0-2", result:"2" },
            { no:3,  home:"Arca Çorum FK", away:"Kasımpaşa", score:"0-1", result:"2" },
            { no:4,  home:"Fenerbahçe", away:"Tümosan Konyaspor", score:"4-2", result:"1" },
            { no:5,  home:"Eyüpspor", away:"Gaziantep FK", score:"0-1", result:"2" },
            { no:6,  home:"Trabzonspor", away:"İstanbul Başakşehir", score:"2-1", result:"1" },
            { no:7,  home:"Corendon Alanyaspor", away:"Beşiktaş", score:"1-0", result:"1" },
            { no:8,  home:"Göztepe", away:"Gençlerbirliği", score:"0-1", result:"2" },
            { no:9,  home:"Kocaelispor", away:"Amed Sportif Faaliyetler", score:"2-0", result:"1" },
            { no:10, home:"Borussia Dortmund", away:"Bayern Münih", score:"1-2", result:"2" },
            { no:11, home:"Marsilya", away:"Strasbourg", score:"4-0", result:"1" },
            { no:12, home:"Newcastle Utd.", away:"Liverpool", score:"2-2", result:"X" },
            { no:13, home:"Real Betis", away:"Real Sociedad", score:"1-0", result:"1" },
            { no:14, home:"Atletico Madrid", away:"Villarreal", score:"2-2", result:"X" },
            { no:15, home:"Torino", away:"Milan", score:"1-2", result:"2" }
          ]
        },
        /* =================================================
           3. HAFTA
        ================================================= */
        "3": {
          status: "finished",
          matches: [
            { no:1,  home:"Gençlerbirliği", away:"Erzurumspor FK", score:"1-1", result:"X" },
            { no:2,  home:"Tümosan Konyaspor", away:"Kocaelispor", score:"1-2", result:"2" },
            { no:3,  home:"Galatasaray", away:"Göztepe", score:"3-2", result:"1" },
            { no:4,  home:"Gaziantep FK", away:"Çaykur Rizespor", score:"1-2", result:"2" },
            { no:5,  home:"Eyüpspor", away:"Corendon Alanyaspor", score:"2-1", result:"1" },
            { no:6,  home:"İstanbul Başakşehir", away:"Kasımpaşa", score:"1-1", result:"X" },
            { no:7,  home:"Samsunspor", away:"Fenerbahçe", score:"0-2", result:"2" },
            { no:8,  home:"Amed Sportif Faaliyetler", away:"Trabzonspor", score:"2-1", result:"1" },
            { no:9,  home:"Beşiktaş", away:"Arca Çorum FK", score:"6-2", result:"1" },
            { no:10, home:"Borussia Dortmund", away:"Hamburger SV", score:"2-0", result:"1" },
            { no:11, home:"Lille", away:"Paris St Germain", score:"2-2", result:"X" },
            { no:12, home:"Monaco", away:"Marsilya", score:"2-0", result:"1" },
            { no:13, home:"T. Hotspur", away:"Newcastle Utd.", score:"0-2", result:"2" },
            { no:14, home:"Sevilla", away:"Atletico Madrid", score:"1-3", result:"2" },
            { no:15, home:"Cagliari", away:"Inter", score:"0-1", result:"2" }
          ]
        },
        /* =================================================
           4. HAFTA
        ================================================= */
        "4": {
          status: "finished",
          matches: [
            { no:1,  home:"Erzurumspor FK", away:"Tümosan Konyaspor", score:"1-0", result:"1" },
            { no:2,  home:"Kasımpaşa", away:"Amed Sportif Faaliyetler", score:"2-2", result:"X" },
            { no:3,  home:"Arca Çorum FK", away:"Eyüpspor", score:"3-0", result:"1" },
            { no:4,  home:"Fenerbahçe", away:"Beşiktaş", score:"1-2", result:"2" },
            { no:5,  home:"İstanbul Başakşehir", away:"Galatasaray", score:"2-3", result:"2" },
            { no:6,  home:"Kocaelispor", away:"Samsunspor", score:"1-0", result:"1" },
            { no:7,  home:"Trabzonspor", away:"Gençlerbirliği", score:"5-0", result:"1" },
            { no:8,  home:"Çaykur Rizespor", away:"Corendon Alanyaspor", score:"0-1", result:"2" },
            { no:9,  home:"Göztepe", away:"Gaziantep FK", score:"2-4", result:"2" },
            { no:10, home:"Everton", away:"Manchester Utd.", score:"2-2", result:"X" },
            { no:11, home:"Arsenal", away:"Chelsea", score:"2-1", result:"1" },
            { no:12, home:"Athletic Bilbao", away:"Atletico Madrid", score:"3-0", result:"1" },
            { no:13, home:"Inter", away:"Napoli", score:"3-2", result:"1" },
            { no:14, home:"Roma", away:"Atalanta", score:"2-1", result:"1" },
            { no:15, home:"Juventus", away:"Milan", score:"1-1", result:"X" }
          ]
        },
        /* =================================================
           5. HAFTA
        ================================================= */
        "5": {
          status: "finished",
          matches: [
            { no:1,  home:"Beşiktaş", away:"Erzurumspor FK", score:"3-0", result:"1" },
            { no:2,  home:"Eyüpspor", away:"Çaykur Rizespor", score:"0-2", result:"2" },
            { no:3,  home:"Samsunspor", away:"Arca Çorum FK", score:"1-5", result:"2" },
            { no:4,  home:"Corendon Alanyaspor", away:"Göztepe", score:"2-2", result:"X" },
            { no:5,  home:"Tümosan Konyaspor", away:"Trabzonspor", score:"1-0", result:"1" },
            { no:6,  home:"Gençlerbirliği", away:"Kasımpaşa", score:"1-2", result:"2" },
            { no:7,  home:"Amed Sportif Faaliyetler", away:"İstanbul Başakşehir", score:"5-0", result:"1" },
            { no:8,  home:"Galatasaray", away:"Kocaelispor", score:"1-0", result:"1" },
            { no:9,  home:"Gaziantep FK", away:"Fenerbahçe", score:"0-0", result:"X" },
            { no:10, home:"Augsburg", away:"Bayer Leverkusen", score:"2-2", result:"X" },
            { no:11, home:"Rennes", away:"Marsilya", score:"1-0", result:"1" },
            { no:12, home:"Chelsea", away:"Hull City", score:"2-2", result:"X" },
            { no:13, home:"Manchester Utd.", away:"M. City", score:"0-1", result:"2" },
            { no:14, home:"Levante", away:"Barcelona", score:"2-4", result:"2" },
            { no:15, home:"Lazio", away:"Milan", score:"2-2", result:"X" }
          ]
        },
        /* =================================================
           6. HAFTA
        ================================================= */
        "6": {
          status: "finished",
          matches: [
            { no:1,  home:"Kasımpaşa", away:"Tümosan Konyaspor", score:"0-0", result:"X" },
            { no:2,  home:"Kocaelispor", away:"Gaziantep FK", score:"2-0", result:"1" },
            { no:3,  home:"Arca Çorum FK", away:"Corendon Alanyaspor", score:"1-2", result:"2" },
            { no:4,  home:"İstanbul Başakşehir", away:"Gençlerbirliği", score:"4-0", result:"1" },
            { no:5,  home:"Trabzonspor", away:"Galatasaray", score:"4-0", result:"1" },
            { no:6,  home:"Erzurumspor FK", away:"Samsunspor", score:"1-0", result:"1" },
            { no:7,  home:"Fenerbahçe", away:"Eyüpspor", score:"8-0", result:"1" },
            { no:8,  home:"Amed Sportif Faaliyetler", away:"Beşiktaş", score:"3-2", result:"1" },
            { no:9,  home:"Göztepe", away:"Çaykur Rizespor", score:"2-2", result:"X" },
            { no:10, home:"Vfb Stuttgart", away:"Borussia Dortmund", score:"0-1", result:"2" },
            { no:11, home:"Bayer Leverkusen", away:"RB Leipzig", score:"2-0", result:"1" },
            { no:12, home:"Tottenham Hotspur", away:"Aston Villa", score:"2-3", result:"2" },
            { no:13, home:"Newcastle Utd.", away:"H. City", score:"2-1", result:"1" },
            { no:14, home:"Atletico Madrid", away:"Real Madrid", score:"2-1", result:"1" },
            { no:15, home:"Roma", away:"Inter", score:"2-2", result:"X" }
          ]
        },
        /* =================================================
           7. HAFTA
        ================================================= */
        "7": {
          status: "finished",
          matches: [
            { no:1,  home:"Türkiye", away:"Fransa", score:"0-1", result:"2" },
            { no:2,  home:"Türkiye", away:"İtalya", score:"1-4", result:"2" },
            { no:3,  home:"İsveç", away:"Romanya", score:"2-1", result:"1" },
            { no:4,  home:"İtalya", away:"Belçika", score:"0-2", result:"2" },
            { no:5,  home:"Slovenya", away:"İskoçya", score:"0-0", result:"X" },
            { no:6,  home:"Bulgaristan", away:"Lüksemburg", score:"1-2", result:"2" },
            { no:7,  home:"Kuzey Makedonya Cumhuriyeti", away:"İsviçre", score:"0-3", result:"2" },
            { no:8,  home:"Çekya", away:"Hırvatistan", score:"1-2", result:"2" },
            { no:9,  home:"İngiltere", away:"İspanya", score:"2-3", result:"2" },
            { no:10, home:"Litvanya", away:"Azerbaycan", score:"1-1", result:"X" },
            { no:11, home:"Avusturya", away:"Kosova", score:"3-1", result:"1" },
            { no:12, home:"Danimarka", away:"Galler", score:"2-0", result:"1" },
            { no:13, home:"Sırbistan", away:"Hollanda", score:"1-2", result:"2" },
            { no:14, home:"Almanya", away:"Yunanistan", score:"0-1", result:"2" },
            { no:15, home:"Norveç", away:"Portekiz", score:"1-2", result:"2" }
          ]
        },
        /* =================================================
           8. HAFTA
           HENÜZ TAMAMLANMADI
        ================================================= */
        "8": {
          status: "current",
          matches: [
            { no:1,  home:"Belçika", away:"Türkiye", score:null, result:null },
            { no:2,  home:"İtalya", away:"Türkiye", score:null, result:null },
            { no:3,  home:"Bosna Hersek", away:"İsveç", score:null, result:null },
            { no:4,  home:"Fransa", away:"İtalya", score:null, result:null },
            { no:5,  home:"Macaristan", away:"Gürcistan", score:null, result:null },
            { no:6,  home:"Polonya", away:"Romanya", score:null, result:null },
            { no:7,  home:"Hırvatistan", away:"İngiltere", score:null, result:null },
            { no:8,  home:"Kuzey Makedonya Cumhuriyeti", away:"İskoçya", score:null, result:null },
            { no:9,  home:"İspanya", away:"Çekya", score:null, result:null },
            { no:10, home:"İsviçre", away:"Slovenya", score:null, result:null },
            { no:11, home:"Galler", away:"Danimarka", score:null, result:null },
            { no:12, home:"Hollanda", away:"Sırbistan", score:null, result:null },
            { no:13, home:"Portekiz", away:"Norveç", score:null, result:null },
            { no:14, home:"Yunanistan", away:"Almanya", score:null, result:null },
            { no:15, home:"Fransa", away:"Belçika", score:null, result:null }
          ]
        }
      }
    }
  }
};
