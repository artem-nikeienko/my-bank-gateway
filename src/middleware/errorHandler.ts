import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export interface AppError extends Error {
    status?: number;
}

export const errorHandler: ErrorRequestHandler = (
    err: AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.log(`[ERROR HANDLER] Error is handling.`);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error'
    });
};

export default errorHandler;