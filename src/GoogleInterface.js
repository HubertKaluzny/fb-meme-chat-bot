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

        this.eh.registerExitCB(this.onExit);
    }

    getAuthClient() {
        if (this.authClient) {
            return this.authClient;
        }

        this.authClient = new google.auth.OAuth2(
            this.config.oauth.clientID,
            this.config.oauth.clientSecret,
            this.config.webServer.domain
        );

        /* Save refresh tokens */
        this.authClient.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                this.refreshToken = tokens.refresh_token;
            }
            this.accessToken = tokens.access_token;
        });

        return this.authClient;
    }

    async retrieveAccessTokens(code) {
        let { tokens } = await this.authClient.getToken(code);
        this.authClient.setCredentials(tokens);
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
    }

    /* Load auth credentials from DB */
    async loadCredentials() {
        let settingsCol = await this.db.collection(collections.SETTINGS);
        this.accessToken = await getSetting(settingsCol, 'o-auth-access-token');
        this.refreshToken = await getSetting(settingsCol, 'o-auth-refresh-token');
        this.authClient.setCredentials({
            access_token: this.accessToken,
            refresh_token: this.refreshToken
        });
    }

    /* Save the tokens! */
    async onExit() {
        let settingsCol = await this.db.collection(collections.SETTINGS);
        await updateSetting(settingsCol, 'o-auth-access-token', this.accessToken);
        await updateSetting(settingsCol, 'o-auth-refresh-token', this.refreshToken);
    }

    /* Upload image to Google Photos and return the ID and URL */
    async uploadImage(image) {
        let accessToken = await this.authClient.getAccessTokenAsync();
        let reqOpts = {
            uri: 'https://photoslibrary.googleapis.com/v1/uploads',
            method: 'POST',
            headers: {
                'Content-type': 'application/octet-stream',
                'X-Goog-Upload-File-Name': image.filename,
                'X-Goog-Upload-Protocol': 'raw',
                Authorization: 'Bearer ' + accessToken,
            },
            body: image.data
        };

        /* First we need to upload the data */
        let response = await request(reqOpts);
        let uploadToken = response.body;

        /* Now we need to actually add the image to the user's album */
        reqOpts = {
            uri: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
            method: 'POST',
            headers: {
                'Content-type': 'application/json',
                Authorization: 'Bearer ' + accessToken,
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
            }
        };

        response = await request(reqOpts);

        // Should only be uploading 1 media item at a time
        let mediaItem = JSON.parse(response.body).newMediaItemResults[0].mediaItem;

        return { id: mediaItem.id, url: mediaItem.productUrl };
    }

}
