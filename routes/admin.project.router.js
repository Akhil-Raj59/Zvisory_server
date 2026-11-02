import { Router } from 'express';
import { isLoggedIn, authorizeRoles } from '../middleware/auth.middleware.js';
import upload from '../middleware/multer.middleware.js';
import uploadExcel from '../middleware/multerExcel.middleware.js';
import {
  adminGetProjects,
  adminGetProjectById,
  adminCreateProject,
  adminUpdateProject,
  adminUpdateStatus,
  adminDeleteProject,
  adminUploadMedia,
  adminValidateMediaUrl,
  adminGetReferenceData,
  adminSeedExcelProjects,
  adminGetStats,
} from '../controllers/admin.project.controllers.js';
import {
  adminDownloadImportTemplate,
  adminBulkImportProjects,
} from '../controllers/admin.import.controller.js';

const router = Router();

// Enforce authentication & ADMIN role for all admin project management routes
router.use(isLoggedIn, authorizeRoles('ADMIN'));

// ── Static routes MUST come before :id param routes ──────────────────────────
// Bulk Excel Import routes
router.get('/projects/import/template', adminDownloadImportTemplate);
router.post('/projects/import', uploadExcel.single('file'), adminBulkImportProjects);
router.post('/projects/bulk-seed', adminSeedExcelProjects);

// Reference data & stats
router.post('/media/upload', upload.single('file'), adminUploadMedia);
router.post('/media/validate-url', adminValidateMediaUrl);
router.get('/reference-data', adminGetReferenceData);
router.get('/stats', adminGetStats);

// ── Project CRUD (parameterized) ──────────────────────────────────────────────
router.get('/projects', adminGetProjects);
router.get('/projects/:id', adminGetProjectById);
router.post('/projects', adminCreateProject);
router.put('/projects/:id', adminUpdateProject);
router.patch('/projects/:id/status', adminUpdateStatus);
router.delete('/projects/:id', adminDeleteProject);

export default router;

