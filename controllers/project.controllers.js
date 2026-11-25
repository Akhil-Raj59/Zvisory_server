import Project from '../models/project.model.js';
import ProjectDetail from '../models/projectDetail.model.js';
import City from '../models/city.model.js';
import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';

/**
 * Public: Get published projects with multi-filter search, sorting, and pagination
 */
export const getProjects = asyncHandler(async (req, res) => {
  const {
    q,
    search,
    city,
    developer,
    category,
    propertyType,
    status: launchStatus,
    unitConfig,
    budget,
    minPrice,
    maxPrice,
    featured,
    sort = 'newest',
    page = 1,
    limit = 12,
  } = req.query;

  // Base query: ONLY published projects for public endpoints
  const query = { status: 'published' };

  // Search keyword (matches title, location, developer, city, microMarket, keywords)
  const searchTerm = (q || search || '').trim();
  if (searchTerm) {
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');
    query.$or = [
      { title: regex },
      { location: regex },
      { city: regex },
      { microMarket: regex },
      { developer: regex },
      { keywords: regex },
      { secondaryKeywords: regex },
      { categories: regex },
    ];
  }

  // City filter
  if (city && city !== 'All') {
    query.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
  }

  // Developer filter
  if (developer && developer !== 'All') {
    query.developer = { $regex: new RegExp(`^${developer.trim()}$`, 'i') };
  }

  // Category filter
  if (category && category !== 'All') {
    query.categories = { $elemMatch: { $regex: new RegExp(`^${category.trim()}$`, 'i') } };
  }

  // Property Type filter
  if (propertyType && propertyType !== 'All') {
    const pt = propertyType.trim();
    if (/high\s*rise/i.test(pt)) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { propertyType: /high\s*rise/i },
          { propertyType: /apartments/i },
          { elevation: /(G\s*\+\s*(1[0-9]|[2-9][0-9])|[2-9]B)/i },
        ],
      });
    } else if (/low\s*rise/i.test(pt)) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { propertyType: /low\s*rise/i },
          { elevation: /(G\s*\+\s*[1-4]\b|Floors)/i },
          { unitConfigurations: /Floors/i },
        ],
      });
    } else if (/plot/i.test(pt)) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { propertyType: /plot/i },
          { unitConfigurations: /plot/i },
        ],
      });
    } else if (/commercial/i.test(pt)) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { propertyType: /commercial/i },
          { categories: /commercial/i },
        ],
      });
    } else {
      query.propertyType = { $regex: new RegExp(`^${pt}$`, 'i') };
    }
  }

  // Launch Status filter
  if (launchStatus && launchStatus !== 'All') {
    const ls = launchStatus.trim();
    if (/ready/i.test(ls)) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { launchStatus: /ready/i },
          { possessionText: /ready/i },
          { launchStatus: /Dec 202[5-7]/i },
        ],
      });
    } else if (/new\s*launch/i.test(ls)) {
      query.launchStatus = { $regex: /new\s*launch/i };
    } else if (/pre.*launch/i.test(ls)) {
      query.launchStatus = { $regex: /pre.*launch/i };
    } else if (/under\s*construction/i.test(ls)) {
      query.launchStatus = { $regex: /under\s*construction/i };
    } else {
      query.launchStatus = { $regex: new RegExp(`^${ls}$`, 'i') };
    }
  }

  // Unit Configuration / BHK filter
  if (unitConfig && unitConfig !== 'All') {
    const uc = unitConfig.trim();
    if (/4\+|5/i.test(uc)) {
      query.unitConfigurations = { $elemMatch: { $regex: /(4\+|5|6|Sky Villas)/i } };
    } else {
      const numMatch = uc.match(/(\d+)/);
      if (numMatch) {
        const digit = numMatch[1];
        query.unitConfigurations = {
          $elemMatch: { $regex: new RegExp(`(^|\\b|&\\s*)${digit}(\\s*BHK|\\b|$)`, 'i') },
        };
      } else {
        query.unitConfigurations = { $elemMatch: { $regex: new RegExp(uc, 'i') } };
      }
    }
  }

  // Featured flag
  if (featured === 'true' || featured === true) {
    query.featured = true;
  }

  // Budget range parsing
  if (budget && budget !== 'All') {
    const normalizedBudget = budget.replace(/[\u2013\u2014]/g, '-').trim();
    switch (normalizedBudget) {
      case 'Under 1 Cr':
        query.priceNumeric = { $gt: 0, $lt: 10000000 };
        break;
      case '1 - 2 Cr':
      case '1 - 2 Cr':
        query.priceNumeric = { $gte: 10000000, $lte: 20000000 };
        break;
      case '2 - 3 Cr':
        query.priceNumeric = { $gte: 20000000, $lte: 30000000 };
        break;
      case '3 - 5 Cr':
        query.priceNumeric = { $gte: 30000000, $lte: 50000000 };
        break;
      case '5 Cr +':
      case '5 Cr+':
      case 'Above 5 Cr':
        query.priceNumeric = { $gte: 50000000 };
        break;
      case 'Under 1.5 Cr':
        query.priceNumeric = { $gt: 0, $lt: 15000000 };
        break;
      case '1.5 - 3 Cr':
        query.priceNumeric = { $gte: 15000000, $lte: 30000000 };
        break;
      default:
        break;
    }
  }

  // Custom numeric price range
  if (minPrice || maxPrice) {
    query.priceNumeric = query.priceNumeric || {};
    if (minPrice) query.priceNumeric.$gte = Number(minPrice);
    if (maxPrice) query.priceNumeric.$lte = Number(maxPrice);
  }

  // Sorting
  const sortMap = {
    price_asc: { priceNumeric: 1, createdAt: -1 },
    price_desc: { priceNumeric: -1, createdAt: -1 },
    name_asc: { title: 1 },
    name_desc: { title: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
  };
  const sortOption = sortMap[sort] || sortMap.newest;

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (pageNum - 1) * limitNum;

  const [projects, total] = await Promise.all([
    Project.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
    Project.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    count: projects.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
    data: projects,
  });
});

/**
 * Public: Get distinct filter options from real published database records
 */
export const getProjectFilters = asyncHandler(async (_req, res) => {
  const [cities, developers, propertyTypes, rawCategories, rawUnitConfigs, launchStatuses] =
    await Promise.all([
      Project.distinct('city', { status: 'published' }),
      Project.distinct('developer', { status: 'published' }),
      Project.distinct('propertyType', { status: 'published' }),
      Project.distinct('categories', { status: 'published' }),
      Project.distinct('unitConfigurations', { status: 'published' }),
      Project.distinct('launchStatus', { status: 'published' }),
    ]);

  // Clean and deduplicate arrays
  const categories = Array.from(new Set(rawCategories.flat().filter(Boolean))).sort();
  const unitConfigs = Array.from(new Set(rawUnitConfigs.flat().filter(Boolean))).sort();

  res.status(200).json({
    success: true,
    data: {
      cities: cities.filter(Boolean).sort(),
      developers: developers.filter(Boolean).sort(),
      propertyTypes: propertyTypes.filter(Boolean).sort(),
      categories,
      unitConfigs,
      launchStatuses: launchStatuses.filter(Boolean).sort(),
      budgetRanges: ['Under 1 Cr', '1 – 2 Cr', '2 – 3 Cr', '3 – 5 Cr', '5 Cr +'],
    },
  });
});

/**
 * Public: Get project by slug, joined with its full ProjectDetails
 */
export const getProjectBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const cleanSlug = slug.toLowerCase().trim();

  // Find published project by slug or primary keyword
  const project = await Project.findOne({
    status: 'published',
    $or: [{ slug: cleanSlug }, { keywords: cleanSlug }],
  }).lean();

  if (!project) {
    return next(new AppError('Project not found or is not currently published', 404));
  }

  // Fetch full details
  const details = await ProjectDetail.findOne({ projectId: project._id }).lean();

  res.status(200).json({
    success: true,
    data: {
      ...project,
      details: details || null,
    },
  });
});

/**
 * Public: Get featured projects for homepage
 */
export const getFeaturedProjects = asyncHandler(async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 6));

  let projects = await Project.find({ status: 'published', featured: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // If fewer than limit featured projects, fill with latest published projects
  if (projects.length < limit) {
    const additionalLimit = limit - projects.length;
    const existingIds = projects.map((p) => p._id);
    const additional = await Project.find({
      status: 'published',
      _id: { $nin: existingIds },
    })
      .sort({ createdAt: -1 })
      .limit(additionalLimit)
      .lean();

    projects = [...projects, ...additional];
  }

  res.status(200).json({
    success: true,
    count: projects.length,
    data: projects,
  });
});

/**
 * Public: Get similar projects recommendation
 */
export const getSimilarProjects = asyncHandler(async (req, res) => {
  const { id } = req.params; // slug or ID
  const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 3));

  const current = await Project.findOne({
    $or: [{ slug: id.toLowerCase().trim() }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
  }).lean();

  if (!current) {
    return res.status(200).json({ success: true, count: 0, data: [] });
  }

  // Match by same city or same category
  const similar = await Project.find({
    status: 'published',
    _id: { $ne: current._id },
    $or: [
      { city: current.city },
      { categories: { $in: current.categories } },
      { propertyType: current.propertyType },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    count: similar.length,
    data: similar,
  });
});

/**
 * Public: Get cities with published project counts
 */
export const getCities = asyncHandler(async (_req, res) => {
  const cityAggregation = await Project.aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: '$city', count: { $sum: 1 }, minPrice: { $min: '$priceNumeric' } } },
    { $sort: { count: -1 } },
  ]);

  const masterCities = await City.find().lean();
  const masterCityMap = new Map(masterCities.map((c) => [c.name.toLowerCase(), c]));

  const result = cityAggregation.map((agg) => {
    const master = masterCityMap.get(agg._id.toLowerCase()) || {};
    return {
      name: agg._id,
      slug: (agg._id || '').toLowerCase().replace(/\s+/g, '-'),
      count: agg.count,
      startingPrice: master.startingPrice || (agg.minPrice ? `₹${(agg.minPrice / 10000000).toFixed(2)} Cr*` : '₹1.5 Cr*'),
      image: master.image || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
    };
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});