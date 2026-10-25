import mongoose, { Schema } from 'mongoose';

const citySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'City name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'City slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    state: {
      type: String,
      trim: true,
      default: '',
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
    isFeatured: {
      type: Boolean,
      default: true,
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

const City = mongoose.models.City || mongoose.model('City', citySchema);
export default City;
