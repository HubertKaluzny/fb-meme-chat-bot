require('babel-polyfill');

import { MongoClient } from 'mongodb';
import bodyParser from 'body-parser';
import config from '../config';
import ErrorHandler from './ErrorHandler';
import express from 'express';
import GoogleInterface from './GoogleInterface';
import IngestionEngine from './IngestionEngine';
import minimist from 'minimist';
import readLine from 'readline';

const args = minimist(process.argv.slice(2));
const eh = new ErrorHandler({
    verbose: args.verbose ? args.verbose : false,
    errorQuit: args.errorQuit ? args.errorQuit : false
});

if (!args.email || !args.password) {
    eh.error('Must provide username and password for Facebook account.');
}

/* Database connection set up */
var db;
let dbUrl = 'mongodb://'
    + ( config.db.user ? `${config.db.user}:${config.db.password}@` : '' )
    + `${config.db.host}:${config.db.port}`;

MongoClient.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true }, async (err, client) => {

    if (err) {
        eh.error(err);
    }

    eh.log('Successfully connected to database.');
    db = await client.db(config.db.name);

    let googleInterface = new GoogleInterface(db, config, {errorHandler: eh});

    let engine = new IngestionEngine(db, config, {
        email: args.email,
        password: args.password,
        errorHandler: eh,
        googleInterface: googleInterface
    });
    await engine.connect();

    /* Prompt the user for which thread to follow */
    if (args.install) {

        /* Request access to Google photos */
        let code = await oAuthPrompt(eh, googleInterface);
        googleInterface.retrieveAccessToken(code);

        /* Messenger thread selection */
        let rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        let threadList = await engine.getThreadList();

        if (!threadList || threadList.length < 1) {
            eh.log('No threads available to follow!');
            process.exit(1);
        }

        eh.log('Available threads:');
        for (let i = 0; i < threadList.length; i++) {
            console.log(`[${i + 1}] ${threadList[i].threadID} - ${threadList[i].name}`);
        }

        let resp = '';
        while(isNaN(resp) || resp < 1 || resp > threadList.length) {
            resp = await new Promise((resolve) => {
                rl.question(`Which thread to follow? [1-${threadList.length}]\n`, (_) => resolve(_));
            });
        }
        rl.clearLine();
        rl.close();

        await engine.setupForThread(threadList[resp - 1].threadID);
    } else {
        await googleInterface.loadCredentials();
    }

});

async function oAuthPrompt(eh, googleInterface) {
    let client = googleInterface.getAuthClient();

    let scopes = [
        'https://www.googleapis.com/auth/photoslibrary'
    ];

    let url = client.generateAuthUrl({
        scope: scopes,
        access_type: 'offline'
    });

    console.log(`Please connect your Google account at ${url}`);
    console.log(`Will continue when auth token received at ${config.webServer.host}:${config.webServer.port}/oauthcallback`);

    let app = express();
    app.use(bodyParser.urlencoded());

    let authTokenPromise = new Promise((resolve) => {
        app.get('/oauthcallback', async (req, res) => {
            if (!req.params.code) {
                res.status(400);
                res.send('No authorisation token provided.');
                eh.error('OAuth webhook did not receive authorisation token!');
            }

            res.send('OK');
            resolve(req.params.code);
        });
    });

    let server = app.listen(config.webServer.port);
    let code = await authTokenPromise;
    server.close();

    return code;
}
