import collections from './Collections';
import Jimp from 'jimp';
import ssdeep from 'ssdeep.js';
import uuid from 'uuid/v1';

export default class MemeProcessor {

    constructor(db, config, opts) {
        this.db = db;
        this.config = config;
        this.eh = opts.errorHandler;
        this.googleInterface = opts.googleInterface;
        this.index = [];

        this.loadIndex();
    }

    async processFromImageAttachment(attach, messageId, senderId) {
        let url = attach.largePreviewUrl ? attach.largePreviewUrl
            : (attach.previewUrl ? attach.previewUrl : attach.thumbnailUrl);

        if (!url) {
            this.eh.error('No URL provided for attachment!');
            return;
        }

        let image = await Jimp.read(url);

        let imageHash = ssdeep.digest(await image.getBufferAsync());
        let indexHash = this.createIndexHash(image.clone());
        let compatibleIndexes = this.getCompatibleIndexes(indexHash);

        /* Check for reposts */
        if (compatibleIndexes.length < 1) {
            await this.insertNewIndex(indexHash);
        } else {
            let imageCol = await this.db.collection(collections.IMAGE_COL);
            let possibleImages = await imageCol.find({'indexHash': { $in: compatibleIndexes } });

            /* Compare attachment with all of the images in possible indexes */
            let bestMatch = null;
            let bestMatchScore = 0;
            for (let candidateImage of possibleImages) {
                let score = ssdeep.similarity(imageHash, candidateImage.hash);
                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = candidateImage;
                }

                /* Score of 100 = identical */
                if (score >= 100) {
                    break;
                }
            }

            /* Is a repost */
            if (bestMatchScore >= 100) {
                this.repost(bestMatch, senderId);
                return { repost: true };
            }

            /* Not a repost but make sure we insert it into the closest binding index */
            indexHash = bestMatch.indexHash;
        }

        /* Fresh meme */
        let uuid = uuid();
        let mediaItem = await this.googleInterface.uploadImage({
            filename: (uuid + '.png'),
            uuid: uuid,
            data: (await image.getBufferAsync()),
        });
        let memeObj = {
            indexHash: indexHash,
            originalSender: senderId,
            originalMessage: messageId,
            photoId: mediaItem.id,
            photoUrl: mediaItem.url,
            uuid: uuid,
        };

        let memesCol = await this.db.collection(collections.MEMES_COL);
        await memesCol.insertOne(memeObj);
        return { repost: false };
    }

    async repost() {
        ////TO-DO
    }

    async insertNewIndex(hash) {
        this.index.push(hash);
        let indexColl = await this.db.collection(collections.IMAGE_INDEX);
        await indexColl.insertOne({
            hash: hash
        });
    }

    /* Return array of possible indexes for this hash */
    getCompatibleIndexes(indexHash) {
        let compatibleIndexes = [];
        for (let comp of this.index) {
            let score = ssdeep.similarity(comp, indexHash);
            if (score >= this.config.indexSimilarity) {
                compatibleIndexes.push(comp);
            }
        }
        return compatibleIndexes;
    }

    /* Index Hash - fuzzy hash of resized image to 4x4 */
    async createIndexHash(image) {
        image.resize(4, 4);
        return ssdeep.digest(await image.getBufferAsync(Jimp.MIME_PNG));
    }

    async loadIndex() {
        let indexColl = await this.db.collection(collections.IMAGE_INDEX);
        this.index = await indexColl.find({});
    }

}
