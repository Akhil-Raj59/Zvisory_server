import { Router } from 'express';
import { isLoggedIn, authorizeRoles } from '../middleware/auth.middleware.js';
import {
  adminGetLeads,
  adminGetLeadStats,
  adminGetLeadById,
  adminUpdateLeadStatus,
  adminRetryLeadJobController,
} from '../controllers/admin.lead.controller.js';

const router = Router();

// Require admin authentication for all lead admin routes
router.use(isLoggedIn, authorizeRoles('ADMIN'));

router.get('/', adminGetLeads);
router.get('/stats', adminGetLeadStats);
router.get('/:id', adminGetLeadById);
router.patch('/:id/status', adminUpdateLeadStatus);
router.post('/:id/retry-job/:jobId', adminRetryLeadJobController);

export default router;

