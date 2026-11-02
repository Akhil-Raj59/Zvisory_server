import mongoose from 'mongoose';
import Developer from '../models/developer.model.js';
import Project from '../models/project.model.js';
import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';
import {
  createDeveloperSchema,
  updateDeveloperSchema,
  updateDeveloperStatusSchema,
  transferDeveloperProjectsSchema,
} from '../validations/developer.validation.js';

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

/**
 * Admin: Get paginated developers with status filter and real-time project counts
 * GET /api/v1/admin/developers
 */
export const adminGetDevelopers = asyncHandler(async (req, res) => {
  const {
    status,
    search,
    sort = 'newest',
    page = 1,
    limit = 10,
  } = req.query;

  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  const searchTerm = (search || '').trim();
  if (searchTerm) {
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ name: regex }, { slug: regex }, { headquarters: regex }, { shortDescription: regex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Run queries in parallel
  const [devDocs, total, statusCounts, projectAggregation] = await Promise.all([
    Developer.find(query).skip(skip).limit(limitNum).lean(),
    Developer.countDocuments(query),
    Developer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Project.aggregate([
      {
        $group: {
          _id: { $toLower: '$developer' },
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  // Build project counts lookup map
  const projectMap = new Map();
  projectAggregation.forEach((agg) => {
    if (agg._id) {
      projectMap.set(agg._id, {
        total: agg.total,
        published: agg.published,
        draft: agg.draft,
        archived: agg.archived,
      });
    }
  });

  // Calculate status summary
  const statusSummary = { all: 0, published: 0, draft: 0, archived: 0 };
  statusCounts.forEach((sc) => {
    if (sc._id && statusSummary[sc._id] !== undefined) {
      statusSummary[sc._id] = sc.count;
      statusSummary.all += sc.count;
    }
  });

  // Attach live project counts
  const enrichedDevelopers = devDocs.map((dev) => {
    const key = (dev.name || '').toLowerCase().trim();
    const stats = projectMap.get(key) || { total: 0, published: 0, draft: 0, archived: 0 };
    return {
      ...dev,
      projectCount: stats.total,
      publishedProjectsCount: stats.published,
      draftProjectsCount: stats.draft,
      archivedProjectsCount: stats.archived,
    };
  });

  // Apply sorting
  const sortMap = {
    name_asc: (a, b) => a.name.localeCompare(b.name),
    name_desc: (a, b) => b.name.localeCompare(a.name),
    projects_desc: (a, b) => b.projectCount - a.projectCount,
    projects_asc: (a, b) => a.projectCount - b.projectCount,
    oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    updated: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  };

  const sortFn = sortMap[sort] || sortMap.newest;
  enrichedDevelopers.sort(sortFn);

  res.status(200).json({
    success: true,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    page: pageNum,
    count: enrichedDevelopers.length,
    statusSummary,
    data: enrichedDevelopers,
  });
});

/**
 * Admin: Get developer by ID or slug with associated project stats
 * GET /api/v1/admin/developers/:id
 */
export const adminGetDeveloperById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const developer = await Developer.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  ).lean();

  if (!developer) {
    return next(new AppError('Developer not found', 404));
  }

  const escapedName = developer.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const [projectStats, recentProjects] = await Promise.all([
    Project.aggregate([
      { $match: { developer: { $regex: new RegExp(`^${escapedName}$`, 'i') } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Project.find({ developer: { $regex: new RegExp(`^${escapedName}$`, 'i') } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title slug city status startingPrice cardBanner launchStatus updatedAt')
      .lean(),
  ]);

  const stats = { total: 0, published: 0, draft: 0, archived: 0 };
  projectStats.forEach((ps) => {
    if (ps._id && stats[ps._id] !== undefined) {
      stats[ps._id] = ps.count;
      stats.total += ps.count;
    }
  });

  res.status(200).json({
    success: true,
    data: {
      ...developer,
      projectStats: stats,
      totalProjects: stats.total,
      publishedProjects: stats.published,
      draftProjects: stats.draft,
      archivedProjects: stats.archived,
      recentProjects,
    },
  });
});

/**
 * Admin: Get all projects for a specific developer with pagination
 * GET /api/v1/admin/developers/:id/projects
 */
export const adminGetDeveloperProjects = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { page = 1, limit = 10, status, search } = req.query;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const developer = await Developer.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  ).lean();

  if (!developer) {
    return next(new AppError('Developer not found', 404));
  }

  const escapedName = developer.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = { developer: { $regex: new RegExp(`^${escapedName}$`, 'i') } };

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ title: regex }, { city: regex }, { slug: regex }, { microMarket: regex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [projects, total] = await Promise.all([
    Project.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
    Project.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    developer: { id: developer._id, name: developer.name, slug: developer.slug },
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    page: pageNum,
    count: projects.length,
    data: projects,
  });
});

/**
 * Admin: Create a new developer
 * POST /api/v1/admin/developers
 */
export const adminCreateDeveloper = asyncHandler(async (req, res, next) => {
  const parsed = createDeveloperSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return next(new AppError(msg, 400));
  }

  const data = parsed.data;
  const normalizedName = data.name.trim().replace(/\s+/g, ' ');
  let normalizedSlug = data.slug ? data.slug.trim().toLowerCase() : slugify(normalizedName);

  if (!normalizedSlug) {
    normalizedSlug = slugify(normalizedName);
  }

  // Check for duplicate name or slug
  const existing = await Developer.findOne({
    $or: [
      { name: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { slug: normalizedSlug },
    ],
  });

  if (existing) {
    if (existing.slug === normalizedSlug) {
      return next(new AppError(`A developer with the slug "${normalizedSlug}" already exists.`, 409));
    }
    return next(new AppError(`A developer with the name "${normalizedName}" already exists.`, 409));
  }

  // Determine existing project count
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingProjectCount = await Project.countDocuments({
    developer: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  });

  const developer = await Developer.create({
    name: normalizedName,
    slug: normalizedSlug,
    logo: (data.logo || '').trim(),
    shortDescription: (data.shortDescription || '').trim(),
    description: (data.description || '').trim(),
    website: (data.website || '').trim(),
    headquarters: (data.headquarters || '').trim(),
    seo: data.seo || {},
    status: data.status || 'published',
    projectCount: existingProjectCount,
  });

  res.status(201).json({
    success: true,
    message: `Developer "${developer.name}" created successfully`,
    data: developer,
  });
});

/**
 * Admin: Update developer details
 * PUT /api/v1/admin/developers/:id
 */
export const adminUpdateDeveloper = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const developer = await Developer.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );

  if (!developer) {
    return next(new AppError('Developer not found', 404));
  }

  const parsed = updateDeveloperSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return next(new AppError(msg, 400));
  }

  const data = parsed.data;
  const oldName = developer.name;
  let newName = oldName;

  if (data.name && data.name.trim()) {
    newName = data.name.trim().replace(/\s+/g, ' ');
    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const nameConflict = await Developer.findOne({
        _id: { $ne: developer._id },
        name: new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (nameConflict) {
        return next(new AppError(`Another developer with name "${newName}" already exists.`, 409));
      }
    }
  }

  if (data.slug && data.slug.trim()) {
    const newSlug = data.slug.trim().toLowerCase();
    if (newSlug !== developer.slug) {
      const slugConflict = await Developer.findOne({
        _id: { $ne: developer._id },
        slug: newSlug,
      });
      if (slugConflict) {
        return next(new AppError(`Another developer with slug "${newSlug}" already exists.`, 409));
      }
      developer.slug = newSlug;
    }
  }

  developer.name = newName;
  if (data.logo !== undefined) developer.logo = data.logo.trim();
  if (data.shortDescription !== undefined) developer.shortDescription = data.shortDescription.trim();
  if (data.description !== undefined) developer.description = data.description.trim();
  if (data.website !== undefined) developer.website = data.website.trim();
  if (data.headquarters !== undefined) developer.headquarters = data.headquarters.trim();
  if (data.seo !== undefined) developer.seo = { ...developer.seo, ...data.seo };
  if (data.status !== undefined) developer.status = data.status;

  // If canonical name changed, update associated projects
  if (oldName !== newName) {
    const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await Project.updateMany(
      { developer: { $regex: new RegExp(`^${escapedOld}$`, 'i') } },
      { $set: { developer: newName } }
    );
  }

  // Recalculate projectCount
  const escapedNew = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  developer.projectCount = await Project.countDocuments({
    developer: { $regex: new RegExp(`^${escapedNew}$`, 'i') },
  });

  await developer.save();

  res.status(200).json({
    success: true,
    message: `Developer "${developer.name}" updated successfully`,
    data: developer,
  });
});

/**
 * Admin: Change developer status
 * PATCH /api/v1/admin/developers/:id/status
 */
export const adminUpdateDeveloperStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const parsed = updateDeveloperStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError('Invalid status. Must be draft, published, or archived', 400));
  }

  const developer = await Developer.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );

  if (!developer) {
    return next(new AppError('Developer not found', 404));
  }

  developer.status = parsed.data.status;
  await developer.save();

  res.status(200).json({
    success: true,
    message: `Developer "${developer.name}" status updated to ${developer.status}`,
    data: { id: developer._id, slug: developer.slug, status: developer.status },
  });
});

/**
 * Admin: Transfer projects from source developer to target developer
 * POST /api/v1/admin/developers/:id/transfer
 */
export const adminTransferDeveloperProjects = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isSourceObjectId = mongoose.Types.ObjectId.isValid(id);

  const parsed = transferDeveloperProjectsSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError('targetDeveloperId is required', 400));
  }

  const { targetDeveloperId } = parsed.data;
  const isTargetObjectId = mongoose.Types.ObjectId.isValid(targetDeveloperId);

  const sourceDeveloper = await Developer.findOne(
    isSourceObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );
  if (!sourceDeveloper) return next(new AppError('Source developer not found', 404));

  const targetDeveloper = await Developer.findOne(
    isTargetObjectId ? { _id: targetDeveloperId } : { slug: targetDeveloperId.toLowerCase().trim() }
  );
  if (!targetDeveloper) return next(new AppError('Target developer not found', 404));

  if (sourceDeveloper._id.toString() === targetDeveloper._id.toString()) {
    return next(new AppError('Cannot transfer: source and target developer are identical.', 400));
  }

  const escapedSourceName = sourceDeveloper.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const projectQuery = { developer: { $regex: new RegExp(`^${escapedSourceName}$`, 'i') } };

  const affectedProjects = await Project.find(projectQuery).select('_id title developer').lean();
  const affectedCount = affectedProjects.length;

  if (affectedCount === 0) {
    return res.status(200).json({
      success: true,
      message: `No projects were assigned to "${sourceDeveloper.name}". No transfer needed.`,
      data: {
        sourceDeveloper: { id: sourceDeveloper._id, name: sourceDeveloper.name },
        targetDeveloper: { id: targetDeveloper._id, name: targetDeveloper.name },
        transferredCount: 0,
        affectedProjectIds: [],
      },
    });
  }

  const updateResult = await Project.updateMany(projectQuery, {
    $set: { developer: targetDeveloper.name },
  });

  const escapedTargetName = targetDeveloper.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const [sourceRemaining, targetNewTotal] = await Promise.all([
    Project.countDocuments({ developer: { $regex: new RegExp(`^${escapedSourceName}$`, 'i') } }),
    Project.countDocuments({ developer: { $regex: new RegExp(`^${escapedTargetName}$`, 'i') } }),
  ]);

  sourceDeveloper.projectCount = sourceRemaining;
  targetDeveloper.projectCount = targetNewTotal;
  await Promise.all([sourceDeveloper.save(), targetDeveloper.save()]);

  res.status(200).json({
    success: true,
    message: `Successfully transferred ${affectedCount} project(s) from "${sourceDeveloper.name}" to "${targetDeveloper.name}".`,
    data: {
      sourceDeveloper: { id: sourceDeveloper._id, name: sourceDeveloper.name, remainingProjects: sourceRemaining },
      targetDeveloper: { id: targetDeveloper._id, name: targetDeveloper.name, newTotalProjects: targetNewTotal },
      transferredCount: affectedCount,
      affectedProjectIds: affectedProjects.map((p) => p._id),
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    },
  });
});

/**
 * Admin: Safely delete developer after dependencies are resolved
 * DELETE /api/v1/admin/developers/:id
 */
export const adminDeleteDeveloper = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const developer = await Developer.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );

  if (!developer) {
    return next(new AppError('Developer not found', 404));
  }

  const escapedName = developer.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const associatedProjectsCount = await Project.countDocuments({
    developer: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  });

  if (associatedProjectsCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete developer "${developer.name}" because it still has ${associatedProjectsCount} associated project(s). Transfer or reassign these projects before deleting.`,
      associatedProjectsCount,
      requiresTransfer: true,
      developer: { id: developer._id, name: developer.name, slug: developer.slug },
    });
  }

  await Developer.findByIdAndDelete(developer._id);

  res.status(200).json({
    success: true,
    message: `Developer "${developer.name}" deleted successfully.`,
    data: { id: developer._id, name: developer.name, slug: developer.slug },
  });
});
