import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';
import Lead from '../models/lead.model.js';
import LeadJob from '../models/leadJob.model.js';
import Project from '../models/project.model.js';
import { createLeadSchema } from '../validations/lead.validation.js';
import { verifyTurnstileToken } from '../utils/turnstile.js';
import { triggerWorkerImmediate } from '../services/outboxWorker.service.js';
import mongoose from 'mongoose';

/**
 * Extracts client IP address safely.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '';
}

/**
 * Helper to detect basic browser/device if not supplied by client
 */
function detectDeviceInfo(userAgent = '') {
  const ua = userAgent.toLowerCase();
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod/.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/.test(ua)) {
    deviceType = 'tablet';
  }

  let browser = 'Unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edge')) browser = 'Edge';

  return { deviceType, browser };
}

/**
 * Public Lead Creation Endpoint
 * POST /api/v1/leads
 */
export const createLead = asyncHandler(async (req, res, next) => {
  // 1. Validate request body with Zod
  const validationResult = createLeadSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errorMsg = validationResult.error.errors.map((e) => e.message).join(', ');
    return next(new AppError(errorMsg, 400));
  }

  const data = validationResult.data;
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || data.userAgent || '';
  const detected = detectDeviceInfo(userAgent);

  // 2. Verify Cloudflare Turnstile token
  const turnstileCheck = await verifyTurnstileToken(data.turnstileToken, clientIp);
  if (!turnstileCheck.success) {
    return next(new AppError(turnstileCheck.message || 'Captcha verification failed', 400));
  }

  // 3. Resolve & validate project context if projectId is provided
  let validProjectId = null;
  let projectName = data.projectName;
  let projectSlug = data.projectSlug;
  let city = data.city;
  let developer = data.developer;

  if (data.projectId && mongoose.Types.ObjectId.isValid(data.projectId)) {
    try {
      const existingProject = await Project.findById(data.projectId).select(
        'title slug city developer'
      );
      if (existingProject) {
        validProjectId = existingProject._id;
        if (!projectName) projectName = existingProject.title;
        if (!projectSlug) projectSlug = existingProject.slug;
        if (!city) city = existingProject.city;
        if (!developer) developer = existingProject.developer;
      }
    } catch {
      // Continue even if lookup fails, so lead is not dropped
    }
  }

  // 4. Create Lead in MongoDB
  const leadDoc = {
    fullName: data.fullName,
    email: data.email,
    countryCode: data.countryCode,
    phone: data.phone,
    message: data.message,

    formType: data.formType,
    formLocation: data.formLocation,
    projectId: validProjectId,
    projectName,
    projectSlug,
    city,
    developer,
    projectUrl: data.projectUrl,

    firstTouch: data.firstTouch || {},
    latestTouch: data.latestTouch || {},
    utmSource: data.utmSource || data.latestTouch?.utmSource || data.firstTouch?.utmSource || '',
    utmMedium: data.utmMedium || data.latestTouch?.utmMedium || data.firstTouch?.utmMedium || '',
    utmCampaign: data.utmCampaign || data.latestTouch?.utmCampaign || data.firstTouch?.utmCampaign || '',
    utmTerm: data.utmTerm || data.latestTouch?.utmTerm || data.firstTouch?.utmTerm || '',
    utmContent: data.utmContent || data.latestTouch?.utmContent || data.firstTouch?.utmContent || '',
    referrer: data.referrer || data.latestTouch?.referrer || data.firstTouch?.referrer || '',
    landingPage: data.landingPage || data.latestTouch?.landingPage || data.firstTouch?.landingPage || '',
    submissionPage: data.submissionPage || data.projectUrl || '',
    sessionId: data.sessionId,

    ipAddress: clientIp,
    userAgent,
    browser: data.browser || detected.browser,
    deviceType: data.deviceType !== 'unknown' ? data.deviceType : detected.deviceType,

    status: 'new',
    emailStatus: 'pending',
    crmStatus: 'pending',
  };

  const lead = await Lead.create(leadDoc);

  // 5. Create Outbox Jobs for Email & CRM
  const leadSnapshot = lead.toObject();

  await Promise.allSettled([
    LeadJob.create({
      leadId: lead._id,
      type: 'EMAIL_NOTIFICATION',
      status: 'pending',
      idempotencyKey: `${lead._id}_EMAIL`,
      payload: leadSnapshot,
    }),
    LeadJob.create({
      leadId: lead._id,
      type: 'LEADSQUARED_SYNC',
      status: 'pending',
      idempotencyKey: `${lead._id}_CRM`,
      payload: leadSnapshot,
    }),
  ]);

  // 6. Trigger Outbox worker immediately
  triggerWorkerImmediate();

  // 7. Return immediate success response to frontend
  res.status(201).json({
    success: true,
    message: 'Your enquiry has been received. Our senior real estate advisor will connect with you shortly.',
    data: {
      leadId: lead._id,
    },
  });
});

