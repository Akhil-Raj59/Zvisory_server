import mongoose, { Schema } from 'mongoose';

const developerSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Developer name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Developer slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be valid kebab-case (e.g. dlf, godrej-properties)'],
    },
    logo: {
      type: String,
      trim: true,
      default: '',
    },
    shortDescription: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    headquarters: {
      type: String,
      trim: true,
      default: '',
    },
    seo: {
      title: { type: String, default: '', trim: true },
      description: { type: String, default: '', trim: true },
      keywords: { type: String, default: '', trim: true },
      ogTitle: { type: String, default: '', trim: true },
      ogDescription: { type: String, default: '', trim: true },
      ogImage: { type: String, default: '', trim: true },
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: '{VALUE} is not a valid status',
      },
      default: 'published',
      index: true,
    },
    projectCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
developerSchema.index({ status: 1, name: 1 });
developerSchema.index({ status: 1, projectCount: -1 });

// Text search index
developerSchema.index(
  {
    name: 'text',
    shortDescription: 'text',
    description: 'text',
    headquarters: 'text',
  },
  {
    weights: {
      name: 10,
      shortDescription: 3,
      description: 1,
      headquarters: 2,
    },
    name: 'developer_text_search_index',
  }
);

const Developer = mongoose.models.Developer || mongoose.model('Developer', developerSchema);
export default Developer;
