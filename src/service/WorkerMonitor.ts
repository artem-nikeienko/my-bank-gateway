import { workerManager } from './WorkerManager.js';
import { Worker } from './Worker.js';

import chalk from 'chalk';

export class WorkerMonitor {
    
    private maxFailsAllowed: number = 2;
    private maxDisabledCounterAllowed: number = 2;
    private maxRetryAttempts: number = 3;

    private retryTimeoutMs = 300;
    private deactivationTimeoutMs = 3000;

    private static instance: WorkerMonitor;
    static getInstance(): WorkerMonitor {
        if (!WorkerMonitor.instance) {
            WorkerMonitor.instance = new WorkerMonitor();
        }
        return WorkerMonitor.instance;
    };

    public async startHealthCheckLoop(worker: Worker): Promise<void> {
        try {
            while (workerManager.has(worker.id)) {
                console.log(`[WORKER_MONITOR] Checking worker [${worker.id}] health.`);
                if (!await worker.isUp()) {
                    worker.healthCheckFailedCounter++;
                    if (worker.healthCheckFailedCounter > this.maxFailsAllowed) {
                        // return;
                        if (worker.disabledByFailingCounter > this.maxDisabledCounterAllowed) {
                            console.log(chalk.bold(`[WORKER_MONITOR] Unregistering worker [${worker.id}] for its unhealthy state.`));
                            await workerManager.unregister(worker.id);
                            return;
                        } else {
                            console.log(`[WORKER_MONITOR] Deactivating worker [${worker.id}] for its inresponsive behavior.`);
                            worker.deactivate();
                            setTimeout(worker.activate, this.deactivationTimeoutMs);
                            await new Promise(resolve => setTimeout(resolve, this.deactivationTimeoutMs + 1000));
                        }
                    }
                } else {
                    console.log(chalk.greenBright(`[WORKER_MONITOR] OK: checking worker [${worker.id}] health.`));
                }
                await new Promise((resolve, reject) => setTimeout(() => {resolve('REJECTED!');}, 3000));
            }
            console.log(chalk.magentaBright(`[WORKER_MONITOR] Worker [${worker.id}] is no longer registered here.`));
        } catch (err) {
            console.log(chalk.bgRed(`[WORKER_MONITOR] Error of request occurred: [${JSON.stringify(err)}].`));
            return;
        }
    }
}

export const workerMonitor = WorkerMonitor.getInstance();