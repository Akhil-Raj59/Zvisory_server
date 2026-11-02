import multer from 'multer';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const tempDir = os.tmpdir();

const excelStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempDir);
  },
  filename: (_req, _file, cb) => {
    // Use crypto random name — never trust original filename
    const uniqueName = `zvisory-import-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `${uniqueName}.xlsx`);
  },
});

const ALLOWED_EXCEL_MIMETYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/octet-stream', // some browsers send this for .xlsx
];

const excelFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.xlsx', '.xls'];

  if (!allowedExts.includes(ext)) {
    return cb(
      new Error(`Unsupported file type: ${ext}. Only Excel files (.xlsx, .xls) are accepted for import.`),
      false
    );
  }

  // MIME type check — allow octet-stream fallback for cross-browser compatibility
  if (!ALLOWED_EXCEL_MIMETYPES.includes(file.mimetype) && file.mimetype !== 'application/octet-stream') {
    return cb(new Error('Invalid MIME type. Upload a valid Excel file.'), false);
  }

  cb(null, true);
};

// Max 10 MB for Excel import
const uploadExcel = multer({
  storage: excelStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: excelFileFilter,
});

export default uploadExcel;
