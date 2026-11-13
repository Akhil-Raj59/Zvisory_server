import { z } from 'zod';

const touchSchema = z
  .object({
    utmSource: z.string().optional().default(''),
    utmMedium: z.string().optional().default(''),
    utmCampaign: z.string().optional().default(''),
    utmTerm: z.string().optional().default(''),
    utmContent: z.string().optional().default(''),
    referrer: z.string().optional().default(''),
    landingPage: z.string().optional().default(''),
    timestamp: z.string().optional(),
  })
  .optional()
  .default({});

export const createLeadSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((val) => !val || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(val), {
      message: 'Please provide a valid email address',
    }),
  countryCode: z
    .string()
    .trim()
    .optional()
    .default('+91')
    .refine((val) => /^\+[0-9]{1,4}$/.test(val), {
      message: 'Invalid country code format (e.g. +91)',
    }),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(6, 'Phone number must be at least 6 digits')
    .max(20, 'Phone number is too long')
    .regex(/^[0-9\s\-()]+$/, 'Phone number contains invalid characters'),
  message: z.string().trim().max(2000, 'Message cannot exceed 2000 characters').optional().default(''),

  // Context
  formType: z.string().trim().optional().default('general_enquiry'),
  formLocation: z.string().trim().optional().default('website'),
  projectId: z.string().trim().optional().nullable().default(null),
  projectName: z.string().trim().optional().default(''),
  projectSlug: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  developer: z.string().trim().optional().default(''),
  projectUrl: z.string().trim().optional().default(''),

  // Attribution
  firstTouch: touchSchema,
  latestTouch: touchSchema,
  utmSource: z.string().trim().optional().default(''),
  utmMedium: z.string().trim().optional().default(''),
  utmCampaign: z.string().trim().optional().default(''),
  utmTerm: z.string().trim().optional().default(''),
  utmContent: z.string().trim().optional().default(''),
  referrer: z.string().trim().optional().default(''),
  landingPage: z.string().trim().optional().default(''),
  submissionPage: z.string().trim().optional().default(''),
  sessionId: z.string().trim().optional().default(''),

  // Technical Metadata
  deviceType: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).optional().default('unknown'),
  browser: z.string().trim().optional().default(''),
  userAgent: z.string().trim().optional().default(''),

  // Cloudflare Turnstile token
  turnstileToken: z.string().trim().optional().default(''),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'closed'], {
    required_error: 'Status must be new, contacted, or closed',
  }),
  notes: z.string().trim().max(1000).optional().default(''),
});

