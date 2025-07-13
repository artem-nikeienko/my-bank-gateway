import axios from 'axios';
import chalk from 'chalk';

const unregisterRequestTimeout = 3000;

export class Worker {

    constructor (
        public id: number,
        public host: string,
        public port: number,
        public isActive: boolean,
        public healthCheckFailedCounter: number,
        public requestsCounter: number,
        public disabledByFailingCounter: number
    ) {}

    deactivate() {
        console.log(`[WORKER] Worker [${this.id}] deactivated.`);
        this.isActive = false;
        this.disabledByFailingCounter++;
    }

    activate() {
        console.log(`[WORKER] Worker [${JSON.stringify(this)}] activated.`);
        this.isActive = true;
        this.healthCheckFailedCounter = 0;
    }

    async unregister() {
        try {
            return axios.post(`${this.host}:${this.port}/system/unregister`, { 'id': this.id }, { timeout: unregisterRequestTimeout, headers: { Connection: 'close' } });
        } catch (err) {
            console.error(`[WORKER] Error while trying to unregister worker [${this.id}]: [${err}]`);
            throw err;
        }
    };

    async isUp(): Promise<boolean> {
        //TODO: read response, react due to error type (2xx, 4xx, 5xx)
        try {
            console.log(`[WORKER] Checking worker [${this.host}:${this.port}]`);
            let healthResponse = await axios.get(`${this.host}:${this.port}/system/health`, { timeout: 1000 });
            return healthResponse.status == 200;
        } catch (err) {
            console.log(chalk.red(`[WORKER] Worker [${this.id}] failed health check. ERROR: [${err}]`));
            return false;
        }
    };
}