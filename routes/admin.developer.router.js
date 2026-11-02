import { Router } from 'express';
import { isLoggedIn, authorizeRoles } from '../middleware/auth.middleware.js';
import {
  adminGetDevelopers,
  adminGetDeveloperById,
  adminGetDeveloperProjects,
  adminCreateDeveloper,
  adminUpdateDeveloper,
  adminUpdateDeveloperStatus,
  adminTransferDeveloperProjects,
  adminDeleteDeveloper,
} from '../controllers/admin.developer.controller.js';

const router = Router();

// Require admin authentication for all routes
router.use(isLoggedIn, authorizeRoles('ADMIN'));

router.get('/', adminGetDevelopers);
router.post('/', adminCreateDeveloper);
router.get('/:id', adminGetDeveloperById);
router.put('/:id', adminUpdateDeveloper);
router.patch('/:id/status', adminUpdateDeveloperStatus);
router.get('/:id/projects', adminGetDeveloperProjects);
router.post('/:id/transfer', adminTransferDeveloperProjects);
router.delete('/:id', adminDeleteDeveloper);

export default router;
