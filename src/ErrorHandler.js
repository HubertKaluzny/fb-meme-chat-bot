/* At some point add admin alerts to this */
export default class ErrorHandler {

    constructor(opts) {
        this.opts = opts;
    }

    log(msg) {
        if (this.opts.verbose) {
            console.log(msg);
        }
    }

    async error(msg) {
        console.error(msg);

        if (this.opts.errorQuit) {
            process.exit(1);
        }
    }
}
