import mongoose, { Schema } from 'mongoose';

const developerSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Developer name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Developer slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    logo: {
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
    projectCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Developer = mongoose.models.Developer || mongoose.model('Developer', developerSchema);
export default Developer;
