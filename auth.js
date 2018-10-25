// from https://developers.google.com/calendar/quickstart/nodejs

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize() {
    return new Promise((resolve, reject)=>{
        // Load client secrets from a local file.
        fs.readFile(CREDENTIALS_PATH, (err, content) => {
            if(err){
                console.log('Error loading client secret file:', err);
                reject(err);
            }
            else{
                const credentials = JSON.parse(content);
                const {client_secret, client_id, redirect_uris} = credentials.installed;
                const oAuth2Client = new google.auth.OAuth2(
                    client_id, client_secret, redirect_uris[0]);

                // Check if we have previously stored a token.
                fs.readFile(TOKEN_PATH, (err, token) => {
                    if(err){
                        getAccessToken(oAuth2Client, resolve, reject);
                    }
                    else{
                        oAuth2Client.setCredentials(JSON.parse(token));
                        resolve(oAuth2Client);
                    }
                });
            }
        });
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, resolve, reject) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if(err){
                console.error('Error retrieving access token', err);
                reject(err);
                return;
            }
            else{
                oAuth2Client.setCredentials(token);
                // Store the token to disk for later program executions
                fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                    if(err) console.error(err);
                    console.log('Token stored to', TOKEN_PATH);
                });
                resolve(oAuth2Client);
            }
        });
    });
}

module.exports = authorize;
