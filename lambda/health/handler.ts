import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import mongoose from 'mongoose';
import { connectDB } from '../shared/db';
import { getRedis } from '../shared/redis';
import { getSecrets } from '../shared/secrets';

const SECRET_NAME = process.env.SECRET_NAME!;
const startTime = Date.now();

const cors = {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
};

export async function handler(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    let mongoStatus = 'unknown';
    let redisStatus = 'unknown';

    try {
        const secrets = await getSecrets(SECRET_NAME);
        await connectDB(secrets.MONGODB_URI);
        mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

        const redis = getRedis(secrets.REDIS_URL);
        const pong = await redis.ping();
        redisStatus = pong === 'PONG' ? 'ready' : 'degraded';
    } catch (e) {
        console.error('[Health] Check failed:', e);
    }

    const isHealthy = mongoStatus === 'connected' && redisStatus === 'ready';

    return {
        statusCode: isHealthy ? 200 : 503,
        headers: { 'Content-Type': 'application/json', ...cors },
        body: JSON.stringify({
            status: isHealthy ? 'ok' : 'degraded',
            uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
            timestamp: new Date().toISOString(),
            services: { mongo: mongoStatus, redis: redisStatus },
        }),
    };
}
