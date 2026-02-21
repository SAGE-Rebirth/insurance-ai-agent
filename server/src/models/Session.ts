import { Schema, model, Document, Types } from 'mongoose';

export interface ILogMessage {
    role: 'user' | 'agent' | 'system';
    message: string;
    timestamp: Date;
}

export interface ISession extends Document {
    _id: Types.ObjectId;
    sessionId: string;       // client-generated UUID (for idempotency)
    logs: ILogMessage[];
    policySummary: string;
    createdAt: Date;
    updatedAt: Date;
}

const LogMessageSchema = new Schema<ILogMessage>(
    {
        role: {
            type: String,
            enum: ['user', 'agent', 'system'],
            required: true,
        },
        message: {
            type: String,
            required: true,
            maxlength: 10000,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const SessionSchema = new Schema<ISession>(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        logs: {
            type: [LogMessageSchema],
            default: [],
            validate: {
                validator: (v: ILogMessage[]) => v.length <= 500,
                message: 'A session cannot have more than 500 log messages.',
            },
        },
        policySummary: {
            type: String,
            default: '',
            maxlength: 2000,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// TTL index: auto-delete sessions older than 90 days
SessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Session = model<ISession>('Session', SessionSchema);
