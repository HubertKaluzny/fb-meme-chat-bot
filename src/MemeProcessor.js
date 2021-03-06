import collections from './Collections';
import Jimp from 'jimp';
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

        let imageHash = image.hash();
        let indexHash = await this.createIndexHash(image.clone());
        let compatibleIndexes = this.getCompatibleIndexes(indexHash);

        /* Check for reposts */
        if (compatibleIndexes.length < 1) {
            await this.insertNewIndex(indexHash);
        } else {
            let imageCol = await this.db.collection(collections.MEMES);
            let possibleImages = await imageCol.find({'indexHash': { $in: compatibleIndexes } }).toArray();

            /* Compare attachment with all of the images in possible indexes */
            let bestMatch = null;
            let bestMatchScore = 0;
            for (let candidateImage of possibleImages) {
                let score = (1 - Jimp.compareHashes(imageHash, candidateImage.hash));
                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = candidateImage;
                }

                if (score >= this.config.identicalThreshold) {
                    break;
                }
            }

            /* Is a repost */
            if (bestMatchScore >= this.config.identicalThreshold) {
                this.repost(bestMatch, senderId);
                return { repost: true, meme: bestMatch };
            }

            /* Not a repost but make sure we insert it into the closest binding index */
            indexHash = bestMatch ? bestMatch.indexHash : indexHash;
        }

        /* Fresh meme */
        let memeUUID = uuid();
        let mediaItem = await this.googleInterface.uploadImage({
            filename: (memeUUID + '.png'),
            uuid: memeUUID,
            data: (await image.getBufferAsync(Jimp.MIME_PNG)),
        });
        let memeObj = {
            hash: imageHash,
            indexHash: indexHash,
            originalSender: senderId,
            originalMessage: messageId,
            photoId: mediaItem.id,
            photoUrl: mediaItem.url,
            uuid: memeUUID,
            reposts: 0
        };
        let memesCol = await this.db.collection(collections.MEMES);
        await memesCol.insertOne(memeObj);
        return { repost: false, meme: memeObj };
    }

    /* Update repost metrics */
    async repost(image, reposter) {
        let memesCol = await this.db.collection(collections.MEMES);
        let userCol = await this.db.collection(collections.USERS);
        memesCol.updateOne(
            { uuid: image.uuid },
            { $inc: { reposts: 1 } }
        );

        userCol.updateOne(
            { id: reposter },
            { $inc: { reposts: 1 } },
            { upsert: true }
        );
    }

    async insertNewIndex(hash) {
        this.index.push({hash: hash});
        let indexColl = await this.db.collection(collections.IMAGE_INDEX);
        await indexColl.insertOne({
            hash: hash
        });
    }

    /* Return array of possible indexes for this hash */
    getCompatibleIndexes(indexHash) {
        let compatibleIndexes = [];
        for (let comp of this.index) {
            let score = (1 - Jimp.compareHashes(comp.hash, indexHash));
            if (score >= this.config.indexSimilarity) {
                compatibleIndexes.push(comp.hash);
            }
        }
        return compatibleIndexes;
    }

    /* Index Hash - fuzzy hash of resized image to 4x4 */
    async createIndexHash(image) {
        image.resize(10, 10);
        return image.hash();
    }

    async loadIndex() {
        let indexColl = await this.db.collection(collections.IMAGE_INDEX);
        this.index = await indexColl.find({}).toArray();
    }

}
