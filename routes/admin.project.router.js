import { Router } from 'express';
import { isLoggedIn, authorizeRoles } from '../middleware/auth.middleware.js';
import upload from '../middleware/multer.middleware.js';
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

const router = Router();

// Enforce authentication & ADMIN role for all admin project management routes
router.use(isLoggedIn, authorizeRoles('ADMIN'));

router.get('/projects', adminGetProjects);
router.get('/projects/:id', adminGetProjectById);
router.post('/projects', adminCreateProject);
router.put('/projects/:id', adminUpdateProject);
router.patch('/projects/:id/status', adminUpdateStatus);
router.delete('/projects/:id', adminDeleteProject);

router.post('/media/upload', upload.single('file'), adminUploadMedia);
router.post('/media/validate-url', adminValidateMediaUrl);
router.get('/reference-data', adminGetReferenceData);
router.get('/stats', adminGetStats);
router.post('/projects/bulk-seed', adminSeedExcelProjects);

export default router;
