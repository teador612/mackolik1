// scripts/update-basketball.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const DATA_FILE = path.join(
    ROOT,
    "data",
    "basketball.json"
);

const PROGRAM_URL =
    "https://arsiv.mackolik.com/Program/Program.aspx?st=2";

const RESULTS_URL =
    "https://arsiv.mackolik.com/Basketbol/Puan-Durumu";

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0 Safari/537.36";


/* =========================================================
   ANA
========================================================= */

async function main() {

    console.log("");
    console.log("======================================");
    console.log("🏀 MACKOLİK BASKETBOL GÜNCELLEYİCİ");
    console.log("======================================");
    console.log("");


    const oldData =
        readOldData();


    console.log(
        `Eski kayıt: ${oldData.matches.length}`
    );


    /*
       1 - BUGÜN + GELECEK PROGRAM
    */

    console.log("");
    console.log("📥 Mackolik basketbol programı çekiliyor...");


    const programHtml =
        await fetchPage(PROGRAM_URL);


    const programMatches =
        parseProgram(programHtml);


    console.log(
        `Programdan bulunan maç: ${programMatches.length}`
    );


    /*
       2 - SONUÇLAR
    */

    console.log("");
    console.log("📥 Mackolik basketbol sonuçları çekiliyor...");


    let resultMatches = [];


    try {

        const resultsHtml =
            await fetchPage(RESULTS_URL);


        resultMatches =
            parseResults(resultsHtml);


        console.log(
            `Sonuçlardan bulunan maç: ${resultMatches.length}`
        );

    } catch (error) {

        console.log(
            "⚠️ Sonuç sayfası alınamadı:"
        );

        console.log(error.message);

    }


    /*
       3 - ESKİ VERİ + YENİ VERİ BİRLEŞTİR
    */

    const merged =
        mergeMatches(
            oldData.matches,
            programMatches,
            resultMatches
        );


    /*
       4 - TARİHE GÖRE SIRALA
    */

    merged.sort((a, b) => {

        const aKey =
            `${a.date} ${a.time || "99:99"}`;

        const bKey =
            `${b.date} ${b.time || "99:99"}`;

        return aKey.localeCompare(bKey);

    });


    const output = {

        source:
            PROGRAM_URL,

        updatedAt:
            new Date().toISOString(),

        matches:
            merged

    };


    fs.mkdirSync(
        path.dirname(DATA_FILE),
        {
            recursive: true
        }
    );


    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            output,
            null,
            2
        ),
        "utf8"
    );


    console.log("");
    console.log("======================================");
    console.log("✅ BASKETBOL VERİSİ GÜNCELLENDİ");
    console.log("======================================");
    console.log(
        `Toplam kayıt: ${merged.length}`
    );
    console.log(
        `Dosya: ${DATA_FILE}`
    );
    console.log("");

}


/* =========================================================
   SAYFAYI ÇEK
========================================================= */

async function fetchPage(url) {

    const response =
        await fetch(
            url,
            {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept":
                        "text/html,application/xhtml+xml"
                }
            }
        );


    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status} - ${url}`
        );

    }


    return await response.text();

}


/* =========================================================
   PROGRAM PARSER
========================================================= */

function parseProgram(html) {

    const matches = [];

    /*
       HTML içindeki lig bloklarını yakalamaya çalışıyoruz.
       Mackolik'in programı tarih/saat + takım çifti
       şeklinde geliyor.
    */


    const clean =
        cleanHtml(html);


    const lines =
        clean
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);


    let currentLeague = "";


    for (let i = 0; i < lines.length; i++) {

        const line =
            lines[i];


        /*
           Tarih başlığı
        */

        const dateMatch =
            line.match(
                /(\d{2})[./](\d{2})[./](\d{4})/
            );


        /*
           Lig isimlerini mümkün olduğunca
           tarih başlıklarından yakalıyoruz.
        */

        if (
            dateMatch &&
            !line.includes(" - ")
        ) {

            continue;

        }


        /*
           Takım - Takım
        */

        const game =
            extractTeams(line);


        if (!game) {
            continue;
        }


        /*
           Aynı satırdan tarih bul
        */

        const date =
            findDateAround(
                lines,
                i
            );


        if (!date) {
            continue;
        }


        const time =
            findTime(line);


        /*
           Lig bilgisini geriye doğru ara
        */

        currentLeague =
            findLeagueAround(
                lines,
                i
            ) ||
            currentLeague ||
            "BASKETBOL";


        /*
           TS bilgisi
        */

        const totalLine =
            extractTotal(line);


        matches.push({

            id:
                makeId(
                    date,
                    game.home,
                    game.away
                ),

            date,

            time,

            league:
                currentLeague,

            home:
                game.home,

            away:
                game.away,

            homeScore:
                null,

            awayScore:
                null,

            halfHomeScore:
                null,

            halfAwayScore:
                null,

            totalLine,

            status:
                "not_started"

        });

    }


    return uniqueMatches(matches);

}


/* =========================================================
   SONUÇ PARSER
========================================================= */

function parseResults(html) {

    const matches = [];

    const clean =
        cleanHtml(html);


    const lines =
        clean
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);


    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i];


        /*
           Örnek:

           27.09.2026 | MS |
           Anadolu Efes |
           95 - 81 |
           Beşiktaş
        */

        const dateMatch =
            line.match(
                /(\d{1,2})[./](\d{1,2})[./](\d{4})/
            );


        if (!dateMatch) {
            continue;
        }


        const scoreMatch =
            line.match(
                /(\d{1,3})\s*-\s*(\d{1,3})/
            );


        if (!scoreMatch) {
            continue;
        }


        /*
           Satırda takım isimlerini ayıklamaya çalış.
        */

        const parts =
            line
                .split("|")
                .map(x => x.trim())
                .filter(Boolean);


        if (parts.length < 3) {
            continue;
        }


        const scoreIndex =
            parts.findIndex(
                x =>
                    /^\d{1,3}\s*-\s*\d{1,3}$/.test(x)
            );


        if (scoreIndex < 1) {
            continue;
        }


        const home =
            cleanTeamName(
                parts[scoreIndex - 1]
            );


        const away =
            cleanTeamName(
                parts[scoreIndex + 1]
            );


        if (
            !home ||
            !away ||
            !isTeamName(home) ||
            !isTeamName(away)
        ) {
            continue;
        }


        const date =
            toIsoDate(
                dateMatch[1],
                dateMatch[2],
                dateMatch[3]
            );


        matches.push({

            id:
                makeId(
                    date,
                    home,
                    away
                ),

            date,

            time:
                "",

            league:
                findLeagueAround(
                    lines,
                    i
                ) ||
                "BASKETBOL",

            home,

            away,

            homeScore:
                Number(scoreMatch[1]),

            awayScore:
                Number(scoreMatch[2]),

            halfHomeScore:
                null,

            halfAwayScore:
                null,

            status:
                "finished"

        });

    }


    return uniqueMatches(matches);

}


/* =========================================================
   BİRLEŞTİR
========================================================= */

function mergeMatches(
    oldMatches,
    programMatches,
    resultMatches
) {

    const map =
        new Map();


    /*
       Önce eski verileri koy.
       Böylece geçmiş kayıtlar kaybolmaz.
    */

    for (const match of oldMatches) {

        if (!match?.id) {
            continue;
        }

        map.set(
            match.id,
            normalizeMatch(match)
        );

    }


    /*
       Yeni program
    */

    for (const match of programMatches) {

        const old =
            map.get(match.id);


        if (old) {

            map.set(
                match.id,
                {
                    ...old,
                    ...match,

                    /*
                       Geçmiş skor varsa
                       yeni boş değerle ezme.
                    */

                    homeScore:
                        match.homeScore ??
                        old.homeScore ??
                        null,

                    awayScore:
                        match.awayScore ??
                        old.awayScore ??
                        null,

                    halfHomeScore:
                        match.halfHomeScore ??
                        old.halfHomeScore ??
                        null,

                    halfAwayScore:
                        match.halfAwayScore ??
                        old.halfAwayScore ??
                        null
                }
            );

        } else {

            map.set(
                match.id,
                normalizeMatch(match)
            );

        }

    }


    /*
       Yeni sonuçlar
    */

    for (const result of resultMatches) {

        const old =
            map.get(result.id);


        if (old) {

            map.set(
                result.id,
                {
                    ...old,

                    homeScore:
                        result.homeScore,

                    awayScore:
                        result.awayScore,

                    halfHomeScore:
                        result.halfHomeScore ??
                        old.halfHomeScore ??
                        null,

                    halfAwayScore:
                        result.halfAwayScore ??
                        old.halfAwayScore ??
                        null,

                    status:
                        "finished"
                }
            );

        } else {

            map.set(
                result.id,
                normalizeMatch(result)
            );

        }

    }


    /*
       Geçmişteki tamamlanmış maçları koru.
    */

    return Array.from(
        map.values()
    );

}


/* =========================================================
   HTML TEMİZLE
========================================================= */

function cleanHtml(html) {

    return html

        .replace(
            /<script[\s\S]*?<\/script>/gi,
            "\n"
        )

        .replace(
            /<style[\s\S]*?<\/style>/gi,
            "\n"
        )

        .replace(
            /<br\s*\/?>/gi,
            "\n"
        )

        .replace(
            /<\/tr>/gi,
            "\n"
        )

        .replace(
            /<\/td>/gi,
            " | "
        )

        .replace(
            /<\/th>/gi,
            " | "
        )

        .replace(
            /<[^>]+>/g,
            " "
        )

        .replace(
            /&nbsp;/gi,
            " "
        )

        .replace(
            /&amp;/gi,
            "&"
        )

        .replace(
            /&#39;/gi,
            "'"
        )

        .replace(
            /&quot;/gi,
            '"'
        )

        .replace(
            /\r/g,
            ""
        )

        .replace(
            /[ \t]+/g,
            " "
        )

        .replace(
            /\n\s*\n+/g,
            "\n"
        );

}


/* =========================================================
   TAKIMLARI BUL
========================================================= */

function extractTeams(text) {

    if (!text) {
        return null;
    }


    /*
       Önce klasik:

       Takım A - Takım B
    */

    const match =
        text.match(
            /([A-Za-zÇĞİÖŞÜçğıöşü0-9().&'’/\- ]+?)\s+-\s+([A-Za-zÇĞİÖŞÜçğıöşü0-9().&'’/\- ]+)/
        );


    if (!match) {
        return null;
    }


    const home =
        cleanTeamName(match[1]);


    const away =
        cleanTeamName(match[2]);


    if (
        !home ||
        !away
    ) {
        return null;
    }


    /*
       Tarih / oran / kolon gibi yanlış eşleşmeleri
       ele.
    */

    if (
        /\d{2}[./]\d{2}[./]\d{4}/.test(home) ||
        /\d{2}[./]\d{2}[./]\d{4}/.test(away)
    ) {
        return null;
    }


    if (
        /^\d+([,.]\d+)?$/.test(home) ||
        /^\d+([,.]\d+)?$/.test(away)
    ) {
        return null;
    }


    return {
        home,
        away
    };

}


/* =========================================================
   TARİH BUL
========================================================= */

function findDateAround(lines, index) {

    /*
       Önce mevcut satır
    */

    let date =
        extractDate(lines[index]);


    if (date) {
        return date;
    }


    /*
       Son 8 satıra kadar geriye bak.
    */

    for (
        let i = index - 1;
        i >= Math.max(0, index - 8);
        i--
    ) {

        date =
            extractDate(lines[i]);


        if (date) {
            return date;
        }

    }


    return null;

}


function extractDate(text) {

    if (!text) {
        return null;
    }


    const m =
        text.match(
            /(\d{1,2})[./](\d{1,2})[./](\d{4})/
        );


    if (!m) {
        return null;
    }


    return toIsoDate(
        m[1],
        m[2],
        m[3]
    );

}


function toIsoDate(
    day,
    month,
    year
) {

    return [
        year,
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0")
    ].join("-");

}


/* =========================================================
   SAAT
========================================================= */

function findTime(text) {

    if (!text) {
        return "";
    }


    const m =
        text.match(
            /\b([01]?\d|2[0-3]):([0-5]\d)\b/
        );


    if (!m) {
        return "";
    }


    return (
        String(m[1]).padStart(2, "0") +
        ":" +
        m[2]
    );

}


/* =========================================================
   LİG BUL
========================================================= */

function findLeagueAround(
    lines,
    index
) {

    /*
       Mackolik programında lig başlıkları
       maç grubunun üzerinde bulunuyor.

       En yakın önceki anlamlı satırı al.
    */

    for (
        let i = index - 1;
        i >= Math.max(0, index - 10);
        i--
    ) {

        const line =
            lines[i];


        if (!line) {
            continue;
        }


        if (
            /\d{1,2}[./]\d{1,2}[./]\d{4}/.test(line)
        ) {
            continue;
        }


        if (
            /\b\d{1,2}:\d{2}\b/.test(line)
        ) {
            continue;
        }


        if (
            line.includes("İY") ||
            line.includes("MS") ||
            line.includes("H1") ||
            line.includes("H2") ||
            line.includes("Alt") ||
            line.includes("Üst") ||
            line.includes("TS")
        ) {
            continue;
        }


        if (
            line.length >= 3 &&
            line.length <= 100
        ) {

            /*
               Takım satırına çok benzeyen
               satırları geç.
            */

            if (
                extractTeams(line)
            ) {
                continue;
            }


            return line
                .replace(/^Image\s*/i, "")
                .trim();

        }

    }


    return "";

}


/* =========================================================
   TOPLAM SAYI / TS
========================================================= */

function extractTotal(text) {

    if (!text) {
        return null;
    }


    /*
       Satırın sonlarında genellikle:

       Alt 1.64
       Üst 1.63
       TS 165,50
    */


    const matches =
        text.match(
            /\b\d{2,3}[,.]\d{2}\b/g
        );


    if (!matches?.length) {
        return null;
    }


    const value =
        matches[matches.length - 1]
            .replace(",", ".");


    const n =
        Number(value);


    if (
        !Number.isFinite(n) ||
        n < 50 ||
        n > 300
    ) {
        return null;
    }


    return n;

}


/* =========================================================
   MAÇ ID
========================================================= */

function makeId(
    date,
    home,
    away
) {

    return (
        date +
        "|" +
        normalizeTeam(home) +
        "|" +
        normalizeTeam(away)
    );

}


/* =========================================================
   TAKIM TEMİZLE
========================================================= */

function cleanTeamName(name) {

    return String(name || "")
        .replace(/\s+/g, " ")
        .replace(/^Image\s*/i, "")
        .trim();

}


/* =========================================================
   TAKIM İSMİ Mİ?
========================================================= */

function isTeamName(name) {

    if (!name) {
        return false;
    }


    if (
        name.length < 2 ||
        name.length > 80
    ) {
        return false;
    }


    if (
        /^(İY|MS|H1|H2|Alt|Üst|TS|Tümü)$/i.test(name)
    ) {
        return false;
    }


    if (
        /^\d/.test(name)
    ) {
        return false;
    }


    return true;

}


/* =========================================================
   NORMALİZE
========================================================= */

function normalizeTeam(name) {

    return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

}


/* =========================================================
   MAÇ NORMALİZASYONU
========================================================= */

function normalizeMatch(match) {

    return {

        id:
            match.id,

        date:
            match.date,

        time:
            match.time || "",

        league:
            match.league ||
            "BASKETBOL",

        home:
            match.home,

        away:
            match.away,

        homeScore:
            numberOrNull(
                match.homeScore
            ),

        awayScore:
            numberOrNull(
                match.awayScore
            ),

        halfHomeScore:
            numberOrNull(
                match.halfHomeScore
            ),

        halfAwayScore:
            numberOrNull(
                match.halfAwayScore
            ),

        totalLine:
            numberOrNull(
                match.totalLine
            ),

        status:
            match.status ||
            "not_started"

    };

}


/* =========================================================
   SAYI
========================================================= */

function numberOrNull(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }


    const n =
        Number(
            String(value)
                .replace(",", ".")
                .replace(/[^\d.-]/g, "")
        );


    return Number.isFinite(n)
        ? n
        : null;

}


/* =========================================================
   TEKRARLARI SİL
========================================================= */

function uniqueMatches(matches) {

    const map =
        new Map();


    for (const match of matches) {

        if (!match?.id) {
            continue;
        }


        const old =
            map.get(match.id);


        if (!old) {

            map.set(
                match.id,
                match
            );

            continue;

        }


        map.set(
            match.id,
            {
                ...old,
                ...match,

                homeScore:
                    match.homeScore ??
                    old.homeScore ??
                    null,

                awayScore:
                    match.awayScore ??
                    old.awayScore ??
                    null,

                halfHomeScore:
                    match.halfHomeScore ??
                    old.halfHomeScore ??
                    null,

                halfAwayScore:
                    match.halfAwayScore ??
                    old.halfAwayScore ??
                    null

            }
        );

    }


    return Array.from(
        map.values()
    );

}


/* =========================================================
   ESKİ DOSYA
========================================================= */

function readOldData() {

    if (
        !fs.existsSync(DATA_FILE)
    ) {

        return {
            matches: []
        };

    }


    try {

        const json =
            JSON.parse(
                fs.readFileSync(
                    DATA_FILE,
                    "utf8"
                )
            );


        return {

            matches:
                Array.isArray(json)
                    ? json
                    : (
                        Array.isArray(json.matches)
                            ? json.matches
                            : []
                    )

        };

    } catch (error) {

        console.log(
            "⚠️ Eski basketball.json okunamadı."
        );


        return {
            matches: []
        };

    }

}


/* =========================================================
   ÇALIŞTIR
========================================================= */

main()
    .catch(error => {

        console.error("");
        console.error("❌ HATA");
        console.error(error);
        console.error("");

        process.exit(1);

    });
