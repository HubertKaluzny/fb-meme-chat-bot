module.exports = {
    indexSimilarity: 0.6,
    identicalThreshold: 0.95,
    webServer: {
        host: '',
        port: 80
    },
    db: {
        host: 'localhost',
        user: '',
        password: '',
        port: 27017
    },
    oauth: {
        clientID: '',
        clientSecret: ''
    },
    reposts: {
        quipInterval: 1,
        quips: [
            '@Name, repost!',
        ],
    }
};
