import { Schema, model } from 'mongoose';

const leadJobSchema = new Schema(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['EMAIL_NOTIFICATION', 'LEADSQUARED_SYNC'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'configuration_required'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    nextRunAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastAttemptAt: {
      type: Date,
    },
    lastError: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Worker polling index
leadJobSchema.index({ status: 1, nextRunAt: 1, attempts: 1 });

const LeadJob = model('LeadJob', leadJobSchema);

export default LeadJob;

