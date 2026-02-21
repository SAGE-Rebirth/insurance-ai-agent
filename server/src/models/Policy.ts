import { Schema, model, Document, Types } from 'mongoose';

export interface IPolicy extends Document {
    _id: Types.ObjectId;
    name: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

const PolicySchema = new Schema<IPolicy>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        content: {
            type: String,
            required: true,
            maxlength: 500000, // ~500KB policy text
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Text index for future full-text search on policy content
PolicySchema.index({ name: 'text', content: 'text' });

export const Policy = model<IPolicy>('Policy', PolicySchema);
