/* At some point add admin alerts to this */
export default class ErrorHandler {

    constructor(opts) {
        this.opts = opts;
        this.exitCBs = [];
    }

    log(msg) {
        if (this.opts.verbose) {
            console.log(msg);
        }
    }

    async error(msg) {
        if (this.opts.verbose) {
            console.error(msg);
        }

        if (this.opts.errorQuit) {
            for (let cb of this.opts.exitCBs) {
                await cb();
            }
            process.exit(1);
        }
    }

    registerExitCB(cb) {
        this.exitCBs.push(cb);
    }

}
