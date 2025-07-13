import axios, { AxiosError, AxiosResponse } from 'axios';
import { Worker } from './Worker.js';
import { workerManager } from './WorkerManager.js';
import chalk from 'chalk';

const maxRetryAttempts = 3;
const retryTimeoutMs = 300;

//iterating a map of 'isActive' workers, sorting them by 'requestsCounter'(ASC) and 'healthCheckFailedCounter'(ASC)
export const makeCall = async <T>(callFn: (worker: Worker) => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T> | null> => {
  //TODO: add fallback
  let response: AxiosResponse<T> | null = null;
  let bestWorker: Worker = workerManager.getBestWorker();
  let triedWorkers: Worker[] = [];
  while (bestWorker && !response) {
    console.log(chalk.yellow(`[GATEWAY] Next worker is [${bestWorker.id}].`));
    triedWorkers.push(bestWorker);
    for (let i=0; i < maxRetryAttempts; i++) {
      console.log(chalk.yellow(`[GATEWAY] Trying to call to worker [${bestWorker.id}]. Attempt No. [${i}], maxAttempts is [${maxRetryAttempts}]`));
      bestWorker.requestsCounter++;
      console.log(chalk.yellow(`[GATEWAY] Incrementing worker's requests counter: [${bestWorker.requestsCounter}]`));
      try {
        console.log(chalk.yellow(`[GATEWAY] Making call to selected worker.`));
        response = await callFn(bestWorker);
        bestWorker.requestsCounter--;
        return response;
      } catch (err: AxiosError | any) {
        if(axios.isAxiosError(err)) {
          return err.response as AxiosResponse;
        }
        console.log(chalk.red(`[GATEWAY] Proxying request to Worker [${bestWorker.id}] at [${bestWorker.host}:${bestWorker.port}] failed with status [${err.status}]. Trying next one. Error: [${err}]`));
        bestWorker.requestsCounter--;
        console.log(chalk.red(err.code), chalk.red(err.errno), chalk.red(err.syscall), chalk.red(err.hostname));
      }
      console.log(chalk.yellow(`Decrementing worker's requests counter: [${bestWorker.requestsCounter}]`));
      await new Promise(resolve => setTimeout(resolve, retryTimeoutMs));
    }
    let nextWorker = workerManager.getBestWorker();
    if(triedWorkers.includes(nextWorker)) {
      console.log(`All active workers tried.`);
      return response;
    }
  }
  return response;
}

export const constructGetCallFunction = (path:string) => {
  return async (worker: Worker) => axios.get(`${worker.host}:${worker.port}/${path}`, { timeout: 1000, headers: { Connection: 'close' }});
}

export const constructPostCallFunction = <Rq, Rs>(path: string, payload: Rq) => {
  return async (worker: Worker): Promise<AxiosResponse<Rs>> => {
     return axios.post<Rs>(`${worker.host}:${worker.port}/${path}`, payload, { timeout: 10000, headers: { Connection: 'close' }});
  }
}