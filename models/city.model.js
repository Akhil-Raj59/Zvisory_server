import mongoose, { Schema } from 'mongoose';

const citySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'City name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'City slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be valid kebab-case (e.g. gurugram, new-delhi)'],
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    image: {
      type: String,
      trim: true,
      default: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
    },
    startingPrice: {
      type: String,
      trim: true,
      default: '₹1.5 Cr*',
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
    highlights: {
      type: [String],
      default: [],
    },
    localities: {
      type: [String],
      default: [],
    },
    gallery: {
      type: [String],
      default: [],
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
    isFeatured: {
      type: Boolean,
      default: false,
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

// Virtual alias: coverImage maps to image
citySchema.virtual('coverImage')
  .get(function () {
    return this.image;
  })
  .set(function (val) {
    this.image = val;
  });

// Compound indexes
citySchema.index({ status: 1, isFeatured: -1, createdAt: -1 });
citySchema.index({ status: 1, name: 1 });

// Text search index
citySchema.index(
  {
    name: 'text',
    state: 'text',
    shortDescription: 'text',
    description: 'text',
    localities: 'text',
  },
  {
    weights: {
      name: 10,
      state: 5,
      localities: 4,
      shortDescription: 2,
      description: 1,
    },
    name: 'city_text_search_index',
  }
);

const City = mongoose.models.City || mongoose.model('City', citySchema);
export default City;
