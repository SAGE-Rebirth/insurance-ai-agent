import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import sessionRoutes from './routes/sessions';
import policyRoutes from './routes/policies';
import healthRoutes from './routes/health';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): express.Application {
    const app = express();

    // ─── Trust proxy (needed behind Nginx / AWS ALB) ─────────────────────────
    app.set('trust proxy', 1);

    // ─── Security Headers ──────────────────────────────────────────────────────
    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' },
        })
    );

    // ─── CORS ─────────────────────────────────────────────────────────────────
    app.use(
        cors({
            origin: config.corsOrigin,
            methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
        })
    );

    // ─── Compression (gzip) ───────────────────────────────────────────────────
    app.use(compression());

    // ─── Request Logging ──────────────────────────────────────────────────────
    app.use(morgan(config.isProd ? 'combined' : 'dev'));

    // ─── Body Parsing ─────────────────────────────────────────────────────────
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true, limit: '2mb' }));

    // ─── Rate Limiting ────────────────────────────────────────────────────────
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many requests. Please try again later.' },
        skip: (req) => req.path === '/health/ping', // Don't rate limit LB pings
    });
    app.use(limiter);

    // ─── Routes ───────────────────────────────────────────────────────────────
    app.use('/health', healthRoutes);
    app.use('/api/sessions', sessionRoutes);
    app.use('/api/policies', policyRoutes);

    // ─── Error Handlers ───────────────────────────────────────────────────────
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
