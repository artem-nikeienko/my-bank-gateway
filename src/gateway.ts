"use strict"

import express, { Request, Response, NextFunction } from 'express';
import logger from 'morgan';
import chalk from 'chalk';

import { correlationIdMiddleware } from './middleware/correlationId.js';
import { workerManager } from './service/WorkerManager.js';
import { workerMonitor } from './service/WorkerMonitor.js';

import { ErrorResponse } from './types/api/common.js';
import { SetBalanceRequest, SetBalanceResponse, GetBalanceResponse, CreateCheckResponse, CreateCheckRequest, CreateCheckQueryParams, CashCheckQueryParams, CashCheckResponse, CashCheckRequest } from './types/api/balance';
import { UnregisterRequest, NewWorkerRequest } from './types/api/gateway.js';
import errorHandler from './middleware/errorHandler.js';

import { makeCall, constructGetCallFunction, constructPostCallFunction } from './service/requestClient.js';

const gateway = express();
const port = 3000;

gateway.use(correlationIdMiddleware);
gateway.use(logger("default"));
gateway.use(express.json());
gateway.use(express.urlencoded({ extended: false }));
gateway.use(errorHandler);

// 21/05/2025 - TODO: добавить рауты всякие (у нас будет платёжная система):
//   
//   0.1) без авторизации, передавать 'userId' просто в урле;
//   0.2) создать юзера, установить ему баланс (в условных денежных единицах)
//   0.3) POST /balance - установка баланса или создание+установка - для тестовых целей
//   
//   1) POST /check - создание чека (сумма и expirationDate(optional) на входе, UUID чека на выходе)
//   2) GET  /balance
//   3) POST /cash/{UUID} - деньги с счёта одного пользователя переходят на счёт другого
//  
//   io.redis
//
//

//register worker
gateway.post('/register', async (req: Request<{}, {}, NewWorkerRequest>, res: any, next: NextFunction) => {
  let workerRequest = {...req.body};
  console.log(chalk.green(`[GATEWAY] Registering requested for worker [host: ${workerRequest.host}, port: ${workerRequest.port}]`));

  try {
    const newWorker = await workerManager.registerNewWorker(workerRequest);
    workerMonitor.startHealthCheckLoop(newWorker);

    res.status(200).send({id: newWorker.id});
  } catch (err) {
    console.log(chalk.bgRed(`[GATEWAY] Error of request occurred: [${JSON.stringify(err)}].`));
    next(err);
  }
});

// unregister worker
gateway.post('/unregister', async (req: Request<{}, {}, UnregisterRequest>, res: any) => {
  let worker = {...req.body};
  console.log(chalk.green(`[GATEWAY] Unregistering requested for worker ID: [${worker.id}]`));
  await workerManager.unregister(worker.id);
  return res.status(204).send('[GATEWAY] Worker is successfully unregistered');
});

const setBalance = async function(req:Request<{}, SetBalanceResponse, SetBalanceRequest>, res: Response<SetBalanceResponse | ErrorResponse>, next: NextFunction ) {
  let request: SetBalanceRequest = { ...req.body };
  let status = 200;
  try {
    const callFunction = constructPostCallFunction<SetBalanceRequest, SetBalanceResponse>(`api/balance/`, request);
    let response = await makeCall(callFunction);

    response ? res.send(response.data) : res.status(503).send({ errorMessage: `No balance set for userId [${request.userId}] with amount of [${request.value}].` });
  } catch (err) {
    next(err);
  }
};

const createCheck = async function(req:Request<CreateCheckQueryParams, CreateCheckResponse, CreateCheckRequest>, res: Response<CreateCheckResponse | ErrorResponse> ) {
  let request: CreateCheckRequest = { ...req.body };
  const payerId: string = req.params.payerId;

  const callFunction = constructPostCallFunction<CreateCheckRequest, CreateCheckResponse>(`api/check/${payerId}`, request);
  let response = await makeCall(callFunction);

  response ? res.status(response.status).send(response.data) : res.status(503).send({ errorMessage: `No check created for payerId [${payerId}] with amount of [${request.amount}].` });
};

const cashCheck = async function(req:Request<CashCheckQueryParams, CashCheckResponse, CashCheckRequest>, res: Response<CashCheckRequest | ErrorResponse> ) {
  let request: CashCheckRequest = { ...req.body };
  const { checkId, recipientId } = { ...req.params };

  const callFunction = constructPostCallFunction<CashCheckRequest, CashCheckResponse>(`api/check/${recipientId}/cash/${checkId}`, request);
  let response = await makeCall(callFunction);

  response ? res.send(response.data) : res.status(503).send({ errorMessage: `No check cashed for checkId [${checkId}] for recipientId [${recipientId}].` });
};

const getBalance = async function(req:Request<any, GetBalanceResponse, any>, res: Response<GetBalanceResponse | ErrorResponse>, next: NextFunction) {
  console.log(`[GATEWAY] Request for ID received. Selecting worker to proxy to.`);
  const userId: string = req.params.userId;
  const callFunction = constructGetCallFunction(`api/balance/${userId}`);
  //TODO: introduce throw Error when no workers etc.
  // setup error handling
  try {
    let response = await makeCall(callFunction);
    response ? res.send(response.data) : res.status(503).send({ errorMessage: `No response received form active workers.` });
  } catch (err) {
    console.log(`[GATEWAY ERROR] ${err}`);
    next(err);
  }
};

gateway.post('/balance', setBalance);
gateway.post('/check/:payerId', createCheck);
gateway.post('/check/:recipientId/cash/:checkId', cashCheck);
gateway.get('/balance/:userId', getBalance);

//health check endpoint
gateway.get('/health', (req: Request, res: Response) => {
  console.log(`Health check requested`);
  res.sendStatus(200);
});

//proxy get to worker
gateway.get('/hello', async (req: any, res: any) => {
  console.log(`Request for ID received. Selecting worker to proxy to.`);
  const callFunction = constructGetCallFunction('hello');
  //TODO: introduce throw Error when no workers etc.
  // setup error handling
  let response = await makeCall(callFunction);
  // console.log(`Proxying request to Worker [${worker.id}] ended successfully.`);
  if(!res) {
    throw new Error(`Unknown error when getting a response which is currently: [${res}].`);
  }
  return response ? res.send(response.data) : res.status(503).send(`No response received form active workers.`);
});

gateway.listen(port, () => {
  console.log(`Gateway listening on http://localhost:${port}`);
   });

gateway.use((err:any, req:Request, res:Response, next:any) => {
  console.error(err);
  res.status(500).send('Internal server something happend');
});

gateway.use((req: Request, res: Response) => {
  res.status(404).send('Not found');
});

async function shutdown(reason: string) {
    console.log(`Trying to stop service. Reason is [${reason}]`);

    const promises: Promise<any>[] = [];
    for(let worker of workerManager.values()) {
         promises.push(workerManager.unregister(worker.id));
    }
    await Promise.all(promises);
    console.log('All workers have been unregistered.');
}

function handleSignal(signal: string) {
  console.log(`Signal [${signal}] received.`);

  const timeout = setTimeout(() => {
      console.error('Shutdown timeout. Killing the program.');
      process.exit(1);
  }, 10_000);

  shutdown(signal)
      .then(() => {
          clearTimeout(timeout);
          console.log('Shutdown completed.');
          process.exit(0);
      })
      .catch(err => {
          console.error('Shutdown error:', err);
          process.exit(1);
      });
}
process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));


//TOTHINK: cons and pros of worker -> gateway healthcheck
// signal from worker to gateway of its stopping -> for gateway to unregister
//TODO: migrate to TS
//jest - UnitTests
//lodash
//chance - random

