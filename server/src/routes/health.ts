import { Router, Request, Response } from 'express';
import { getMongoStatus } from '../config/db';
import { getRedisStatus } from '../config/redis';

const router = Router();
const startTime = Date.now();

// GET /health — liveness & readiness probe
router.get('/', (_req: Request, res: Response) => {
    const mongoStatus = getMongoStatus();
    const redisStatus = getRedisStatus();

    const isHealthy = mongoStatus === 'connected' && (redisStatus === 'ready' || redisStatus === 'connect');

    const payload = {
        status: isHealthy ? 'ok' : 'degraded',
        uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
        timestamp: new Date().toISOString(),
        services: {
            mongo: mongoStatus,
            redis: redisStatus,
        },
    };

    return res.status(isHealthy ? 200 : 503).json(payload);
});

// GET /health/ping — ultra-lightweight ping for load balancer checks
router.get('/ping', (_req: Request, res: Response) => {
    return res.status(200).send('pong');
});

export default router;
