import { google } from 'googleapis';
import { updateSetting, getSetting } from './DBSettings';
import collections from './Collections';
import request from 'request-promise-native';

export default class GoogleInterface {

    constructor(db, config, opts) {
        this.db = db;
        this.config = config;
        this.opts = opts;
        this.eh = opts.errorHandler;
        this.accessToken = null;
        this.refreshToken = null;
    }

    getAuthClient() {
        if (this.authClient) {
            return this.authClient;
        }

        this.authClient = new google.auth.OAuth2(
            this.config.oauth.clientID,
            this.config.oauth.clientSecret,
            `https://${this.config.webServer.host}:${this.config.webServer.port}/oauthcallback`
        );

        /* Save refresh tokens */
        this.authClient.on('tokens', async (tokens) => {
            if (tokens.refresh_token) {
                this.refreshToken = tokens.refresh_token;
            }
            this.accessToken = tokens.access_token;

            let settingsCol = await this.db.collection(collections.SETTINGS);
            updateSetting(settingsCol, 'o-auth-access-token', this.accessToken);
            updateSetting(settingsCol, 'o-auth-refresh-token', this.refreshToken);
        });

        return this.authClient;
    }

    async retrieveAccessTokens(code) {
        let { tokens } = await this.authClient.getToken(code);
        this.authClient.setCredentials(tokens);
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
        let settingsCol = await this.db.collection(collections.SETTINGS);
        updateSetting(settingsCol, 'o-auth-access-token', this.accessToken);
        updateSetting(settingsCol, 'o-auth-refresh-token', this.refreshToken);
    }

    /* Load auth credentials from DB */
    async loadCredentials() {
        let settingsCol = await this.db.collection(collections.SETTINGS);
        this.accessToken = await getSetting(settingsCol, 'o-auth-access-token');
        this.refreshToken = await getSetting(settingsCol, 'o-auth-refresh-token');
        (await this.getAuthClient()).setCredentials({
            access_token: this.accessToken,
            refresh_token: this.refreshToken
        });
    }

    /* Upload image to Google Photos and return the ID and URL */
    async uploadImage(image) {
        let accessToken = (await this.authClient.getAccessTokenAsync()).token;
        let reqOpts = {
            uri: 'https://photoslibrary.googleapis.com/v1/uploads',
            method: 'POST',
            headers: {
                'Content-type': 'application/octet-stream',
                'X-Goog-Upload-File-Name': image.filename,
                'X-Goog-Upload-Protocol': 'raw',
                'Authorization': 'Bearer ' + accessToken,
            },
            body: image.data
        };

        /* First we need to upload the data */
        this.eh.log(`Uploading meme ${image.filename}.`);
        
        let uploadToken = await request(reqOpts);

        accessToken = (await this.authClient.getAccessTokenAsync()).token;

        /* Now we need to actually add the image to the user's album */
        reqOpts = {
            uri: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
            method: 'POST',
            headers: {
                'Content-type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
            },
            body: {
                'newMediaItems' : [
                    {
                        'description': image.uuid,
                        'simpleMediaItem': {
                            'uploadToken': uploadToken
                        }
                    }
                ]
            },
            json: true
        };

        this.eh.log(`Adding media item ${image.filename}.`);
        let response = await request(reqOpts);

        // Should only be uploading 1 media item at a time
        let mediaItem = response.newMediaItemResults[0].mediaItem;

        return { id: mediaItem.id, url: mediaItem.productUrl };
    }

}
