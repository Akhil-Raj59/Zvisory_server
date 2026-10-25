import { Router } from 'express';
import {
  getProjects,
  getProjectFilters,
  getProjectBySlug,
  getFeaturedProjects,
  getSimilarProjects,
  getCities,
} from '../controllers/project.controllers.js';

const router = Router();

router.get('/', getProjects);
router.get('/filters', getProjectFilters);
router.get('/featured', getFeaturedProjects);
router.get('/cities', getCities);
router.get('/slug/:slug', getProjectBySlug);
router.get('/:id/similar', getSimilarProjects);

export default router;
