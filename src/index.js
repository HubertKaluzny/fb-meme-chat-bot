require('babel-polyfill');

import ErrorHandler from './ErrorHandler'
import IngestionEngine from './IngestionEngine';
import { MongoClient } from 'mongodb';
import config from '../config';
import minimist from 'minimist';
import readLine from 'readline';

const args = minimist(process.argv.slice(2));
const eh = new ErrorHandler({
    verbose: args.verbose ? args.verbose : false,
    errorQuit: args.errorQuit ? args.errorQuit : false
})

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
        eh.error(err)
    }

    eh.log('Successfully connected to database.');
    db = await client.db(config.db.name);

    let engine = new IngestionEngine(db, config, {
        email: args.email,
        password: args.password,
        errorHandler: eh
    });
    await engine.connect();

    /* Prompt the user for which thread to follow */
    if (args.install) {
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
    }

});
