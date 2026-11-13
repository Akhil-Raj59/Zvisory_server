import { Schema, model } from 'mongoose';

const touchSchema = new Schema(
  {
    utmSource: { type: String, trim: true, default: '' },
    utmMedium: { type: String, trim: true, default: '' },
    utmCampaign: { type: String, trim: true, default: '' },
    utmTerm: { type: String, trim: true, default: '' },
    utmContent: { type: String, trim: true, default: '' },
    referrer: { type: String, trim: true, default: '' },
    landingPage: { type: String, trim: true, default: '' },
    timestamp: { type: Date },
  },
  { _id: false }
);

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: ['new', 'contacted', 'closed'],
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const leadSchema = new Schema(
  {
    // Contact Information
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minLength: [2, 'Full name must be at least 2 characters'],
      maxLength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      match: [
        /^$|^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address',
      ],
    },
    countryCode: {
      type: String,
      trim: true,
      default: '+91',
      match: [/^\+[0-9]{1,4}$/, 'Invalid country code format'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      minLength: [6, 'Phone number is too short'],
      maxLength: [20, 'Phone number is too long'],
    },
    message: {
      type: String,
      trim: true,
      default: '',
      maxLength: [2000, 'Message cannot exceed 2000 characters'],
    },

    // Enquiry Context
    formType: {
      type: String,
      required: true,
      trim: true,
      default: 'general_enquiry',
    },
    formLocation: {
      type: String,
      trim: true,
      default: 'website',
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    projectName: {
      type: String,
      trim: true,
      default: '',
    },
    projectSlug: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    developer: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    projectUrl: {
      type: String,
      trim: true,
      default: '',
    },

    // Marketing Attribution
    firstTouch: {
      type: touchSchema,
      default: () => ({}),
    },
    latestTouch: {
      type: touchSchema,
      default: () => ({}),
    },
    utmSource: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    utmMedium: {
      type: String,
      trim: true,
      default: '',
    },
    utmCampaign: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    utmTerm: {
      type: String,
      trim: true,
      default: '',
    },
    utmContent: {
      type: String,
      trim: true,
      default: '',
    },
    referrer: {
      type: String,
      trim: true,
      default: '',
    },
    landingPage: {
      type: String,
      trim: true,
      default: '',
    },
    submissionPage: {
      type: String,
      trim: true,
      default: '',
    },
    sessionId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    // Technical Metadata
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
    browser: {
      type: String,
      trim: true,
      default: '',
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },

    // Management & Sync Status
    status: {
      type: String,
      enum: ['new', 'contacted', 'closed'],
      default: 'new',
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: () => [
        {
          status: 'new',
          changedAt: new Date(),
          notes: 'Lead created via enquiry submission',
        },
      ],
    },
    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'disabled'],
      default: 'pending',
      index: true,
    },
    crmStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed', 'configuration_required', 'disabled'],
      default: 'pending',
      index: true,
    },
    leadSquaredId: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant admin queries & aggregation
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ email: 1, createdAt: -1 });
leadSchema.index({ phone: 1, createdAt: -1 });
leadSchema.index({ utmSource: 1, utmCampaign: 1 });
leadSchema.index({ city: 1, status: 1 });
leadSchema.index({ developer: 1, status: 1 });

// Full-text search index for admin lead search
leadSchema.index({
  fullName: 'text',
  email: 'text',
  phone: 'text',
  projectName: 'text',
  city: 'text',
  developer: 'text',
});

const Lead = model('Lead', leadSchema);

export default Lead;

