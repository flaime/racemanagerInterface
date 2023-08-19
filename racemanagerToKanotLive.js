//import fs from 'fs';
//const fetch = require('fs');
//const fetch = require('node-fetch');

const cyrb53 = (str, seed = 0) => {

    //djb2 below
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash &= hash; // Convert to a 32-bit integer
    }

    return Math.abs(hash);
};

/**
 * Input example
 * '0:00.00'
 * '0:46.58'
 * '1:06.19'
 * @param lane
 * @returns {string}
 */
function getTime(result) {
    if (result.length == 7)
        return "0" + result.replace(".", ",");
    else
        return result.replace(".", ",");
}

function clubId(club) {
    return findClubMetadata(club, cyrb53(club).toString()).id;
}

function extractLanes(lanes, type) {

    const isSingel = lanes && lanes.every(obj => obj.hasOwnProperty('name') && obj.hasOwnProperty('year'));
    const isMultiple = lanes && lanes.every(obj => obj.hasOwnProperty('team'));
    if (type === null)
        console.warn("WARNING the race does not have type set but is asumed to be singel")

    let tracks = [];
    if (isSingel) {
        //if it C1 or K1
        tracks = lanes
            .filter(lane => lane.name !== null && lane.club !== null)
            .map(lane => {
                let licensNumber = cyrb53((lane.name + lane.club));
                // console.log(lane)
                return {
                    "licensNumber": null,
                    "name": lane.name,
                    "clubb": lane.club,
                    "trackNumber": lane.lane.toString(),
                    "time": getTime(lane.result.toString()), // "02:27,34",
                    "persons": [
                        {
                            "forName": getFirstName(lane.name),
                            "sureName": getLastName(lane.name),
                            "sex": "", //"H", finns inte data om i API
                            "yearOfBirth": lane.year.toString(), //"2001",
                            "licensNumber": licensNumber.toString(), //"12344-053", does only exist when people run in a besättningslopp i API:et?!
                            "club": clubId(lane.club), //"KKK"
                            // "club": lane.club //"KKK"
                            "InternalClubb": lane.club

                        }
                    ]
                }
            })
    } else if (isMultiple) {
        tracks = lanes
            .filter(lane => lane.team !== null && lane.team.length !== 0)
            .map(lane => {
                let licensNumber = cyrb53((lane.namne + lane.club));
                const persons = lane.team.map(participant => {
                    return {
                        "forName": getFirstName(participant.athlete),
                        "sureName": getLastName(participant.athlete),
                        "sex": "", //"H", finns inte data om i API
                        "yearOfBirth": participant.year.toString(), //"2001",
                        "licensNumber": licensNumber.toString(), //"12344-053", does only exist when people run in a besättningslopp i API:et?!
                        "club": cyrb53(participant.club).toString(),//"KKK"
                        // "club": participant.club //"KKK"
                        "InternalClubb": participant.club
                    }
                })

                return {
                    "licensNumber": null,
                    "name": persons.map(obj => (obj.forName + " " + obj.sureName)).join(", "),
                    "clubb": persons.map(obj => obj.club).join(", "),
                    "trackNumber": lane.lane.toString(),
                    "time": lane.result.toString().replace(".", ","), // "02:27,34",
                    "persons": persons
                }
            })
    }

    return tracks;
}

function transformToRaceTime(date, time) {
    if (time === "" || time === null)
        return (transformRacemangerDatToDate(date) + "T01:00:00")
    else
        return (transformRacemangerDatToDate(date) + "T" + time + ":00")
}

function transformRacemangerDatToDate(date) {
    const splitDate = date.split(".");
    return splitDate[2] + "-" + splitDate[1] + "-" + splitDate[0]
}

function getLastName(fullName) {
    if (fullName == null)
        return ""
    const index = fullName.indexOf(" ");
    if (index !== -1)
        return fullName.substring(index + 1).trim();
    else
        return "";
}

function getFirstName(str) {
    if (str == null)
        return ""
    const index = str.indexOf(" ");
    if (index !== -1)
        return str.substring(0, index).trim();
    else
        return "";
}

function transformTittleToType(title) {
    switch (title) {
        case "Final": //vet inte vad som skiljer "A final" och "Final" men tydligen finns båda
            return {type: "AF", typeNumber: "1"}
        case "A Final":
            return {type: "AF", typeNumber: "1"}
        case "B Final":
            return {type: "BF", typeNumber: "1"}
        case "C Final":
            return {type: "CF", typeNumber: "1"}
        case "D Final":
            return {type: "DF", typeNumber: "1"}
        case "Heat 1":
            return {type: "FÖ", typeNumber: "1"}
        case "Heat 2":
            return {type: "FÖ", typeNumber: "2"}
        case "Heat 3":
            return {type: "FÖ", typeNumber: "3"}
        case "Heat 4":
            return {type: "FÖ", typeNumber: "4"}
        case "Heat 5":
            return {type: "FÖ", typeNumber: "5"}
        case "Heat 6":
            return {type: "FÖ", typeNumber: "6"}
        default:
            return ""

        //Borde ju finnas mellanheat som då ska heta "MH" men kan inte lista ut hur racemanger tycker de ska se ut
    }
}


async function fetchCompetition(racemangerUrl, competitionName, kanotLiveUrl) {
    //console.log("starting comp")
    const racemangerCompUrl = racemangerUrl + competitionName
    console.log(racemangerCompUrl)
    const competition = await fetch(racemangerCompUrl)
        .then(response => response.json())
        .then(data => {
            let races = data.races === null ? [] : data.races;

            const promises = races.map(race => {
                return fetch(race.url)
                    .then(response => response.json())
                    .then(raceData => {

                        const races = extractLanes(raceData.lanes, raceData.type)

                        const typeData = transformTittleToType(raceData.title)
                        const race = {
                            "dateTime": transformToRaceTime(raceData.date, raceData.time),//"2017-07-17T10:00:00",
                            "distance": raceData.length.toString(), //"500",
                            "time": raceData.time, //"10:00",
                            "raceClass": raceData.category + raceData.class + (raceData.hasOwnProperty('type') && raceData.type != null ? raceData.type[1] : ''),//"H161", //cant handle canadensare yet asumes everytin is kajak.
                            "type": typeData.type, //"FÖ",
                            "typeNumber": typeData.typeNumber, // "1",
                            "raceNummer": raceData.race.toString(),//"1",
                            "tracks": races
                        }
                        return race;
                    });
            });
            return Promise.all(promises)
                .then(results => {
                    const competition = {
                        "namne": data.title,
                        //"info": "",
                        //"place": raceApiData.venue,
                        "date": data.dateFrom + " - " + data.dateTo,
                        "races": results
                    }
                    const completeRaceData = {
                        title: data.title,
                        name: data.name,
                        dateFrom: data.dateFrom,
                        dateTo: data.dateTo,
                        organizer: data.organizer,
                        venue: data.venue,
                        races: results
                    };
                    //console.log(JSON.stringify(competition));
                    sendComp(competition, kanotLiveUrl)
                    sendClubs(competition)
                    return competition
                });
        });
    //console.log("done comp")
    return competition
}

function compareString(str1, str2) {
    const fullName1 = String(str1);
    const fullName2 = String(str2);

    return fullName1.localeCompare(fullName2) === 0;
}


function findClubMetadata(name, clubId) {
    let cleanName = (name || "").replace("&amp;", "&")
    let metadataClub = clubsMetadata.find(club => compareString(club.full_name, cleanName));
    if (metadataClub === undefined) {
        console.warn("Club: " + cleanName + " is missing from metadata")
        return {
            "id": clubId,
            "display_name": cleanName,
            "full_name": cleanName,
            "licens_number": cleanName,
            "short_name": cleanName
        }
    }
    return metadataClub;
}

function sendClubs(competition) {
    console.log("sending comp")
    const clubbs = new Map();
    competition.races.map(race => {
        race.tracks.map(track => {
            track.persons.map(person => {
                clubbs.set(person.club, person.InternalClubb)
            })
        })
    })

    clubbObjects = []

    clubbs.forEach((value, key) => {
        let name = (value || "").replace("&amp;", "&")
        let clubId = key
        console.log(`${clubId} => ${name}`);
        let metadataClub = findClubMetadata(name, clubId);
        const clubb = {
            "shortName": metadataClub.short_name,
            "fullName": metadataClub.full_name,
            "displayName": metadataClub.display_name,
            "licensNumber": metadataClub.id,
        };

        // Add the object to the array
        clubbObjects.push(clubb);
    });

    let clubsJson = JSON.stringify(clubbObjects);
    console.log(clubsJson)
    console.log("sending clubbs")
    const url = "https://canoe-test-dev-3cizi.ondigitalocean.app/api/club/"
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: clubsJson
    })
        // .then(response => response.json())
        .then(data => console.log(data.status))
        // .then(data => console.log(data))
        .catch(error => console.error(error));
}

function sendComp(comp, url) {
    console.log("sending comp")
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(comp)
    })
        // .then(response => response.json())
        .then(data => console.log(data.status))
        // .then(data => console.log(data))
        .catch(error => console.error(error));
}

main({})

async function main(props) {
    const comps = [
        // {"id": "v-rregatta-2023-2023", "name": "Vårregattan-2023-test"}
        // {"id": "v-rregatta-2023-2023", "name": "Vårregattan-2023"}

        // {"id": "297615", "name": "sprint_SM-2023"}
        // {"id": "sm-sprint-nyk-ping-2023", "name": "sprint_SM-2023"},
        {"id": "marathon-sm-s-dert-lje-2023", "name": "Marathon-SM_Södertälje_2023`"}

        /*{"id": "suc-fagervik-2020", "name":"suc-fagervik-2022"},// id: 238117, "suc-fagervik-2020"
        {"id": "suc-ryrsjn-och-sup-sm-supersprint", "name":"RYRSJÖN-SUC-OCH-SUP-SM-SUPERSPRINT"}, //269340
        {"id": "h-stregatta-2022", "name":"Höstregattan-2022"},
        {"id": "rebro-black-river-games-2023-2023", "name":"ÖREBRO_BLACK_RIVER_GAMES_2023"}//https://se.racemanager.net/api/page/268352   ÖREBRO BLACK RIVER GAMES 2023
        */
    ]

    const comp = comps[Math.floor(Math.random() * comps.length)]
    console.log(comp)
//    const competition = await fetchCompetition('https://se.racemanager.net/api/page/competitions/', "h-stregatta-2022", "https://canoe-test-dev-3cizi.ondigitalocean.app/api/competitions/Höstregatta2022-2")
//    const competition = await fetchCompetition('https://se.racemanager.net/api/page/competitions/', props.comp, "https://canoe-test-dev-3cizi.ondigitalocean.app/api/competitions/" + props.compDisplayName)

    const competition = await fetchCompetition('https://se.racemanager.net/api/page/competitions/', comp.id, "https://canoe-test-dev-3cizi.ondigitalocean.app/api/competitions/" + comp.name)
    console.log(JSON.stringify(competition))

    return competition;
}


const clubsMetadata = [
    {
        "id": 3,
        "display_name": "Arvika",
        "full_name": "Arvika Kanotklubb",
        "licens_number": "12349",
        "short_name": "AKK"
    },
    {
        "id": 4,
        "display_name": "Amager, DK",
        "full_name": "Amager Ro o Kajakklub, Danmark",
        "licens_number": "99005",
        "short_name": "ARKK"
    },
    {
        "id": 5,
        "display_name": "Ahlainen, SF",
        "full_name": "Ahlaisten Urheilijat, Ahlainen, SF",
        "licens_number": "99202",
        "short_name": "AUAF"
    },
    {
        "id": 6,
        "display_name": "Bengtsfors",
        "full_name": "Bengtsfors BoIS",
        "licens_number": "01155",
        "short_name": "BBO"
    },
    {
        "id": 7,
        "display_name": "Brunnsviken",
        "full_name": "Brunnsvikens Kanotklubb",
        "licens_number": "12331",
        "short_name": "BKK"
    },
    {
        "id": 8,
        "display_name": "Boo",
        "full_name": "Boo Kanot och Skidklubb",
        "licens_number": "44685",
        "short_name": "BKOS"
    },
    {
        "id": 9,
        "display_name": "Bromölla",
        "full_name": "Bromölla Kanotklubb",
        "licens_number": "12314",
        "short_name": "BmKK"
    },
    {
        "id": 10,
        "display_name": "Baerum, NOR",
        "full_name": "Baerum, Norge",
        "licens_number": "99104",
        "short_name": "BNOR"
    },
    {
        "id": 11,
        "display_name": "Bo",
        "full_name": "Bo",
        "licens_number": "77700",
        "short_name": "Bo"
    },
    {
        "id": 12,
        "display_name": "Bodö",
        "full_name": "Bodö KK, Norge",
        "licens_number": "99902",
        "short_name": "Bodö"
    },
    {
        "id": 13,
        "display_name": "Bofors",
        "full_name": "Bofors Kanotklubb",
        "licens_number": "12350",
        "short_name": "BoKK"
    },
    {
        "id": 14,
        "display_name": "Bråviken",
        "full_name": "Bråvikens Kanotklubb",
        "licens_number": "12364",
        "short_name": "BrKK"
    },
    {
        "id": 15,
        "display_name": "Borlänge",
        "full_name": "Borlänge Kanotklubb",
        "licens_number": "12293",
        "short_name": "BäKK"
    },
    {
        "id": 16,
        "display_name": "Canoa, SF",
        "full_name": "Canoa Finland",
        "licens_number": "99207",
        "short_name": "Can"
    },
    {
        "id": 17,
        "display_name": "Tjeckien",
        "full_name": "Tjeckien",
        "licens_number": "77777",
        "short_name": "CZ"
    },
    {
        "id": 18,
        "display_name": "Danmark",
        "full_name": "Danmark",
        "licens_number": "99000",
        "short_name": "DEN"
    },
    {
        "id": 19,
        "display_name": "Dala Z",
        "full_name": "Region Dala Z",
        "licens_number": "10103",
        "short_name": "DZRF"
    },
    {
        "id": 20,
        "display_name": "Eskilstuna",
        "full_name": "Eskilstuna Kanotsällskap",
        "licens_number": "12343",
        "short_name": "EKS"
    },
    {
        "id": 21,
        "display_name": "Estland",
        "full_name": "Estland",
        "licens_number": "99500",
        "short_name": "EST"
    },
    {
        "id": 22,
        "display_name": "Farsund, Norge",
        "full_name": "Farsund Kajakklubb, Norge",
        "licens_number": "99112",
        "short_name": "FaKK"
    },
    {
        "id": 23,
        "display_name": "Fredericia, DK",
        "full_name": "Fredericia KK",
        "licens_number": "99024",
        "short_name": "FcKK"
    },
    {
        "id": 24,
        "display_name": "Floda",
        "full_name": "Floda Forsfarare",
        "licens_number": "12295",
        "short_name": "FFF"
    },
    {
        "id": 25,
        "display_name": "Finspång",
        "full_name": "Finspångs Kanotklubb",
        "licens_number": "12365",
        "short_name": "FiKK"
    },
    {
        "id": 26,
        "display_name": "Finland",
        "full_name": "Finland",
        "licens_number": "99200",
        "short_name": "FIN"
    },
    {
        "id": 27,
        "display_name": "Fagervik",
        "full_name": "Fagerviks Kanotklubb",
        "licens_number": "12307",
        "short_name": "FKK"
    },
    {
        "id": 28,
        "display_name": "Flekkefjord, No",
        "full_name": "Flekkefjord kajakklubb, Norge",
        "licens_number": "99111",
        "short_name": "FKKN"
    },
    {
        "id": 29,
        "display_name": "Fana, NOR",
        "full_name": "Fana kanotklubb, Norge",
        "licens_number": "99109",
        "short_name": "FNOR"
    },
    {
        "id": 30,
        "display_name": "Fridhem",
        "full_name": "Fridhemskanotisterna",
        "licens_number": "12333",
        "short_name": "FrKK"
    },
    {
        "id": 31,
        "display_name": "Tyskland",
        "full_name": "Tyskland",
        "licens_number": "99301",
        "short_name": "GER"
    },
    {
        "id": 32,
        "display_name": "Göteborg",
        "full_name": "Göteborgs Kanotförening",
        "licens_number": "01897",
        "short_name": "GKF"
    },
    {
        "id": 33,
        "display_name": "Gladsaxe, DK",
        "full_name": "Gladsaxe Kano o Kajakk, Danmark",
        "licens_number": "99001",
        "short_name": "GKKK"
    },
    {
        "id": 34,
        "display_name": "Hammarö",
        "full_name": "Hammarö Paddlarklubb",
        "licens_number": "12351",
        "short_name": "HaKK"
    },
    {
        "id": 35,
        "display_name": "Hawaii",
        "full_name": "Hawaii",
        "licens_number": "99401",
        "short_name": "HAW"
    },
    {
        "id": 36,
        "display_name": "Helsingborg",
        "full_name": "Helsingborgskanotisterna",
        "licens_number": "12315",
        "short_name": "HBK"
    },
    {
        "id": 37,
        "display_name": "Holstebro, DK",
        "full_name": "Holstebro Kajakklub, Danmark",
        "licens_number": "99015",
        "short_name": "HbKK"
    },
    {
        "id": 38,
        "display_name": "Hellerup, DK",
        "full_name": "Hellerup Kanoklub, Danmark",
        "licens_number": "99010",
        "short_name": "HeKK"
    },
    {
        "id": 39,
        "display_name": "Hörup Hav, DK",
        "full_name": "Hörup Hav Kajakklub, Danmark",
        "licens_number": "99016",
        "short_name": "HHKK"
    },
    {
        "id": 41,
        "display_name": "Hindås",
        "full_name": "Hindås Kanot- och Friluftsklubb",
        "licens_number": "12370",
        "short_name": "HKFK"
    },
    {
        "id": 42,
        "display_name": "Hofors",
        "full_name": "Hofors Kanotklubb",
        "licens_number": "12300",
        "short_name": "HKK"
    },
    {
        "id": 43,
        "display_name": "Halmstad",
        "full_name": "Halmstad Kanotklubb",
        "licens_number": "12302",
        "short_name": "HmKK"
    },
    {
        "id": 44,
        "display_name": "Holte, DK",
        "full_name": "Holte Roklub, Danmark",
        "licens_number": "99022",
        "short_name": "HRKD"
    },
    {
        "id": 45,
        "display_name": "Huskvarna",
        "full_name": "Huskvarna Kanotklubb",
        "licens_number": "12325",
        "short_name": "HuKK"
    },
    {
        "id": 46,
        "display_name": "Hvidovre, DK",
        "full_name": "Hvidovre Kanoklub, Danmark",
        "licens_number": "99009",
        "short_name": "HvKK"
    },
    {
        "id": 47,
        "display_name": "Höör",
        "full_name": "Höörs Kanotklubb",
        "licens_number": "12317",
        "short_name": "HöKK"
    },
    {
        "id": 48,
        "display_name": "Jönköping",
        "full_name": "Jönköpings Kanotklubb",
        "licens_number": "12326",
        "short_name": "JKK"
    },
    {
        "id": 49,
        "display_name": "Järfälla",
        "full_name": "Järfälla kanot&Roddklubb",
        "licens_number": "02414",
        "short_name": "JKRK"
    },
    {
        "id": 50,
        "display_name": "KK 361, DK",
        "full_name": "Kanoklubben 361, Danmark",
        "licens_number": "99014",
        "short_name": "K361"
    },
    {
        "id": 51,
        "display_name": "Kalmar",
        "full_name": "Kalmar Kanotklubb",
        "licens_number": "12327",
        "short_name": "KaKK"
    },
    {
        "id": 52,
        "display_name": "Kangasalan",
        "full_name": "Kangasalan Melojat, Finland",
        "licens_number": "99205",
        "short_name": "KanM"
    },
    {
        "id": 53,
        "display_name": "Köpenhamn, DK",
        "full_name": "Kraft Center Köpenhamn, Danmark",
        "licens_number": "99017",
        "short_name": "KCKD"
    },
    {
        "id": 55,
        "display_name": "KFBP",
        "full_name": "Kramratföreningen för främjande av besättningspadd",
        "licens_number": "50180",
        "short_name": "KFBP"
    },
    {
        "id": 56,
        "display_name": "Södertälje",
        "full_name": "Kanotför. Kanotisterna Södertälje",
        "licens_number": "02477",
        "short_name": "KFKS"
    },
    {
        "id": 57,
        "display_name": "Essen, GER ",
        "full_name": "KG Essen, Tyskland",
        "licens_number": "99302",
        "short_name": "KGEG"
    },
    {
        "id": 58,
        "display_name": "KK Bris",
        "full_name": "Kanotklubben Bris",
        "licens_number": "12301",
        "short_name": "KKB"
    },
    {
        "id": 59,
        "display_name": "KK Eskimå",
        "full_name": "Kajakklubben Eskimå",
        "licens_number": "12288",
        "short_name": "KKE"
    },
    {
        "id": 60,
        "display_name": "KK Glid",
        "full_name": "Kanotklubben Glid",
        "licens_number": "12334",
        "short_name": "KKG"
    },
    {
        "id": 61,
        "display_name": "Katrineholm",
        "full_name": "Katrineholms Kanotklubb",
        "licens_number": "12344",
        "short_name": "KKK"
    },
    {
        "id": 62,
        "display_name": "Kungsör",
        "full_name": "Kanotklubben Kungsörnen",
        "licens_number": "12362",
        "short_name": "KKKK"
    },
    {
        "id": 63,
        "display_name": "Neptun, DK",
        "full_name": "Kajakklubben Neptun, Danmark",
        "licens_number": "99020",
        "short_name": "KKNn"
    },
    {
        "id": 64,
        "display_name": "Vejle Å, DK",
        "full_name": "Kano & Kajakklubben Vejle Å",
        "licens_number": "99036",
        "short_name": "KKVÅ"
    },
    {
        "id": 66,
        "display_name": "Karlstad",
        "full_name": "Karlstads Paddlarklubb",
        "licens_number": "12352",
        "short_name": "KPK"
    },
    {
        "id": 67,
        "display_name": "Kristianstad",
        "full_name": "Kristianstads Kanotklubb",
        "licens_number": "12318",
        "short_name": "KrKK"
    },
    {
        "id": 68,
        "display_name": "Kristiansand ,N",
        "full_name": "Kristiansands Kanotklubb, Norge",
        "licens_number": "99105",
        "short_name": "KsKK"
    },
    {
        "id": 69,
        "display_name": "KS Ägir",
        "full_name": "Kanotsällskapet Ägir",
        "licens_number": "04627",
        "short_name": "KSÄ"
    },
    {
        "id": 70,
        "display_name": "Kungälv",
        "full_name": "Kungälvs Kanotklubb",
        "licens_number": "12372",
        "short_name": "KäKK"
    },
    {
        "id": 71,
        "display_name": "Köping",
        "full_name": "Köpings Kanotklubb",
        "licens_number": "04567",
        "short_name": "KöKK"
    },
    {
        "id": 72,
        "display_name": "Køge, DK",
        "full_name": "Køge Kano og Kajak Klub",
        "licens_number": "99032",
        "short_name": "Køge"
    },
    {
        "id": 73,
        "display_name": "Landskrona",
        "full_name": "Landskrona Kanotklubb",
        "licens_number": "12319",
        "short_name": "LaKK"
    },
    {
        "id": 74,
        "display_name": "Lettland",
        "full_name": "Lettland",
        "licens_number": "99600",
        "short_name": "LAT"
    },
    {
        "id": 75,
        "display_name": "Laksevåg, N",
        "full_name": "Laksevåg Kanotklubb, Norge",
        "licens_number": "99107",
        "short_name": "LavN"
    },
    {
        "id": 76,
        "display_name": "Lidköping",
        "full_name": "Lidköpings Kanotförening",
        "licens_number": "12358",
        "short_name": "LdKF"
    },
    {
        "id": 77,
        "display_name": "Limfjord, DK",
        "full_name": "Limfjord Danmark",
        "licens_number": "99045",
        "short_name": "LiDK"
    },
    {
        "id": 78,
        "display_name": "Luleå",
        "full_name": "Luleå Kajakklubb",
        "licens_number": "12311",
        "short_name": "LKK"
    },
    {
        "id": 79,
        "display_name": "Lyngby, DK",
        "full_name": "Lyngby Kano o Kajakklub, Danmark",
        "licens_number": "99012",
        "short_name": "LKKK"
    },
    {
        "id": 80,
        "display_name": "Linköping",
        "full_name": "Linköpings Kanotklubb",
        "licens_number": "12367",
        "short_name": "LnKK"
    },
    {
        "id": 81,
        "display_name": "Ludvika",
        "full_name": "Ludvika Paddlarklubb",
        "licens_number": "12297",
        "short_name": "LPK"
    },
    {
        "id": 82,
        "display_name": "Litauen",
        "full_name": "Litauen",
        "licens_number": "99700",
        "short_name": "LTU"
    },
    {
        "id": 83,
        "display_name": "Lödde",
        "full_name": "Lödde Kanotklubb",
        "licens_number": "12320",
        "short_name": "LöKK"
    },
    {
        "id": 84,
        "display_name": "Marselisborg",
        "full_name": "Marselisborg KK, Danmark",
        "licens_number": "99026",
        "short_name": "MbKD"
    },
    {
        "id": 85,
        "display_name": "Marselisb, DK",
        "full_name": "Marselisborg KK",
        "licens_number": "99025",
        "short_name": "MbKK"
    },
    {
        "id": 86,
        "display_name": "MeMa, SF",
        "full_name": "Melamajavat",
        "licens_number": "99208",
        "short_name": "MeMa"
    },
    {
        "id": 87,
        "display_name": "Meri, SF",
        "full_name": "Merimelojat, Finland",
        "licens_number": "99206",
        "short_name": "Meri"
    },
    {
        "id": 88,
        "display_name": "Mikkelin Meloja",
        "full_name": "Mikkelin Melojat, St.Michels",
        "licens_number": "99211",
        "short_name": "MiMe"
    },
    {
        "id": 89,
        "display_name": "Malmö",
        "full_name": "Malmö Kanotklubb",
        "licens_number": "12321",
        "short_name": "MKK"
    },
    {
        "id": 90,
        "display_name": "Maribo, DK",
        "full_name": "Maribo KK, Danmark",
        "licens_number": "99013",
        "short_name": "MKKD"
    },
    {
        "id": 91,
        "display_name": "Moss, NOR",
        "full_name": "Moss Kajakklubb, Norge",
        "licens_number": "99101",
        "short_name": "MKKN"
    },
    {
        "id": 92,
        "display_name": "Moälven",
        "full_name": "Moälvens Kanotklubb",
        "licens_number": "24350",
        "short_name": "MoKK"
    },
    {
        "id": 93,
        "display_name": "Mellansvenska",
        "full_name": "Region Mellansvenska",
        "licens_number": "10106",
        "short_name": "MRF"
    },
    {
        "id": 94,
        "display_name": "MSN",
        "full_name": "Skåne Mellan Norr",
        "licens_number": "00004",
        "short_name": "MSN"
    },
    {
        "id": 96,
        "display_name": "Nybro Furå, DK",
        "full_name": "Nybro Furå Kano o Kajakk, Danmark",
        "licens_number": "99002",
        "short_name": "NFKK"
    },
    {
        "id": 97,
        "display_name": "Forspaddlare",
        "full_name": "Föreningen Nyköpings Forspaddlare - Kanot",
        "licens_number": "41673",
        "short_name": "NFP"
    },
    {
        "id": 98,
        "display_name": "Njörd, NOR",
        "full_name": "Njörd kanotklubb, Norge",
        "licens_number": "99106",
        "short_name": "NjdN"
    },
    {
        "id": 99,
        "display_name": "Nyköping",
        "full_name": "Nyköpings Kanotklubb",
        "licens_number": "12345",
        "short_name": "NKK"
    },
    {
        "id": 100,
        "display_name": "Nord KKK Olso",
        "full_name": "Nord Kano- og Kajakk-Klubb ",
        "licens_number": "99113",
        "short_name": "NKKK"
    },
    {
        "id": 101,
        "display_name": "Nedre Norrland",
        "full_name": "Region Nedre Norrland",
        "licens_number": "10109",
        "short_name": "NNRF"
    },
    {
        "id": 102,
        "display_name": "Norge",
        "full_name": "Norge",
        "licens_number": "99100",
        "short_name": "NOR"
    },
    {
        "id": 103,
        "display_name": "Näset",
        "full_name": "Näsets Paddlarklubb",
        "licens_number": "03219",
        "short_name": "NPK"
    },
    {
        "id": 104,
        "display_name": "Nynäshamn",
        "full_name": "Nynäshamns Segelsällskap Kanot",
        "licens_number": "03207",
        "short_name": "NSS"
    },
    {
        "id": 105,
        "display_name": "Nyköbing, DK",
        "full_name": "Nyköbing F Kanoklub, Danmark",
        "licens_number": "99008",
        "short_name": "NyKK"
    },
    {
        "id": 106,
        "display_name": "Odense, DK",
        "full_name": "Odense Kajakklub",
        "licens_number": "99031",
        "short_name": "OdKK"
    },
    {
        "id": 107,
        "display_name": "Oxelösund",
        "full_name": "Oxelösunds Kanotklubb",
        "licens_number": "12346",
        "short_name": "OKK"
    },
    {
        "id": 108,
        "display_name": "Oslo, NOR",
        "full_name": "Oslo Kajakklubb, Norge",
        "licens_number": "99110",
        "short_name": "ONOR"
    },
    {
        "id": 109,
        "display_name": "Oskarshamn",
        "full_name": "Oskarshamns Kanot o Frisksport",
        "licens_number": "22658",
        "short_name": "OSK"
    },
    {
        "id": 110,
        "display_name": "Pagaj, DK",
        "full_name": "Pagaj Kanoklub, Danmark",
        "licens_number": "99006",
        "short_name": "PaKK"
    },
    {
        "id": 111,
        "display_name": "Paddla i Väst",
        "full_name": "Paddla i Väst",
        "licens_number": "00003",
        "short_name": "PiV"
    },
    {
        "id": 112,
        "display_name": "PK Delfinen",
        "full_name": "Paddlarklubben Delfinen",
        "licens_number": "12368",
        "short_name": "PKD"
    },
    {
        "id": 113,
        "display_name": "Palo, DK",
        "full_name": "Palo Kanotklubb, Danmark",
        "licens_number": "99023",
        "short_name": "PKKD"
    },
    {
        "id": 114,
        "display_name": "Tammerfors, SF",
        "full_name": "Pirkka-Melojat, Tammerfors, Finland",
        "licens_number": "99201",
        "short_name": "PTF"
    },
    {
        "id": 115,
        "display_name": "Roslagen",
        "full_name": "Roslagens Kanotsällskap",
        "licens_number": "12374",
        "short_name": "RKS"
    },
    {
        "id": 116,
        "display_name": "Stockholm",
        "full_name": "Region Stockholm",
        "licens_number": "00002",
        "short_name": "RSS"
    },
    {
        "id": 117,
        "display_name": "Östra",
        "full_name": "Östra Sverige",
        "licens_number": "00001",
        "short_name": "RÖS"
    },
    {
        "id": 118,
        "display_name": "Skanderborg",
        "full_name": "Skanderborg Kanoklub, Danmark",
        "licens_number": "99007",
        "short_name": "SbKK"
    },
    {
        "id": 119,
        "display_name": "Smål-Blekinge",
        "full_name": "Region Småland, Blekinge",
        "licens_number": "10102",
        "short_name": "SBRF"
    },
    {
        "id": 120,
        "display_name": "Sorö, DK",
        "full_name": "Sorö Cano o Kajak Club, Danmark",
        "licens_number": "99011",
        "short_name": "SCKC"
    },
    {
        "id": 121,
        "display_name": "Skanderborg",
        "full_name": "Skanderborg Kajakklubb, Danmark",
        "licens_number": "99029",
        "short_name": "SDK"
    },
    {
        "id": 122,
        "display_name": "Silkeborg, DK",
        "full_name": "Silkeborg Kajakklub, Danmark",
        "licens_number": "99018",
        "short_name": "SgKK"
    },
    {
        "id": 123,
        "display_name": "Stockholms KK",
        "full_name": "Stockholms Kajakklubb",
        "licens_number": "12338",
        "short_name": "SKK"
    },
    {
        "id": 124,
        "display_name": "Skellefteå",
        "full_name": "Skellefteå Kanotklubb",
        "licens_number": "12354",
        "short_name": "SkKK"
    },
    {
        "id": 125,
        "display_name": "Strand, NOR",
        "full_name": "Strand Kajakk-klubb, Oslo",
        "licens_number": "99102",
        "short_name": "SKKN"
    },
    {
        "id": 126,
        "display_name": "Skåne",
        "full_name": "Region Skåne",
        "licens_number": "10101",
        "short_name": "SkRF"
    },
    {
        "id": 127,
        "display_name": "Saaristomeren, ",
        "full_name": "Saaristomeren Melojat",
        "licens_number": "99209",
        "short_name": "SMM"
    },
    {
        "id": 128,
        "display_name": "Karlsborg",
        "full_name": "SOK-Träff",
        "licens_number": "4166",
        "short_name": "SOK"
    },
    {
        "id": 129,
        "display_name": "Sollentuna",
        "full_name": "Sollentuna Kanotsällskap",
        "licens_number": "12337",
        "short_name": "SoKS"
    },
    {
        "id": 130,
        "display_name": "Stockholms PK",
        "full_name": "Stockholms Paddlarklubb",
        "licens_number": "12339",
        "short_name": "SPK"
    },
    {
        "id": 131,
        "display_name": "Skaelskör, DK",
        "full_name": "Skaelskör Kajakklub, Danmark",
        "licens_number": "99021",
        "short_name": "SsKK"
    },
    {
        "id": 132,
        "display_name": "Sandviken",
        "full_name": "Sandvikens Segelsällskap Kanot",
        "licens_number": "03511",
        "short_name": "SSS"
    },
    {
        "id": 133,
        "display_name": "Sundby, DK",
        "full_name": "Sundby Kanoklub, Danmark",
        "licens_number": "99004",
        "short_name": "SuKK"
    },
    {
        "id": 134,
        "display_name": "Sthlm-Uppland",
        "full_name": "Region Stockholm, Uppland",
        "licens_number": "10107",
        "short_name": "SURF"
    },
    {
        "id": 135,
        "display_name": "Sverige",
        "full_name": "Sverige",
        "licens_number": "90000",
        "short_name": "SWE"
    },
    {
        "id": 136,
        "display_name": "Söderm-Öster",
        "full_name": "Region Södermanland, Öster",
        "licens_number": "10105",
        "short_name": "SÖRF"
    },
    {
        "id": 137,
        "display_name": "Tibro",
        "full_name": "Tibro Kanotklubb",
        "licens_number": "12359",
        "short_name": "TiKK"
    },
    {
        "id": 138,
        "display_name": "Tullinge",
        "full_name": "Tullinge Kanotförening",
        "licens_number": "12222",
        "short_name": "TKF"
    },
    {
        "id": 139,
        "display_name": "Trollhättan",
        "full_name": "Trollhätte Kanotklubb",
        "licens_number": "12360",
        "short_name": "TKK"
    },
    {
        "id": 140,
        "display_name": "Tönsberg,NOR",
        "full_name": "Tönsberg Norge",
        "licens_number": "99103",
        "short_name": "TNOR"
    },
    {
        "id": 141,
        "display_name": "Tysvaer, NOR",
        "full_name": "Tysvaer Kanotklubb, Norge",
        "licens_number": "99108",
        "short_name": "TsvN"
    },
    {
        "id": 142,
        "display_name": "TammerforsFIN",
        "full_name": "Tavi/Tammerfors, Finland",
        "licens_number": "99203",
        "short_name": "TTF"
    },
    {
        "id": 143,
        "display_name": "Tampere Finland",
        "full_name": "Tamperen Vihuri ,SF",
        "licens_number": "99213",
        "short_name": "TVF"
    },
    {
        "id": 144,
        "display_name": "Ulricehamn",
        "full_name": "Ulricehamns Kanotsällskap",
        "licens_number": "04242",
        "short_name": "UKS"
    },
    {
        "id": 145,
        "display_name": "Vasa",
        "full_name": "Vasa KK",
        "licens_number": "99901",
        "short_name": "Vasa"
    },
    {
        "id": 146,
        "display_name": "Vanajaveden, SF",
        "full_name": "Vanajaveden Vesikot",
        "licens_number": "99210",
        "short_name": "VaVe"
    },
    {
        "id": 147,
        "display_name": "Vårby",
        "full_name": "Vårby IK",
        "licens_number": "04460",
        "short_name": "VIK"
    },
    {
        "id": 148,
        "display_name": "Växjö",
        "full_name": "Växjö Kanot Club",
        "licens_number": "12329",
        "short_name": "VKC"
    },
    {
        "id": 149,
        "display_name": "Västerås",
        "full_name": "Västerås Kanotförening",
        "licens_number": "04518",
        "short_name": "VKF"
    },
    {
        "id": 150,
        "display_name": "Vallensbaek,DK",
        "full_name": "Vallensbaek Kanoklub, Danmark",
        "licens_number": "99003",
        "short_name": "VKKC"
    },
    {
        "id": 151,
        "display_name": "Lahtis, FIN",
        "full_name": "Vesa/Lahtis, Finland",
        "licens_number": "99204",
        "short_name": "VLF"
    },
    {
        "id": 152,
        "display_name": "VästKan",
        "full_name": "Region Västsvenska",
        "licens_number": "10104",
        "short_name": "VäKa"
    },
    {
        "id": 153,
        "display_name": "Wag",
        "full_name": "Kanotklubben Wågen, Finland",
        "licens_number": "99212",
        "short_name": "Wag"
    },
    {
        "id": 154,
        "display_name": "Web",
        "full_name": "Webbklubben Paddel",
        "licens_number": "55500",
        "short_name": "WEB"
    },
    {
        "id": 155,
        "display_name": "Westervik",
        "full_name": "Westerviks Kanotklubb",
        "licens_number": "12330",
        "short_name": "WKK"
    },
    {
        "id": 156,
        "display_name": "Waxholm",
        "full_name": "Waxholms Kanotsällskap",
        "licens_number": "04345",
        "short_name": "WKS"
    },
    {
        "id": 157,
        "display_name": "Ängelholm",
        "full_name": "Ängelholms Rodd & Kanot",
        "licens_number": "12323",
        "short_name": "ÄhKK"
    },
    {
        "id": 158,
        "display_name": "Älvkarleby",
        "full_name": "Älvkarleby Kanotklubb",
        "licens_number": "12373",
        "short_name": "ÄKK"
    },
    {
        "id": 159,
        "display_name": "Örebro",
        "full_name": "Örebro Kanotförening",
        "licens_number": "04689",
        "short_name": "ÖKF"
    },
    {
        "id": 160,
        "display_name": "Örnsberg",
        "full_name": "Örnsbergs Kanotsällskap",
        "licens_number": "12342",
        "short_name": "ÖKS"
    },
    {
        "id": 161,
        "display_name": "Övre Norrland",
        "full_name": "Region Övre Norrland",
        "licens_number": "10108",
        "short_name": "ÖNRF"
    },
    {
        "id": 639158,
        "display_name": "Okänd",
        "full_name": "okänd klubb",
        "licens_number": "backup",
        "short_name": "okänd"
    },
    {
        "id": 95,
        "display_name": "Skovshoved",
        "full_name": "Skovshoved Roklub",
        "licens_number": "99030",
        "short_name": "ShRk"
    },
    {
        "id": 54,
        "display_name": "Struer",
        "full_name": "Struer Kajakklubb, Danmark",
        "licens_number": "99028",
        "short_name": "SkDK"
    },
    {
        "id": 65,
        "display_name": "Vejle",
        "full_name": "Vejle Kajakklub, Danmark",
        "licens_number": "99027",
        "short_name": "VKDK"
    },
    {
        "id": 1450630,
        "display_name": "Jarna CC",
        "full_name": "Jarna CC",
        "licens_number": "99999",
        "short_name": "JCC"
    },
    {
        "id": 40,
        "display_name": "Örkelljunga",
        "full_name": "Örkelljunga Rodd & Kanotklubb",
        "licens_number": "12316",
        "short_name": "ÖRK"
    }
]