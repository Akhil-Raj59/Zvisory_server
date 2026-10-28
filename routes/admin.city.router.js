import { Router } from 'express';
import { isLoggedIn, authorizeRoles } from '../middleware/auth.middleware.js';
import {
  adminGetCities,
  adminGetCityById,
  adminGetCityProjects,
  adminCreateCity,
  adminUpdateCity,
  adminUpdateCityStatus,
  adminTransferProjects,
  adminDeleteCity,
} from '../controllers/admin.city.controller.js';

const router = Router();

// Require admin authentication for all routes
router.use(isLoggedIn, authorizeRoles('ADMIN'));

router.get('/', adminGetCities);
router.post('/', adminCreateCity);
router.get('/:id', adminGetCityById);
router.put('/:id', adminUpdateCity);
router.patch('/:id/status', adminUpdateCityStatus);
router.get('/:id/projects', adminGetCityProjects);
router.post('/:id/transfer', adminTransferProjects);
router.delete('/:id', adminDeleteCity);

export default router;
