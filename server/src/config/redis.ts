import Redis from 'ioredis';
import { config } from './env';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            retryStrategy(times) {
                if (times > 10) {
                    console.error('❌ Redis: Maximum retry attempts reached');
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 200, 2000);
                console.warn(`⚠️  Redis: Retrying connection in ${delay}ms... (attempt ${times})`);
                return delay;
            },
            reconnectOnError(err) {
                const targetError = 'READONLY';
                return err.message.includes(targetError);
            },
        });

        redisClient.on('connect', () => console.log('✅ Redis connected'));
        redisClient.on('error', (err) => console.error('❌ Redis error:', err.message));
        redisClient.on('close', () => console.warn('⚠️  Redis connection closed'));
    }

    return redisClient;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

export async function getCache<T>(key: string): Promise<T | null> {
    try {
        const data = await getRedisClient().get(key);
        return data ? (JSON.parse(data) as T) : null;
    } catch (err) {
        console.error(`Redis getCache error [${key}]:`, err);
        return null;
    }
}

export async function setCache(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
        await getRedisClient().setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
        console.error(`Redis setCache error [${key}]:`, err);
    }
}

export async function deleteCache(key: string): Promise<void> {
    try {
        await getRedisClient().del(key);
    } catch (err) {
        console.error(`Redis deleteCache error [${key}]:`, err);
    }
}

export async function deleteCacheByPattern(pattern: string): Promise<void> {
    try {
        const keys = await getRedisClient().keys(pattern);
        if (keys.length > 0) {
            await getRedisClient().del(...keys);
        }
    } catch (err) {
        console.error(`Redis deletePattern error [${pattern}]:`, err);
    }
}

export function getRedisStatus(): string {
    const client = redisClient;
    if (!client) return 'not initialized';
    return client.status; // 'connecting' | 'connect' | 'ready' | 'close' | 'end'
}

export async function disconnectRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('Redis connection closed.');
    }
}
