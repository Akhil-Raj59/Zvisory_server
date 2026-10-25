import mongoose, { Schema } from 'mongoose';

const projectSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      minLength: [2, 'Title must be at least 2 characters'],
      maxLength: [200, 'Title cannot exceed 200 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be valid kebab-case (e.g. conscient-hines-elevate)'],
    },
    keywords: {
      type: [String],
      default: [],
    },
    secondaryKeywords: {
      type: [String],
      default: [],
    },
    developer: {
      type: String,
      required: [true, 'Developer is required'],
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    microMarket: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    categories: {
      type: [String],
      default: ['Luxury'],
      index: true,
    },
    propertyType: {
      type: String,
      trim: true,
      default: 'Apartments',
      index: true,
    },
    startingPrice: {
      type: String,
      trim: true,
      default: 'Price On Request',
    },
    priceNumeric: {
      type: Number,
      default: null,
      index: true,
    },
    priceMaxNumeric: {
      type: Number,
      default: null,
    },
    unitConfigurations: {
      type: [String],
      default: [],
      index: true,
    },
    unitSizes: {
      type: String,
      trim: true,
      default: '',
    },
    landArea: {
      type: String,
      trim: true,
      default: '',
    },
    totalUnits: {
      type: String,
      trim: true,
      default: '',
    },
    elevation: {
      type: String,
      trim: true,
      default: '',
    },
    launchStatus: {
      type: String,
      trim: true,
      default: 'Under Construction',
      index: true,
    },
    possessionDate: {
      type: Date,
      default: null,
    },
    possessionText: {
      type: String,
      trim: true,
      default: '',
    },
    paymentPlan: {
      type: String,
      trim: true,
      default: '',
    },
    reraNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    cardBanner: {
      type: String,
      trim: true,
      default: '',
    },
    bannerUrl: {
      type: String,
      trim: true,
      default: '',
    },
    shortDescription: {
      type: String,
      trim: true,
      default: '',
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
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isOnHomeCarousel: {
      type: Boolean,
      default: false,
    },
    isFlagshipProject: {
      type: Boolean,
      default: false,
    },
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      keywords: { type: String, default: '' },
      ogTitle: { type: String, default: '' },
      ogDescription: { type: String, default: '' },
      ogImage: { type: String, default: '' },
    },
    gtag: {
      gtagId: { type: String, default: '' },
      gtagSendTo: { type: String, default: '' },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant multi-filter queries
projectSchema.index({ status: 1, city: 1, priceNumeric: 1 });
projectSchema.index({ status: 1, developer: 1 });
projectSchema.index({ status: 1, propertyType: 1 });
projectSchema.index({ status: 1, launchStatus: 1 });
projectSchema.index({ status: 1, featured: -1, createdAt: -1 });

// Text index for search
projectSchema.index(
  {
    title: 'text',
    developer: 'text',
    location: 'text',
    microMarket: 'text',
    city: 'text',
    keywords: 'text',
  },
  {
    weights: {
      title: 10,
      keywords: 8,
      developer: 5,
      microMarket: 4,
      city: 3,
      location: 2,
    },
    name: 'project_text_search_index',
  }
);

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
export default Project;
