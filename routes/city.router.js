import { Router } from 'express';
import {
  getPublicCities,
  getPublicCityBySlug,
  getPublicCityProjects,
} from '../controllers/city.controller.js';

const router = Router();

router.get('/', getPublicCities);
router.get('/:slug', getPublicCityBySlug);
router.get('/:slug/projects', getPublicCityProjects);

export default router;
