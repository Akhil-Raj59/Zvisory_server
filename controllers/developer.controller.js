import Developer from '../models/developer.model.js';
import Project from '../models/project.model.js';
import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';

/**
 * Public: List published developers with real-time published project counts
 * GET /api/v1/developers
 */
export const getPublicDevelopers = asyncHandler(async (req, res) => {
  const { search, sort = 'projects_desc', limit } = req.query;

  const query = { status: 'published' };

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ name: regex }, { slug: regex }, { headquarters: regex }, { shortDescription: regex }];
  }

  // Aggregate published project counts grouped by lowercase developer name
  const [developers, projectCounts] = await Promise.all([
    Developer.find(query).lean(),
    Project.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: { $toLower: '$developer' }, count: { $sum: 1 }, minPrice: { $min: '$priceNumeric' } } },
    ]),
  ]);

  const countMap = new Map();
  const priceMap = new Map();
  projectCounts.forEach((pc) => {
    if (pc._id) {
      countMap.set(pc._id, pc.count);
      if (pc.minPrice) priceMap.set(pc._id, pc.minPrice);
    }
  });

  // Attach live counts and format response
  let result = developers.map((dev) => {
    const key = (dev.name || '').toLowerCase().trim();
    const liveCount = countMap.get(key) || 0;
    const minNumeric = priceMap.get(key);

    return {
      _id: dev._id,
      id: dev.slug,
      name: dev.name,
      slug: dev.slug,
      logo: dev.logo || '',
      shortDescription: dev.shortDescription || '',
      description: dev.description || '',
      website: dev.website || '',
      headquarters: dev.headquarters || '',
      projectCount: liveCount,
      minPrice: minNumeric ? `₹${(minNumeric / 10000000).toFixed(2)} Cr*` : 'Price On Request',
      status: dev.status,
      seo: dev.seo || {},
      createdAt: dev.createdAt,
      updatedAt: dev.updatedAt,
    };
  });

  // Sort
  if (sort === 'name_asc') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'name_desc') {
    result.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'oldest') {
    result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    // projects_desc by default
    result.sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name));
  }

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      result = result.slice(0, limitNum);
    }
  }

  res.status(200).json({
    success: true,
    count: result.length,
    data: result,
  });
});

/**
 * Public: Get published developer details by slug
 * GET /api/v1/developers/:slug
 */
export const getPublicDeveloperBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const cleanSlug = (slug || '').toLowerCase().trim();

  // Find published developer by slug or case-insensitive name
  const developer = await Developer.findOne({
    status: 'published',
    $or: [
      { slug: cleanSlug },
      { name: new RegExp(`^${cleanSlug.replace(/-/g, ' ')}$`, 'i') },
      { name: new RegExp(`^${cleanSlug}$`, 'i') },
    ],
  }).lean();

  if (!developer) {
    return next(new AppError('Developer not found or is not currently published', 404));
  }

  const escapedName = developer.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const [publishedProjectsCount, citiesActive] = await Promise.all([
    Project.countDocuments({
      status: 'published',
      developer: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    }),
    Project.distinct('city', {
      status: 'published',
      developer: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      ...developer,
      projectCount: publishedProjectsCount,
      publishedProjectsCount,
      citiesActive: citiesActive.filter(Boolean),
    },
  });
});

/**
 * Public: Get published projects belonging to a developer
 * GET /api/v1/developers/:slug/projects
 */
export const getPublicDeveloperProjects = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const { page = 1, limit = 12, sort = 'newest', city, propertyType, category } = req.query;
  const cleanSlug = (slug || '').toLowerCase().trim();

  const developer = await Developer.findOne({
    status: 'published',
    $or: [
      { slug: cleanSlug },
      { name: new RegExp(`^${cleanSlug.replace(/-/g, ' ')}$`, 'i') },
      { name: new RegExp(`^${cleanSlug}$`, 'i') },
    ],
  }).lean();

  if (!developer) {
    return next(new AppError('Developer not found or is not currently published', 404));
  }

  const escapedName = developer.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const projectQuery = {
    status: 'published',
    developer: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  };

  if (city && city !== 'All') {
    projectQuery.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
  }
  if (propertyType && propertyType !== 'All') {
    projectQuery.propertyType = propertyType;
  }
  if (category && category !== 'All') {
    projectQuery.categories = category;
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { priceNumeric: 1 },
    price_desc: { priceNumeric: -1 },
    name_asc: { title: 1 },
    name_desc: { title: -1 },
  };
  const sortOption = sortMap[sort] || sortMap.newest;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (pageNum - 1) * limitNum;

  const [projects, total] = await Promise.all([
    Project.find(projectQuery).sort(sortOption).skip(skip).limit(limitNum).lean(),
    Project.countDocuments(projectQuery),
  ]);

  res.status(200).json({
    success: true,
    developer: {
      id: developer._id,
      name: developer.name,
      slug: developer.slug,
      logo: developer.logo,
      headquarters: developer.headquarters,
    },
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    page: pageNum,
    count: projects.length,
    data: projects,
  });
});

