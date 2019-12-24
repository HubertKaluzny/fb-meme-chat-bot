import { updateSetting, getSetting } from './DBSettings';
import collections from './Collections';
import fchatAPI from 'facebook-chat-api';
import MemeProcessor from './MemeProcessor';

export default class IngestionEngine {

    constructor(db, config, opts) {
        this.db = db;
        this.config = config;
        this.opts = opts;

        this.toFollowUp = [];
        this.eh = opts.errorHandler;

        this.tryRestore();
        this.memeProcessor = new MemeProcessor(db, config, opts);
    }

    /* Attempt to restore ingestion engine from databse */
    async tryRestore() {
        //// TODO: Attempt to restore state
        let settingsCol = await this.db.collection(collections.SETTINGS);
        this.threadID = await getSetting(settingsCol, 'thread-id');
    }

    /* Start following a thread */
    async setupForThread(threadID) {
        this.eh.log(`Subscribing to thread ${threadID}`);
        this.threadID = threadID;
        let settingsCol = await this.db.collection(collections.SETTINGS);
        await updateSetting(settingsCol, 'thread-id', threadID);
    }

    /* Get an instance of the API client & register message listener */
    async connect() {
        this.eh.log('Connecting to Facebook Messenger');
        let connectionPromise = new Promise((resolve) => {
            fchatAPI({
                email: this.opts.email,
                password: this.opts.password
            }, (err, api) => {
                if (err) {
                    console.error(err);
                    process.exit(1);
                }

                this.client = api;
                this.client.listenMqtt((err, msg) => this.onMessageEvent(err, msg));
                resolve();
            });
        });
        await connectionPromise;
    }

    /* Process message event */
    async onMessageEvent(err, msg) {
        if (err) {
            this.eh.error(err);
        }

        /* For now only listen to message-events */
        if (msg.type != 'message') {
            return;
        }

        /* Only listen to the subscribed thread */
        if (msg.threadID != this.threadID) {
            return;
        }

        //// TODO: message processing
        for (let attach of msg.attachments) {
            if (attach.type == 'photo') {
                let res = await this.memeProcessor.processFromImageAttachment(attach, msg.messageID, msg.senderID);
                if (res.repost) {
                    this.handleRepost(msg.senderID, msg.messageID, res.meme);
                }
            }
        }
    }

    async handleRepost(senderID, messageID, meme) {
        if (((meme.reposts + 1) % this.config.reposts.quipInterval) == 0) {
            //select random quip and respond
            let quipIndex = Math.floor(Math.random() * this.config.reposts.quips.length);
        
            let quip = this.config.reposts.quips[quipIndex];
            let userInfo = (await this.getUserInfo(senderID))[senderID];
            let senderName = userInfo.name;
        
            let message  = {
                body: quip,
                mentions: []
            };

            if (/@Name/.test(quip)) {
                quip = quip.replace('@Name', senderName);
                message.body = quip;
                message.mentions = [{
                    tag: senderName,
                    id: senderID
                }];
            }

            this.client.sendMessage(message, this.threadID, null, messageID);
        }
    }

    /* Escape callback hell */
    getThreadList() {
        return new Promise((resolve, reject) => {
            this.client.getThreadList(10, null, [], (err, list) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(list);
            });
        });
    }

    getUserInfo(userID) {
        return new Promise((resolve) => {
            this.client.getUserInfo(userID, (err, info) => {
                if (err) {
                    console.error(err);
                }
                resolve(info);
            });
        });
    }
}
