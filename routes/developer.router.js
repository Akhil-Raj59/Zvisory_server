import { Router } from 'express';
import {
  getPublicDevelopers,
  getPublicDeveloperBySlug,
  getPublicDeveloperProjects,
} from '../controllers/developer.controller.js';

const router = Router();

router.get('/', getPublicDevelopers);
router.get('/:slug', getPublicDeveloperBySlug);
router.get('/:slug/projects', getPublicDeveloperProjects);

export default router;

