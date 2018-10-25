/*
 * Tvrockの予約リストをGoogle Calendarへ登録する。
 * 2018-09-28
 */
const request = require('request');
const iconv = require('iconv-lite');
const authorize = require('./auth.js');
const {google} = require('googleapis');

const config = require('./config.js');
const URL = config.url;
const CALENDAR_ID = config.calendar_id;


//
// Access Tvrock Server
//

function downloadPrograms()
{
    return downloadHtml().then((body)=>parseTvrockListHtml(body));
}

function downloadHtml()
{
    return new Promise((resolve, reject)=>{
        request(
            {url:URL, encoding:null},
            (error, response, body) => {
                if(error){
                    reject(error.message);
                }
                else if(response.statusCode != 200){
                    reject("statusCode != 200");
                }
                else{
                    const utf8body = iconv.decode(body, "Shift_JIS");
                    resolve(utf8body);
                }
            });
    });
}

function parseTvrockListHtml(body)
{
    const DATETIME_REGEXP = new RegExp("<font[^>]*>(\\d+)月(\\d+)日\\(.\\) (\\d+):(\\d+)～(\\d+):(\\d+)</font>");
    const CHANNEL_REGEXP = new RegExp("<font[^>]*>([^<]*)</font>");
    const TITLE_REGEXP = new RegExp("<font[^>]*><b>([^<]+)</b></font>");

    // split tr
    const trs = body.split(/<tr ?[^>]*>/);
    // split td in each tr
    const trtds = trs.map(tr => tr.split(/<td ?[^>]*/));

    const programs = trtds.map(trtd => {
        if(trtd.length == 12){
            const resultDateTime = DATETIME_REGEXP.exec(trtd[9]);
            const resultChannel = CHANNEL_REGEXP.exec(trtd[10]);
            const resultTitle = TITLE_REGEXP.exec(trtd[11]);
            if(resultDateTime !== null && resultChannel !== null && resultTitle !== null){
                const now = new Date();
                let [matched, startMonth, startDay, startH, startM, endH, endM] = resultDateTime;
                if(startMonth < now.getMonth()+1){
                    startMonth += 12;
                }
                if(endH < startH){
                    endH += 24;
                }
                const startDate = new Date(now.getFullYear(), startMonth-1, startDay, startH, startM);
                const endDate = new Date(now.getFullYear(), startMonth-1, startDay, endH, endM);
                const title = resultTitle[1];
                const channel = resultChannel[1];
                // Program Object
                if(channel){ //チャネルが無いものは番組情報取得なので、無視する。
                    return {
                        start: startDate,
                        end: endDate,
                        title: title
                    };
                }
            }
        }
        return undefined;
    }).filter(trtd => trtd !== undefined);
    return programs;
}

//
// Access Google Calendar
//

function getEvents(calendar)
{
    return new Promise((resolve, reject)=>{
        calendar.events.list({
            calendarId: CALENDAR_ID,
            maxResults: 500
        }, (err, res) => {
            if(err){
                reject(err);
            }
            else{
                resolve(res.data.items);
            }
        });
    });
}

function addEvents(calendar, programs)
{
    return new Promise((resolve, reject)=>{
        var events = programs.map(toEvent);

        function next(){
            if(events.length > 0){
                var evt = events.pop();
                console.log("Adding event " + evt.summary);
                calendar.events.insert(
                    {
                        calendarId: CALENDAR_ID,
                        resource: evt
                    },
                    (err, evt) => {
                        if(err){
                            reject(err);
                        }
                        else{
                            next();
                        }
                    }
                );
            }
            else{
                resolve();
            }
        }
        next();
    });
}

function removeEvents(calendar, ids)
{
    return new Promise((resolve, reject)=>{

        function next(){
            if(ids.length > 0){
                var id = ids.pop();
                console.log("Removing event " + id);
                calendar.events.delete(
                    {
                        calendarId: CALENDAR_ID,
                        eventId: id
                    },
                    (err, evt) => {
                        if(err){
                            reject(err);
                        }
                        else{
                            next();
                        }
                    }
                );
            }
            else{
                resolve();
            }
        }
        next();
    });
}

//
//
//

function toEvent(program)
{
    return {
        summary: program.title,
        start: {dateTime: program.start.toISOString()},
        end: {dateTime: program.end.toISOString()}
    };
}

function toProgram(event)
{
    return {
        id: event.id,
        start: new Date(Date.parse(event.start.dateTime)),
        end: new Date(Date.parse(event.end.dateTime)),
        title: event.summary
    };
}

function equalPrograms(a, b)
{
    return a.start.getTime() == b.start.getTime() &&
        a.end.getTime() == b.end.getTime() &&
        a.title == b.title;
}

function diffPrograms(currPrograms, newPrograms)
{
    let added = [];
    for(let newIndex = 0; newIndex < newPrograms.length; ++newIndex){
        let newProg = newPrograms[newIndex];
        let currIndex;
        for(currIndex = 0; currIndex < currPrograms.length; ++currIndex){
            if(equalPrograms(currPrograms[currIndex], newProg)){
                break;
            }
        }
        if(currIndex == currPrograms.length){
            // newProg not found in currPrograms
            added.push(newProg);
        }
        else{
            // newProg exists in currPrograms
            // remove from currPrograms
            currPrograms.splice(currIndex, 1);
        }
    }
    return {
        added: added,
        removed: currPrograms
    };
}




function updateGoogleCalendar(newPrograms)
{
    return authorize().then((auth)=>{
        const calendar = google.calendar({version: 'v3', auth});

        return getEvents(calendar).then((events)=>{
            const currPrograms = events.map(toProgram);
            let {added, removed} = diffPrograms(currPrograms, newPrograms);
            return addEvents(calendar, added).then(()=>{
                return removeEvents(calendar, removed.map(prog=>prog.id));
            });
        });
    });
}


downloadPrograms().
    then((programs)=>updateGoogleCalendar(programs)).
    catch((err)=>console.log(err));
