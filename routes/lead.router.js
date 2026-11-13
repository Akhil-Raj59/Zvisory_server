import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createLead } from '../controllers/lead.controller.js';

const router = Router();

// Rate limiter: Max 15 lead enquiries per 15 minutes per IP
const leadSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: 'Too many enquiry submissions from this IP. Please wait a few minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', leadSubmissionLimiter, createLead);

export default router;

