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
                fs.readFile(TOKEN_PATH, (err, tokenBuffer) => {
                    if(err){
                        getAccessToken(oAuth2Client, resolve, reject);
                    }
                    else{
                        const token = JSON.parse(tokenBuffer);
                        oAuth2Client.on('tokens', (newToken) => {
                            console.log("new token : " + JSON.stringify(newToken));
                            token.access_token = newToken.access_token;
                            token.expiry_date = newToken.expiry_date;
                            if(newToken.refresh_token) {
                                token.refresh_token = newToken.refresh_token;
                            }
                            writeTokenToFile(token);
                        });

                        oAuth2Client.setCredentials(token);
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
                writeTokenToFile(token);
                resolve(oAuth2Client);
            }
        });
    });
}

function writeTokenToFile(token){
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if(err){
            console.log('Failed to write token to ', TOKEN_PATH);
            console.error(err);
        }
        else{
            console.log('Token stored to', TOKEN_PATH);
        }
    });
}

module.exports = authorize;
