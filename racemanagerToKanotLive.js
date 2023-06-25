//import fs from 'fs';
//const fetch = require('fs');
//const fetch = require('node-fetch');

const cyrb53 = (str, seed = 0) => {
    // let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    // for(let i = 0, ch; i < str.length; i++) {
    //     ch = str.charCodeAt(i);
    //     h1 = Math.imul(h1 ^ ch, 2654435761);
    //     h2 = Math.imul(h2 ^ ch, 1597334677);
    // }
    // h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    // h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    // h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    // h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    //
    // return 4294967296 * (2097151 & h2) + (h1 >>> 0);

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

function extractLanes(lanes, type) {

    const isSingel = lanes && lanes.every(obj => obj.hasOwnProperty('name') && obj.hasOwnProperty('year'));
    const isMultiple = lanes && lanes.every(obj => obj.hasOwnProperty('team'));
    if (type === null)
        console.log("WARNING the race does not have type set but is asumed to be singel")

    var tracks = []
    if (isSingel) {
        //if it C1 or K1
        tracks = lanes.map(lane => {
            let licensNumber = cyrb53((lane.namne + lane.club));
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
                        "club": cyrb53(lane.club).toString(), //"KKK"
                        // "club": lane.club //"KKK"
                        "InternalClubb": lane.club

                    }
                ]
            }
        })
    } else if (isMultiple) {
        tracks = lanes.map(lane => {
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
                    "InternalClubb": lane.club
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
    const competition = await fetch(racemangerCompUrl)//h-stregatta-2022
        .then(response => response.json())
        .then(data => {
            var races = data.races;
            if (races === null)
                races = []
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
        console.log(`${key} => ${value}`);
        const clubb = {
            "shortName": value,
            "fullName": value,
            "displayName": value,
            "licensNumber": key,
        };

        // Add the object to the array
        clubbObjects.push(clubb);
    });


    // clubbs.forEach(function(value) {
    //     // Create a new object for each element in the Set
    //     const clubb = {
    //         "shortName": value,
    //         "fullName": value,
    //         "displayName": value,
    //         "licensNumber": cyrb53(value).toString(),
    //     };
    //
    //     // Add the object to the array
    //     clubbObjects.push(clubb);
    // });

    console.log(JSON.stringify(clubbObjects))
    console.log("sending clubbs")
    const url = "https://canoe-test-dev-3cizi.ondigitalocean.app/api/club/"
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(clubbs)
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
        {"id": "v-rregatta-2023-2023", "name": "Vårregattan-2023"}

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
