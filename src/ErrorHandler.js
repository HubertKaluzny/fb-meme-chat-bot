/* At some point add admin alerts to this */
export default class ErrorHandler {

    constructor(opts) {
        this.opts = opts;
        this.exitCBs = [];
        this.callbacksHandled = false;

        process.on('exit', async () => {
            if (!this.callbacksHandled) {
                await this.onExit();
            }
        });
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
            await this.onExit();
            process.exit(1);
        }
    }

    async onExit() {
        //set flag here in case we have more exceptions in our callbacks
        this.callbacksHandled = true;

        for (let cb of this.opts.exitCBs) {
            await cb();
        }
    }

    registerExitCB(cb) {
        this.exitCBs.push(cb);
    }

}
