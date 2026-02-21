import { createApp } from './app';
import { connectMongoDB, disconnectMongoDB } from './config/db';
import { getRedisClient, disconnectRedis } from './config/redis';
import { config } from './config/env';

async function bootstrap(): Promise<void> {
    console.log(`\n🚀 InsureVoice Backend — ${config.nodeEnv.toUpperCase()} mode\n`);

    // ─── Connect to services ──────────────────────────────────────────────────
    await connectMongoDB();

    // Trigger Redis connection on startup so we know early if it's unreachable
    const redisClient = getRedisClient();
    await redisClient.ping();

    // ─── Start Express server ─────────────────────────────────────────────────
    const app = createApp();

    const server = app.listen(config.port, () => {
        console.log(`\n✅ Server listening on port ${config.port}`);
        console.log(`   Health: http://localhost:${config.port}/health`);
        console.log(`   API:    http://localhost:${config.port}/api\n`);
    });

    // ─── Graceful Shutdown ────────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
        console.log(`\n⏳ Received ${signal}. Shutting down gracefully...`);

        // Stop accepting new connections
        server.close(async () => {
            console.log('HTTP server closed.');
            await disconnectMongoDB();
            await disconnectRedis();
            console.log('All connections closed. Goodbye!\n');
            process.exit(0);
        });

        // Force exit after 10 seconds if graceful shutdown fails
        setTimeout(() => {
            console.error('Graceful shutdown timed out. Forcing exit.');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        console.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
        shutdown('uncaughtException');
    });
}

bootstrap();
