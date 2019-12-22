module.exports = {
    prefix: '',
    indexSimilarity: 80,
    identicalThreshold: 98,
    webServer: {
        host: '',
        port: 80
    },
    db: {
        host: 'localhost',
        user: '',
        pass: '',
        port: 27017
    },
    oauth: {
        clientID: '',
        clientSecret: ''
    },
    reposts: {
        quipInterval: 1,
        quips: [
            '@Name, repost!'
        ],
    }
};
