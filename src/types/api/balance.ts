import { ApiResponse,  ErrorResponse } from './common';

export type SetBalanceRequest = {
  userId?: string,
  value: number
};

export type SetBalanceResponse = {
  userId: string,
  value: number
};

export type CreateCheckRequest = {
  amount: number,
  ttl?: number
};

export type CreateCheckResponse = {
  id: string
};

export type CashCheckRequest = {

};

export type CashCheckResponse = {

};

export type CreateCheckQueryParams = {
  payerId: string
};

export type CashCheckQueryParams = {
  recipientId: string,
  checkId: string
};

export type GetBalanceResponse = {
  amount: number
};

export type GetBalanceRequest = {

};