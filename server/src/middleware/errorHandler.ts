import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export function createError(message: string, statusCode: number): ApiError {
    const error: ApiError = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
}

// Global error handler middleware — must have 4 params for Express to recognize it
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
    const statusCode = err.statusCode || 500;
    const isProd = process.env.NODE_ENV === 'production';

    console.error(`[Error] ${statusCode} — ${err.message}`);
    if (!isProd) console.error(err.stack);

    res.status(statusCode).json({
        success: false,
        message: err.isOperational ? err.message : 'Internal Server Error',
        ...(isProd ? {} : { stack: err.stack }),
    });
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
}
