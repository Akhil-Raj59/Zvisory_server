import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { config } from 'dotenv';
config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a local temporary file to Cloudinary and cleans up the local file afterwards.
 */
export async function uploadToCloudinary(filePath, folder = 'zvisory/projects') {
  try {
    const isPdf = filePath.toLowerCase().endsWith('.pdf');
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: isPdf ? 'raw' : 'auto',
      use_filename: true,
      unique_filename: true,
    });

    // Safely remove local temp file
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn('Warning: could not delete temp file', filePath, unlinkErr.message);
      }
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format || (isPdf ? 'pdf' : 'unknown'),
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        // ignore
      }
    }
    throw error;
  }
}

/**
 * Deletes an asset by publicId from Cloudinary
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error.message);
    throw error;
  }
}

export default cloudinary;
