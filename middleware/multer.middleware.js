import multer from 'multer';
import cloudinary from "cloudinary";
import path from 'path';
import { config } from 'dotenv';
config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
    
    dest: "/tmp",
    limits: { fileSize: 50 * 1024 * 1024 },
    storage: multer.diskStorage({
        destination: "/tmp", 
        filename: (_req, file, cb) => {
            
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    }),
    fileFilter: (_req, file, cb) => {
        let ext = path.extname(file.originalname).toLowerCase(); 
        if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".webp" && ext !== ".png" && ext !== ".mp4" && ext !== ".pdf") {
            cb(new Error(`Unsupported file type! ${ext}`), false);
            return;
        }
        cb(null, true);
    },
});

export default upload;