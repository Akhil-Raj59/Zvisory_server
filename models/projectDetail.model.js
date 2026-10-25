import mongoose, { Schema } from 'mongoose';

const projectDetailSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Associated projectId is required'],
      unique: true,
      index: true,
    },
    detailSpecs: [
      {
        label: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
      },
    ],
    detailSpecsImage: {
      type: String,
      trim: true,
      default: '',
    },
    bannerStatLabels: {
      type: [String],
      default: ['Unit Typology', 'Starting Price', 'Unit Size', 'Location'],
    },
    overview: {
      heading: { type: String, default: 'Project Overview', trim: true },
      title: { type: String, default: '', trim: true },
      description: { type: String, default: '', trim: true },
      images: { type: [String], default: [] },
    },
    amenities: {
      heading: { type: String, default: 'Amenities', trim: true },
      title: { type: String, default: 'Designed to meet the highest criteria', trim: true },
      items: [
        {
          name: { type: String, required: true, trim: true },
          image: { type: String, default: '', trim: true },
          description: { type: String, default: '', trim: true },
        },
      ],
    },
    floorPlans: {
      heading: { type: String, default: 'Floor Plans', trim: true },
      title: { type: String, default: 'Sophisticated and Spacious', trim: true },
      plans: [
        {
          name: { type: String, required: true, trim: true },
          value: { type: String, default: '', trim: true },
          basePrice: { type: String, default: '', trim: true },
          image: { type: String, default: '', trim: true },
        },
      ],
    },
    gallery: {
      heading: { type: String, default: 'Gallery', trim: true },
      title: { type: String, default: 'Photos & Media', trim: true },
      description: { type: String, default: '', trim: true },
      images: { type: [String], default: [] },
    },
    locationAdvantages: {
      heading: { type: String, default: 'Location Advantage', trim: true },
      title: { type: String, default: 'Sophisticated and Spacious', trim: true },
      categories: [
        {
          category: { type: String, required: true, trim: true },
          items: { type: [String], default: [] },
        },
      ],
    },
    infoSections: [
      {
        heading: { type: String, default: '', trim: true },
        title: { type: String, default: '', trim: true },
        description: { type: String, default: '', trim: true },
        image: { type: String, default: '', trim: true },
        variant: { type: String, default: 'para', trim: true },
      },
    ],
    offers: {
      type: [String],
      default: [],
    },
    documents: [
      {
        name: { type: String, default: 'Project Brochure', trim: true },
        type: { type: String, default: 'PDF', trim: true },
        url: { type: String, required: true, trim: true },
      },
    ],
    faqs: [
      {
        question: { type: String, required: true, trim: true },
        answer: { type: String, required: true, trim: true },
      },
    ],
    contact: {
      heading: { type: String, default: 'Contact Us', trim: true },
      title: { type: String, default: 'Schedule a Visit', trim: true },
      locationMapUrl: { type: String, default: '', trim: true },
      phone: { type: String, default: '+91 99999 99999', trim: true },
      email: { type: String, default: 'contactus@zvisory.com', trim: true },
    },
    customSections: [
      {
        sectionId: { type: String, trim: true },
        heading: { type: String, trim: true },
        title: { type: String, trim: true },
        content: { type: String, trim: true },
        images: { type: [String], default: [] },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const ProjectDetail = mongoose.models.ProjectDetail || mongoose.model('ProjectDetail', projectDetailSchema);
export default ProjectDetail;