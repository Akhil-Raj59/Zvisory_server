import mongoose from 'mongoose';
import City from '../models/city.model.js';
import Project from '../models/project.model.js';
import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';
import {
  createCitySchema,
  updateCitySchema,
  updateCityStatusSchema,
  transferProjectsSchema,
} from '../validations/city.validation.js';

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

const parseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Admin: Get paginated cities with status filter and real-time project counts
 * GET /api/v1/admin/cities
 */
export const adminGetCities = asyncHandler(async (req, res) => {
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
    query.$or = [{ name: regex }, { state: regex }, { slug: regex }, { country: regex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Run queries in parallel
  const [citiesDocs, total, statusCounts, projectAggregation] = await Promise.all([
    City.find(query).skip(skip).limit(limitNum).lean(),
    City.countDocuments(query),
    City.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Project.aggregate([
      {
        $group: {
          _id: { $toLower: '$city' },
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

  // Calculate status summary for cities
  const statusSummary = {
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  };
  statusCounts.forEach((sc) => {
    if (sc._id && statusSummary[sc._id] !== undefined) {
      statusSummary[sc._id] = sc.count;
      statusSummary.all += sc.count;
    }
  });

  // Attach live project counts
  const enrichedCities = citiesDocs.map((city) => {
    const key = (city.name || '').toLowerCase().trim();
    const stats = projectMap.get(key) || { total: 0, published: 0, draft: 0, archived: 0 };

    return {
      ...city,
      coverImage: city.image || city.coverImage,
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
  enrichedCities.sort(sortFn);

  res.status(200).json({
    success: true,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    page: pageNum,
    count: enrichedCities.length,
    statusSummary,
    data: enrichedCities,
  });
});

/**
 * Admin: Get city by ID or slug with associated project stats
 * GET /api/v1/admin/cities/:id
 */
export const adminGetCityById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const city = await City.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  ).lean();

  if (!city) {
    return next(new AppError('City not found', 404));
  }

  const escapedName = city.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const [projectStats, recentProjects] = await Promise.all([
    Project.aggregate([
      { $match: { city: { $regex: new RegExp(`^${escapedName}$`, 'i') } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Project.find({ city: { $regex: new RegExp(`^${escapedName}$`, 'i') } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title slug developer status startingPrice cardBanner launchStatus updatedAt')
      .lean(),
  ]);

  const stats = {
    total: 0,
    published: 0,
    draft: 0,
    archived: 0,
  };

  projectStats.forEach((ps) => {
    if (ps._id && stats[ps._id] !== undefined) {
      stats[ps._id] = ps.count;
      stats.total += ps.count;
    }
  });

  res.status(200).json({
    success: true,
    data: {
      ...city,
      coverImage: city.image || city.coverImage,
      projectStats,
      totalProjects: stats.total,
      publishedProjects: stats.published,
      draftProjects: stats.draft,
      archivedProjects: stats.archived,
      recentProjects,
    },
  });
});

/**
 * Admin: Get all projects for a specific city with pagination
 * GET /api/v1/admin/cities/:id/projects
 */
export const adminGetCityProjects = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { page = 1, limit = 10, status, search } = req.query;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const city = await City.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  ).lean();

  if (!city) {
    return next(new AppError('City not found', 404));
  }

  const escapedName = city.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    city: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  };

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ title: regex }, { developer: regex }, { slug: regex }, { microMarket: regex }];
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
    city: {
      id: city._id,
      name: city.name,
      slug: city.slug,
    },
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    page: pageNum,
    count: projects.length,
    data: projects,
  });
});

/**
 * Admin: Create a new city
 * POST /api/v1/admin/cities
 */
export const adminCreateCity = asyncHandler(async (req, res, next) => {
  const parsed = createCitySchema.safeParse(req.body);
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

  // Check for duplicate name or slug (case-insensitive)
  const existing = await City.findOne({
    $or: [
      { name: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { slug: normalizedSlug },
    ],
  });

  if (existing) {
    if (existing.slug === normalizedSlug) {
      return next(new AppError(`A city with the slug "${normalizedSlug}" already exists.`, 409));
    }
    return next(new AppError(`A city with the name "${normalizedName}" already exists.`, 409));
  }

  // Parse highlights and localities
  const highlights = parseArray(data.highlights);
  const localities = parseArray(data.localities);
  const gallery = Array.isArray(data.gallery) ? data.gallery.map((s) => String(s).trim()).filter(Boolean) : [];

  // Determine existing project count
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingProjectCount = await Project.countDocuments({
    city: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  });

  const city = await City.create({
    name: normalizedName,
    slug: normalizedSlug,
    state: (data.state || '').trim(),
    country: (data.country || 'India').trim(),
    image: data.coverImage || data.image || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
    startingPrice: (data.startingPrice || '₹1.5 Cr*').trim(),
    shortDescription: (data.shortDescription || '').trim(),
    description: (data.description || '').trim(),
    highlights,
    localities,
    gallery,
    seo: data.seo || {},
    status: data.status || 'published',
    isFeatured: Boolean(data.isFeatured),
    projectCount: existingProjectCount,
  });

  res.status(201).json({
    success: true,
    message: `City "${city.name}" created successfully`,
    data: city,
  });
});

/**
 * Admin: Update city details
 * PUT /api/v1/admin/cities/:id
 */
export const adminUpdateCity = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const city = await City.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );

  if (!city) {
    return next(new AppError('City not found', 404));
  }

  const parsed = updateCitySchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return next(new AppError(msg, 400));
  }

  const data = parsed.data;
  const oldName = city.name;
  let newName = oldName;

  if (data.name && data.name.trim()) {
    newName = data.name.trim().replace(/\s+/g, ' ');
    // Check name collision
    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const nameConflict = await City.findOne({
        _id: { $ne: city._id },
        name: new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (nameConflict) {
        return next(new AppError(`Another city with name "${newName}" already exists.`, 409));
      }
    }
  }

  if (data.slug && data.slug.trim()) {
    const newSlug = data.slug.trim().toLowerCase();
    if (newSlug !== city.slug) {
      const slugConflict = await City.findOne({
        _id: { $ne: city._id },
        slug: newSlug,
      });
      if (slugConflict) {
        return next(new AppError(`Another city with slug "${newSlug}" already exists.`, 409));
      }
      city.slug = newSlug;
    }
  }

  city.name = newName;
  if (data.state !== undefined) city.state = data.state.trim();
  if (data.country !== undefined) city.country = data.country.trim();
  if (data.image !== undefined || data.coverImage !== undefined) {
    city.image = (data.coverImage || data.image || city.image).trim();
  }
  if (data.startingPrice !== undefined) city.startingPrice = data.startingPrice.trim();
  if (data.shortDescription !== undefined) city.shortDescription = data.shortDescription.trim();
  if (data.description !== undefined) city.description = data.description.trim();
  if (data.highlights !== undefined) city.highlights = parseArray(data.highlights);
  if (data.localities !== undefined) city.localities = parseArray(data.localities);
  if (data.gallery !== undefined) {
    city.gallery = Array.isArray(data.gallery) ? data.gallery.map((s) => String(s).trim()).filter(Boolean) : [];
  }
  if (data.seo !== undefined) city.seo = { ...city.seo, ...data.seo };
  if (data.status !== undefined) city.status = data.status;
  if (data.isFeatured !== undefined) city.isFeatured = Boolean(data.isFeatured);

  // If the canonical name changed, update associated projects so they stay linked!
  if (oldName !== newName) {
    const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await Project.updateMany(
      { city: { $regex: new RegExp(`^${escapedOld}$`, 'i') } },
      { $set: { city: newName } }
    );
  }

  // Recalculate projectCount
  const escapedNew = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  city.projectCount = await Project.countDocuments({
    city: { $regex: new RegExp(`^${escapedNew}$`, 'i') },
  });

  await city.save();

  res.status(200).json({
    success: true,
    message: `City "${city.name}" updated successfully`,
    data: city,
  });
});

/**
 * Admin: Change city status (draft, published, archived)
 * PATCH /api/v1/admin/cities/:id/status
 */
export const adminUpdateCityStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const parsed = updateCityStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError('Invalid status. Must be draft, published, or archived', 400));
  }

  const city = await City.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );

  if (!city) {
    return next(new AppError('City not found', 404));
  }

  city.status = parsed.data.status;
  await city.save();

  res.status(200).json({
    success: true,
    message: `City "${city.name}" status updated to ${city.status}`,
    data: {
      id: city._id,
      slug: city.slug,
      status: city.status,
    },
  });
});

/**
 * Admin: Safely transfer projects from source city to target city
 * POST /api/v1/admin/cities/:id/transfer
 */
export const adminTransferProjects = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isSourceObjectId = mongoose.Types.ObjectId.isValid(id);

  const parsed = transferProjectsSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError('targetCityId is required', 400));
  }

  const { targetCityId } = parsed.data;
  const isTargetObjectId = mongoose.Types.ObjectId.isValid(targetCityId);

  // 1. Fetch Source City
  const sourceCity = await City.findOne(
    isSourceObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );

  if (!sourceCity) {
    return next(new AppError('Source city not found', 404));
  }

  // 2. Fetch Target City
  const targetCity = await City.findOne(
    isTargetObjectId ? { _id: targetCityId } : { slug: targetCityId.toLowerCase().trim() }
  );

  if (!targetCity) {
    return next(new AppError('Target city not found', 404));
  }

  // 3. Prevent transferring to self
  if (sourceCity._id.toString() === targetCity._id.toString()) {
    return next(new AppError('Cannot transfer projects: Source city and target city are identical.', 400));
  }

  // 4. Find and count affected projects
  const escapedSourceName = sourceCity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const projectQuery = {
    city: { $regex: new RegExp(`^${escapedSourceName}$`, 'i') },
  };

  const affectedProjects = await Project.find(projectQuery).select('_id title city').lean();
  const affectedCount = affectedProjects.length;

  if (affectedCount === 0) {
    return res.status(200).json({
      success: true,
      message: `No projects were assigned to "${sourceCity.name}". No transfer needed.`,
      data: {
        sourceCity: { id: sourceCity._id, name: sourceCity.name },
        targetCity: { id: targetCity._id, name: targetCity.name },
        transferredCount: 0,
        affectedProjectIds: [],
      },
    });
  }

  // 5. Update projects to use target city canonical name
  const updateResult = await Project.updateMany(projectQuery, {
    $set: { city: targetCity.name },
  });

  // 6. Recalculate project counts for both cities
  const [sourceRemaining, targetNewTotal] = await Promise.all([
    Project.countDocuments({ city: { $regex: new RegExp(`^${escapedSourceName}$`, 'i') } }),
    Project.countDocuments({
      city: { $regex: new RegExp(`^${targetCity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }),
  ]);

  sourceCity.projectCount = sourceRemaining;
  targetCity.projectCount = targetNewTotal;

  await Promise.all([sourceCity.save(), targetCity.save()]);

  res.status(200).json({
    success: true,
    message: `Successfully transferred ${affectedCount} project(s) from "${sourceCity.name}" to "${targetCity.name}".`,
    data: {
      sourceCity: {
        id: sourceCity._id,
        name: sourceCity.name,
        remainingProjects: sourceRemaining,
      },
      targetCity: {
        id: targetCity._id,
        name: targetCity.name,
        newTotalProjects: targetNewTotal,
      },
      transferredCount: affectedCount,
      affectedProjectIds: affectedProjects.map((p) => p._id),
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    },
  });
});

/**
 * Admin: Safely delete city after dependencies are resolved
 * DELETE /api/v1/admin/cities/:id
 */
export const adminDeleteCity = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const city = await City.findOne(
    isObjectId ? { _id: id } : { slug: id.toLowerCase().trim() }
  );

  if (!city) {
    return next(new AppError('City not found', 404));
  }

  // Check if any projects are still associated with this city
  const escapedName = city.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const associatedProjectsCount = await Project.countDocuments({
    city: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  });

  if (associatedProjectsCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete city "${city.name}" because it still has ${associatedProjectsCount} associated project(s). You must transfer or reassign these projects before deleting this city.`,
      associatedProjectsCount,
      requiresTransfer: true,
      city: {
        id: city._id,
        name: city.name,
        slug: city.slug,
      },
    });
  }

  // Safe to delete city document - NEVER delete projects
  await City.findByIdAndDelete(city._id);

  res.status(200).json({
    success: true,
    message: `City "${city.name}" deleted successfully.`,
    data: {
      id: city._id,
      name: city.name,
      slug: city.slug,
    },
  });
});
