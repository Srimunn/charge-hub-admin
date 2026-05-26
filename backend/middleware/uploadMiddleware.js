import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use disk storage to save files locally
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to the absolute path of backend/uploads
    const dir = path.join(__dirname, '../uploads/');
    try {
      // Ensure uploads directory exists (recursive safe)
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // ignore mkdir errors; multer will surface if needed
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename: replace spaces and unsafe chars with underscores
    const orig = String(file.originalname || 'upload');
    const safe = orig.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export default upload;
