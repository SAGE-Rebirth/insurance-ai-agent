import mongoose from 'mongoose';

// ── Module-level singleton (survives across warm Lambda invocations) ──────────
let cachedConnection: mongoose.Connection | null = null;
let isConnecting = false;

/**
 * Lambda-optimized MongoDB connection.
 * Re-uses the existing connection on warm invocations instead of
 * creating a new one each time (critical for Lambda performance).
 */
export async function connectDB(uri: string): Promise<void> {
    if (cachedConnection && cachedConnection.readyState === 1) {
        return; // Already connected — reuse
    }

    if (isConnecting) {
        // Wait for in-progress connection to resolve
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (cachedConnection?.readyState === 1) {
                    clearInterval(check);
                    resolve();
                }
            }, 50);
        });
        return;
    }

    isConnecting = true;

    try {
        mongoose.set('strictQuery', true);

        await mongoose.connect(uri, {
            // Keep connection pool tiny for Lambda — we have many concurrent Lambdas
            maxPoolSize: 5,
            minPoolSize: 1,
            // Short timeouts — Lambda has a max execution limit
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            // Don't buffer commands if disconnected; fail fast
            bufferCommands: false,
            family: 4,
        });

        cachedConnection = mongoose.connection;
        console.log('[DB] MongoDB connected (cold start)');
    } finally {
        isConnecting = false;
    }
}

// ── Models ───────────────────────────────────────────────────────────────────

const LogMessageSchema = new mongoose.Schema(
    {
        role: { type: String, enum: ['user', 'agent', 'system'], required: true },
        message: { type: String, required: true, maxlength: 10000 },
        timestamp: { type: Date, default: Date.now },
    },
    { _id: false }
);

const SessionSchema = new mongoose.Schema(
    {
        sessionId: { type: String, required: true, unique: true, index: true },
        logs: { type: [LogMessageSchema], default: [] },
        policySummary: { type: String, default: '', maxlength: 2000 },
    },
    { timestamps: true }
);
// Auto-delete sessions after 90 days
SessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const PolicySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 200 },
        content: { type: String, required: true, maxlength: 500000 },
    },
    { timestamps: true }
);
PolicySchema.index({ name: 'text' });

// Prevent OverwriteModelError on warm Lambda invocations
export const Session =
    mongoose.models.Session ?? mongoose.model('Session', SessionSchema);

export const Policy =
    mongoose.models.Policy ?? mongoose.model('Policy', PolicySchema);
