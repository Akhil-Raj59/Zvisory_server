import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';
import Lead from '../models/lead.model.js';
import LeadJob from '../models/leadJob.model.js';
import { updateLeadStatusSchema } from '../validations/lead.validation.js';
import { adminRetryJob } from '../services/outboxWorker.service.js';

/**
 * Admin Get Paginated Leads
 * GET /api/v1/admin/leads
 */
export const adminGetLeads = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const {
    search,
    status,
    city,
    developer,
    projectName,
    utmSource,
    utmCampaign,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filter = {};

  // Status Filter
  if (status && status !== 'all') {
    filter.status = status;
  }

  // Search Filter (Regex across name, email, phone, project)
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { projectName: searchRegex },
      { city: searchRegex },
      { developer: searchRegex },
    ];
  }

  // City Filter
  if (city && city.trim()) {
    filter.city = new RegExp(`^${city.trim()}$`, 'i');
  }

  // Developer Filter
  if (developer && developer.trim()) {
    filter.developer = new RegExp(`^${developer.trim()}$`, 'i');
  }

  // Project Filter
  if (projectName && projectName.trim()) {
    filter.projectName = new RegExp(projectName.trim(), 'i');
  }

  // Source & Campaign Filter
  if (utmSource && utmSource.trim()) {
    filter.utmSource = new RegExp(`^${utmSource.trim()}$`, 'i');
  }
  if (utmCampaign && utmCampaign.trim()) {
    filter.utmCampaign = new RegExp(`^${utmCampaign.trim()}$`, 'i');
  }

  // Date Range Filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortDirection };

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      leads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Admin Get Lead Statistics Overview
 * GET /api/v1/admin/leads/stats
 */
export const adminGetLeadStats = asyncHandler(async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, newCount, contactedCount, closedCount, todayCount, sourceStats, cityStats] =
    await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'new' }),
      Lead.countDocuments({ status: 'contacted' }),
      Lead.countDocuments({ status: 'closed' }),
      Lead.countDocuments({ createdAt: { $gte: todayStart } }),
      Lead.aggregate([
        { $match: { utmSource: { $ne: '' } } },
        { $group: { _id: '$utmSource', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Lead.aggregate([
        { $match: { city: { $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

  res.json({
    success: true,
    data: {
      total,
      new: newCount,
      contacted: contactedCount,
      closed: closedCount,
      today: todayCount,
      topSources: sourceStats.map((s) => ({ source: s._id, count: s.count })),
      topCities: cityStats.map((c) => ({ city: c._id, count: c.count })),
    },
  });
});

/**
 * Admin Get Single Lead by ID with Jobs & History
 * GET /api/v1/admin/leads/:id
 */
export const adminGetLeadById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const lead = await Lead.findById(id).populate('statusHistory.changedBy', 'fullName email role');
  if (!lead) {
    return next(new AppError('Lead not found', 404));
  }

  // Fetch associated Outbox jobs
  const jobs = await LeadJob.find({ leadId: lead._id }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      lead,
      jobs,
    },
  });
});

/**
 * Admin Update Lead Status
 * PATCH /api/v1/admin/leads/:id/status
 */
export const adminUpdateLeadStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const validationResult = updateLeadStatusSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errorMsg = validationResult.error.errors.map((e) => e.message).join(', ');
    return next(new AppError(errorMsg, 400));
  }

  const { status, notes } = validationResult.data;

  const lead = await Lead.findById(id);
  if (!lead) {
    return next(new AppError('Lead not found', 404));
  }

  lead.status = status;
  lead.statusHistory.push({
    status,
    changedAt: new Date(),
    changedBy: req.user?._id || null,
    notes: notes || `Status updated to ${status} by admin`,
  });

  await lead.save();

  res.json({
    success: true,
    message: `Lead status updated to ${status}`,
    data: {
      lead,
    },
  });
});

/**
 * Admin Retry Failed Outbox Job
 * POST /api/v1/admin/leads/:id/retry-job/:jobId
 */
export const adminRetryLeadJobController = asyncHandler(async (req, res, next) => {
  const { jobId } = req.params;

  try {
    const job = await adminRetryJob(jobId);
    res.json({
      success: true,
      message: 'Job re-queued successfully for execution',
      data: { job },
    });
  } catch (err) {
    return next(new AppError(err.message || 'Failed to retry job', 400));
  }
});

