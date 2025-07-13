import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const existingId = req.headers['x-correlation-id'];
  const correlationId = typeof existingId === 'string' ? existingId : randomUUID();

  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  (req as any).correlationId = correlationId;

  next();
};