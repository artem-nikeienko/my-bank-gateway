"use strict"

import { Worker } from './Worker.js';
import chalk from 'chalk';

export class WorkerManager {
    private freeIds:number[] = [];
    private workersCounter = 0;
    private workers = new Map<number, Worker>();

    private static instance: WorkerManager;
    static getInstance(): WorkerManager {
        if (!WorkerManager.instance) {
            WorkerManager.instance = new WorkerManager();
        }
        return WorkerManager.instance;
    };

    getBestWorker(): Worker {
        const activeWorkers = Array.from(this.workers.values())
          .filter(w => w.isActive)
          .sort((a, b) => a.requestsCounter + a.healthCheckFailedCounter - b.requestsCounter - b.healthCheckFailedCounter);
        console.log('Active Workers are:', JSON.stringify(activeWorkers, null, 2));
      
        //TODO implement, replace in makeCall
        console.log(`Best worker is [${JSON.stringify(activeWorkers[0], null, 2)}]`);
        return activeWorkers[0];
    };
    
    private getFreeId(): number {
        return this.freeIds.shift() || ++this.workersCounter;
    };
    
    async unregister(workerId: number) {
        const worker: Worker | undefined = this.workers.get(workerId);
        if (!worker) {
            return;
        }
        this.workers.delete(workerId);
        this.freeIds.push(workerId);
        return worker.unregister();

    };
    
    has(workerId: number): boolean {
        return this.workers.has(workerId);
    };

    values() {
        return this.workers.values();
    };

    async registerNewWorker(worker: any): Promise<Worker> {
        console.log(chalk.yellow(`[WORKER_MANAGER] Starting registering a new worker [${JSON.stringify(worker)}]`));
        if (worker?.id) {
            let existingWorker = this.workers.get(worker.id);
            if (existingWorker) {
                console.log(chalk.yellow(`[WORKER_MANAGER] Workers pool already has worker [${existingWorker.id}]`));
                return existingWorker;
            }
        }

        const newWorker = new Worker(worker.id || this.getFreeId(), worker.host, worker.port, true, 0, 0, 0);
        console.log(chalk.green(`[WORKER_MANAGER] Registered worker with ID [${newWorker.id}]`));
        this.workers.set(newWorker.id, newWorker);
        return newWorker;
    };
}

export const workerManager = WorkerManager.getInstance();

