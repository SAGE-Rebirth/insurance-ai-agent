import mongoose from 'mongoose';
import { config } from './env';

const MONGO_OPTIONS = {
    maxPoolSize: 10,        // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,              // Use IPv4
};

export async function connectMongoDB(): Promise<void> {
    try {
        mongoose.set('strictQuery', true);

        mongoose.connection.on('connected', () => {
            console.log('✅ MongoDB Atlas connected');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
        });

        await mongoose.connect(config.mongoUri, MONGO_OPTIONS);
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB Atlas:', error);
        process.exit(1);
    }
}

export async function disconnectMongoDB(): Promise<void> {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
}

export function getMongoStatus(): string {
    const states: Record<number, string> = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };
    return states[mongoose.connection.readyState] || 'unknown';
}
