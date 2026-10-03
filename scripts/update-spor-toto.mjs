import fs from "node:fs";
import path from "node:path";

const BASE =
    "https://totokazan.com";

const ARCHIVE =
    `${BASE}/spor-toto`;

const OUTPUT =
    path.join(
        process.cwd(),
        "data",
        "spor-toto.json"
    );


function clean(value) {

    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}


function resultFromScore(score) {

    if (!score || score === "—") {
        return null;
    }

    const match =
        score.match(
            /(\d+)\s*-\s*(\d+)/
        );

    if (!match) {
        return null;
    }

    const home =
        Number(match[1]);

    const away =
        Number(match[2]);

    if (home > away) return "1";
    if (home < away) return "2";

    return "X";
}


async function getHtml(url) {

    const response =
        await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 GitHubActions"
            }
        });

    if (!response.ok) {

        throw new Error(
            `${url} -> HTTP ${response.status}`
        );
    }

    return response.text();
}


/*
 * Basit HTML tablo parser.
 *
 * Harici paket gerektirmez.
 */

function parseTable(html) {

    const rows = [];

    const tableMatch =
        html.match(
            /<table[\s\S]*?<\/table>/i
        );

    if (!tableMatch) {
        return rows;
    }

    const table =
        tableMatch[0];

    const trMatches =
        table.match(
            /<tr[\s\S]*?<\/tr>/gi
        ) || [];

    for (
        const tr of trMatches
    ) {

        const cells =
            tr.match(
                /<(?:td|th)[^>]*>[\s\S]*?<\/(?:td|th)>/gi
            ) || [];

        const values =
            cells.map(cell => {

                return clean(
                    cell
                        .replace(
                            /<[^>]+>/g,
                            " "
                        )
                        .replace(
                            /&nbsp;/g,
                            " "
                        )
                        .replace(
                            /&amp;/g,
                            "&"
                        )
                );

            });

        if (values.length) {
            rows.push(values);
        }
    }

    return rows;
}


/*
 * Haftanın 15 maçını ayıkla.
 */

function parseWeek(
    html,
    season,
    week
) {

    const rows =
        parseTable(html);


    const matches = [];


    for (
        const row of rows
    ) {

        /*
         * Beklenen yapı:
         *
         * No
         * Ev
         * Skor
         * Deplasman
         * MS
         * Oynanma
         */

        if (
            row.length < 5
        ) {
            continue;
        }


        const no =
            Number(row[0]);


        if (
            !Number.isInteger(no) ||
            no < 1 ||
            no > 15
        ) {
            continue;
        }


        const home =
            row[1];

        const score =
            row[2];

        const away =
            row[3];

        const ms =
            row[4] === "—"
            ? null
            : row[4];


        if (
            !home ||
            !away
        ) {
            continue;
        }


        matches.push({

            no,

            home,

            away,

            score:
                score === "—"
                ? null
                : score,

            result:
                ms ||
                resultFromScore(
                    score
                ),

            played:
                !!(
                    ms &&
                    ms !== "—"
                )
        });
    }


    matches.sort(
        (a,b) =>
            a.no - b.no
    );


    return {

        id:
            `${season}-${week}`,

        season,

        week,

        matches:
            matches.slice(0,15)
    };
}


/*
 * Arşiv sayfasından hafta linklerini bul.
 */

function findWeekLinks(html) {

    const links = [];

    const regex =
        /href=["']([^"']*spor-toto\/[^"']+)["']/gi;


    let match;

    while (
        (match = regex.exec(html))
    ) {

        let href =
            match[1];

        if (
            !href.startsWith("http")
        ) {

            href =
                `${BASE}${href}`;
        }


        const parsed =
            href.match(
                /spor-toto\/(\d{4}-\d{4})-(\d+)-hafta/i
            );


        if (!parsed) {
            continue;
        }


        links.push({

            url: href,

            season:
                parsed[1],

            week:
                Number(parsed[2])
        });
    }


    const unique =
        new Map();


    links.forEach(item => {

        unique.set(
            `${item.season}-${item.week}`,
            item
        );

    });


    return [
        ...unique.values()
    ];
}


/*
 * Önce arşiv sayfası.
 */

const archiveHtml =
    await getHtml(
        ARCHIVE
    );


let weekLinks =
    findWeekLinks(
        archiveHtml
    );


/*
 * Güncel haftayı da garanti et.
 *
 * Sayfada görünmese bile ana sayfadan
 * başlığı okuyacağız.
 */

const currentMatch =
    archiveHtml.match(
        /Güncel Hafta:[\s\S]*?(\d{4}-\d{4})\s*Spor Toto\s*(\d+)\.\s*Hafta/i
    );


if (currentMatch) {

    const season =
        currentMatch[1];

    const week =
        Number(currentMatch[2]);


    const exists =
        weekLinks.some(
            x =>
                x.season === season &&
                x.week === week
        );


    if (!exists) {

        weekLinks.push({

            url:
                `${BASE}/spor-toto/${season}-${week}-hafta`,

            season,

            week
        });
    }
}


/*
 * En fazla son 20 haftayı çek.
 *
 * Sonraki çalışmalarda mevcut JSON korunur.
 */

weekLinks.sort(
    (a,b) =>
        (
            b.season.localeCompare(
                a.season
            )
        ) ||
        (
            b.week -
            a.week
        )
);


weekLinks =
    weekLinks.slice(0,20);


/*
 * Eski dosyayı oku.
 */

let old = {

    currentWeek: "",

    updatedAt: "",

    weeks: []
};


if (
    fs.existsSync(OUTPUT)
) {

    try {

        old =
            JSON.parse(
                fs.readFileSync(
                    OUTPUT,
                    "utf8"
                )
            );

    } catch {

        console.log(
            "Eski JSON okunamadı."
        );
    }
}


const oldMap =
    new Map(
        (old.weeks || [])
            .map(
                w =>
                    [
                        w.id,
                        w
                    ]
            )
    );


/*
 * Her haftayı çek.
 */

for (
    const item of weekLinks
) {

    try {

        console.log(
            `Çekiliyor: ${item.season} ${item.week}. hafta`
        );


        const html =
            await getHtml(
                item.url
            );


        const week =
            parseWeek(
                html,
                item.season,
                item.week
            );


        if (
            week.matches.length === 15
        ) {

            oldMap.set(
                week.id,
                week
            );

            console.log(
                `${week.id}: 15 maç`
            );

        } else {

            console.log(
                `${week.id}: ${week.matches.length} maç bulundu, eski veri korunuyor.`
            );
        }

    } catch(error) {

        console.error(
            `${item.season}-${item.week}:`,
            error.message
        );
    }
}


const weeks =
    [...oldMap.values()]
        .sort(
            (a,b) =>
                b.season.localeCompare(
                    a.season
                ) ||
                b.week - a.week
        );


const currentWeek =
    weeks.length
    ?
    weeks[0].id
    :
    "";


const output = {

    currentWeek,

    updatedAt:
        new Date().toISOString(),

    weeks
};


fs.mkdirSync(
    path.dirname(OUTPUT),
    {
        recursive:true
    }
);


fs.writeFileSync(

    OUTPUT,

    JSON.stringify(
        output,
        null,
        2
    ),

    "utf8"
);


console.log(
    `Tamamlandı: ${weeks.length} hafta`
);
