import City from '../models/city.model.js';
import Project from '../models/project.model.js';
import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';

/**
 * Public: List published cities with real-time published project counts
 * GET /api/v1/cities
 */
export const getPublicCities = asyncHandler(async (req, res) => {
  const { search, sort = 'featured', limit } = req.query;

  const query = { status: 'published' };

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ name: regex }, { state: regex }, { slug: regex }];
  }

  // Aggregate published project counts grouped by lowercase city name
  const [cities, projectCounts] = await Promise.all([
    City.find(query).lean(),
    Project.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: { $toLower: '$city' }, count: { $sum: 1 }, minPrice: { $min: '$priceNumeric' } } },
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
  let result = cities.map((city) => {
    const key = (city.name || '').toLowerCase().trim();
    const liveCount = countMap.get(key) || 0;
    const minNumeric = priceMap.get(key);

    return {
      _id: city._id,
      id: city.slug,
      name: city.name,
      slug: city.slug,
      state: city.state || '',
      country: city.country || 'India',
      image: city.image || city.coverImage || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
      coverImage: city.image || city.coverImage || '',
      startingPrice: city.startingPrice || (minNumeric ? `₹${(minNumeric / 10000000).toFixed(2)} Cr*` : '₹1.5 Cr*'),
      shortDescription: city.shortDescription || '',
      description: city.description || '',
      highlights: city.highlights || [],
      localities: city.localities || [],
      gallery: city.gallery || [],
      isFeatured: Boolean(city.isFeatured),
      projectCount: liveCount,
      status: city.status,
      seo: city.seo || {},
      createdAt: city.createdAt,
      updatedAt: city.updatedAt,
    };
  });

  // Sort
  if (sort === 'name_asc') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'name_desc') {
    result.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'projects_desc') {
    result.sort((a, b) => b.projectCount - a.projectCount);
  } else {
    // Featured first, then highest project count
    result.sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1;
      return b.projectCount - a.projectCount;
    });
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
 * Public: Get published city details by slug
 * GET /api/v1/cities/:slug
 */
export const getPublicCityBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const cleanSlug = (slug || '').toLowerCase().trim();

  // Find published city by slug or case-insensitive name
  const city = await City.findOne({
    status: 'published',
    $or: [
      { slug: cleanSlug },
      { name: new RegExp(`^${cleanSlug.replace(/-/g, ' ')}$`, 'i') },
      { name: new RegExp(`^${cleanSlug}$`, 'i') },
    ],
  }).lean();

  if (!city) {
    return next(new AppError('City not found or is not currently published', 404));
  }

  // Count published projects
  const escapedName = city.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const publishedProjectsCount = await Project.countDocuments({
    status: 'published',
    city: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  });

  res.status(200).json({
    success: true,
    data: {
      ...city,
      coverImage: city.image || city.coverImage,
      projectCount: publishedProjectsCount,
      publishedProjectsCount,
    },
  });
});

/**
 * Public: Get published projects belonging to a city
 * GET /api/v1/cities/:slug/projects
 */
export const getPublicCityProjects = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const { page = 1, limit = 12, sort = 'newest', propertyType, category } = req.query;
  const cleanSlug = (slug || '').toLowerCase().trim();

  const city = await City.findOne({
    status: 'published',
    $or: [
      { slug: cleanSlug },
      { name: new RegExp(`^${cleanSlug.replace(/-/g, ' ')}$`, 'i') },
      { name: new RegExp(`^${cleanSlug}$`, 'i') },
    ],
  }).lean();

  if (!city) {
    return next(new AppError('City not found or is not currently published', 404));
  }

  const escapedName = city.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const projectQuery = {
    status: 'published',
    city: { $regex: new RegExp(`^${escapedName}$`, 'i') },
  };

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
    city: {
      id: city.slug,
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
