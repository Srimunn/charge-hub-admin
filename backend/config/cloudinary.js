import "./env.js";
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
  secure: true,
});

export const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUD_NAME && process.env.CLOUD_API_KEY && process.env.CLOUD_API_SECRET);

/**
 * Persist a multer-uploaded file and return the URL to store in the database.
 *
 * - Cloudinary configured: uploads the file, deletes the local temp copy and returns the
 *   https URL. Required on Railway, whose container disk is wiped on every deploy.
 * - Not configured (local dev): keeps the file on disk and returns `/uploads/<filename>`.
 */
export const storeUploadedFile = async (file, folder = 'charge-hub/stations') => {
  if (!file) return '';
  if (!isCloudinaryConfigured()) {
    return `/uploads/${file.filename}`;
  }
  try {
    const result = await cloudinary.uploader.upload(file.path, { folder, resource_type: 'image' });
    return result.secure_url;
  } finally {
    fs.promises.unlink(file.path).catch(() => {});
  }
};

export default cloudinary;
