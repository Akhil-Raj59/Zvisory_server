import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Project from '../models/project.model.js';
import ProjectDetail from '../models/projectDetail.model.js';
import City from '../models/city.model.js';
import Developer from '../models/developer.model.js';
import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import {
  createProjectSchema,
  updateProjectSchema,
  updateStatusSchema,
} from '../validations/project.validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Admin: Get paginated projects with status filtering (all, draft, published, archived)
 */
export const adminGetProjects = asyncHandler(async (req, res) => {
  const {
    status,
    search,
    city,
    developer,
    sort = 'newest',
    page = 1,
    limit = 10,
  } = req.query;

  const query = {};

  // Status filter for admin
  if (status && status !== 'all') {
    query.status = status;
  }

  // Search filter
  const searchTerm = (search || '').trim();
  if (searchTerm) {
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');
    query.$or = [
      { title: regex },
      { location: regex },
      { city: regex },
      { developer: regex },
      { slug: regex },
    ];
  }

  if (city && city !== 'All') {
    query.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
  }

  if (developer && developer !== 'All') {
    query.developer = { $regex: new RegExp(`^${developer.trim()}$`, 'i') };
  }

  const sortMap = {
    price_asc: { priceNumeric: 1 },
    price_desc: { priceNumeric: -1 },
    name_asc: { title: 1 },
    name_desc: { title: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    updated: { updatedAt: -1 },
  };
  const sortOption = sortMap[sort] || sortMap.newest;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [projects, total, countsByStatus] = await Promise.all([
    Project.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
    Project.countDocuments(query),
    Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const statusSummary = {
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  };
  countsByStatus.forEach((item) => {
    if (item._id && statusSummary[item._id] !== undefined) {
      statusSummary[item._id] = item.count;
      statusSummary.all += item.count;
    }
  });

  res.status(200).json({
    success: true,
    count: projects.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
    statusSummary,
    data: projects,
  });
});

/**
 * Admin: Get single project and full details by ID for editing
 */
export const adminGetProjectById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const project = await Project.findById(id).lean();
  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  const details = await ProjectDetail.findOne({ projectId: project._id }).lean();

  res.status(200).json({
    success: true,
    data: {
      ...project,
      details: details || {},
    },
  });
});

/**
 * Admin: Create project and its details
 */
export const adminCreateProject = asyncHandler(async (req, res, next) => {
  const validation = createProjectSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return next(new AppError(`Validation error: ${errorMsg}`, 400));
  }

  const { projectDetails, ...projectData } = validation.data;

  // Check unique slug
  const existing = await Project.findOne({ slug: projectData.slug });
  if (existing) {
    return next(new AppError(`A project with slug "${projectData.slug}" already exists`, 409));
  }

  const createdBy = req.user?._id || null;
  const project = await Project.create({
    ...projectData,
    createdBy,
    updatedBy: createdBy,
    publishedAt: projectData.status === 'published' ? new Date() : null,
  });

  let createdDetails = null;
  if (projectDetails) {
    createdDetails = await ProjectDetail.create({
      ...projectDetails,
      projectId: project._id,
    });
  }

  // Update or record city and developer masters
  if (project.city) {
    await City.findOneAndUpdate(
      { slug: project.city.toLowerCase().replace(/\s+/g, '-') },
      {
        $setOnInsert: {
          name: project.city,
          slug: project.city.toLowerCase().replace(/\s+/g, '-'),
        },
        $inc: { projectCount: 1 },
      },
      { upsert: true, new: true }
    );
  }

  if (project.developer) {
    await Developer.findOneAndUpdate(
      { slug: project.developer.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      {
        $setOnInsert: {
          name: project.developer,
          slug: project.developer.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        },
        $inc: { projectCount: 1 },
      },
      { upsert: true, new: true }
    );
  }

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: {
      ...project.toObject(),
      details: createdDetails ? createdDetails.toObject() : null,
    },
  });
});

/**
 * Admin: Update project and its details
 */
export const adminUpdateProject = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const validation = updateProjectSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return next(new AppError(`Validation error: ${errorMsg}`, 400));
  }

  const project = await Project.findById(id);
  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  const { projectDetails, ...projectData } = validation.data;

  // Slug uniqueness check if slug is being updated
  if (projectData.slug && projectData.slug !== project.slug) {
    const existing = await Project.findOne({ slug: projectData.slug, _id: { $ne: id } });
    if (existing) {
      return next(new AppError(`A project with slug "${projectData.slug}" already exists`, 409));
    }
  }

  // Update publishedAt timestamp if status changed to published
  if (projectData.status === 'published' && project.status !== 'published') {
    projectData.publishedAt = new Date();
  }

  const updatedBy = req.user?._id || null;
  const updatedProject = await Project.findByIdAndUpdate(
    id,
    { ...projectData, updatedBy },
    { new: true, runValidators: true }
  );

  let updatedDetails = null;
  if (projectDetails) {
    updatedDetails = await ProjectDetail.findOneAndUpdate(
      { projectId: id },
      { ...projectDetails, projectId: id },
      { upsert: true, new: true, runValidators: true }
    );
  } else {
    updatedDetails = await ProjectDetail.findOne({ projectId: id });
  }

  res.status(200).json({
    success: true,
    message: 'Project updated successfully',
    data: {
      ...updatedProject.toObject(),
      details: updatedDetails ? updatedDetails.toObject() : null,
    },
  });
});

/**
 * Admin: Update project publication status
 */
export const adminUpdateStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const validation = updateStatusSchema.safeParse(req.body);
  if (!validation.success) {
    return next(new AppError('Invalid status. Allowed values: draft, published, archived', 400));
  }

  const { status } = validation.data;
  const updateData = { status, updatedBy: req.user?._id || null };
  if (status === 'published') {
    updateData.publishedAt = new Date();
  }

  const project = await Project.findByIdAndUpdate(id, updateData, { new: true });
  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  res.status(200).json({
    success: true,
    message: `Project status updated to ${status}`,
    data: project,
  });
});

/**
 * Admin: Delete project and associated details safely
 */
export const adminDeleteProject = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const project = await Project.findById(id);
  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  // Safely delete associated ProjectDetail
  await ProjectDetail.deleteMany({ projectId: id });
  await Project.findByIdAndDelete(id);

  // Decrement counts in master models
  if (project.city) {
    await City.findOneAndUpdate(
      { slug: project.city.toLowerCase().replace(/\s+/g, '-') },
      { $inc: { projectCount: -1 } }
    );
  }
  if (project.developer) {
    await Developer.findOneAndUpdate(
      { slug: project.developer.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      { $inc: { projectCount: -1 } }
    );
  }

  res.status(200).json({
    success: true,
    message: `Project "${project.title}" deleted successfully`,
  });
});

/**
 * Admin: Upload media file (image or PDF) to Cloudinary
 */
export const adminUploadMedia = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file provided for upload', 400));
  }

  try {
    const isPdf = req.file.mimetype === 'application/pdf';
    const folder = isPdf ? 'zvisory/projects/documents' : 'zvisory/projects/images';

    const result = await uploadToCloudinary(req.file.path, folder);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: result.url,
        publicId: result.publicId,
        format: result.format,
        bytes: result.bytes,
        originalName: req.file.originalname,
      },
    });
  } catch (error) {
    return next(new AppError(`Upload failed: ${error.message}`, 500));
  }
});

/**
 * Admin: Validate an external media URL
 */
export const adminValidateMediaUrl = asyncHandler(async (req, res, next) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return next(new AppError('URL is required', 400));
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return next(new AppError('URL must use http or https protocol', 400));
    }

    res.status(200).json({
      success: true,
      message: 'URL is valid',
      data: { url: parsed.href },
    });
  } catch (err) {
    return next(new AppError('Invalid URL format', 400));
  }
});

/**
 * Admin: Reference data for form dropdowns & autocompletes
 */
export const adminGetReferenceData = asyncHandler(async (_req, res) => {
  const [projectCities, registeredCities, developers, categories, propertyTypes] = await Promise.all([
    Project.distinct('city'),
    City.find({}).select('_id name slug state country status isFeatured projectCount').sort({ name: 1 }).lean(),
    Project.distinct('developer'),
    Project.distinct('categories'),
    Project.distinct('propertyType'),
  ]);

  const allCityNames = Array.from(
    new Set([
      ...registeredCities.map((c) => c.name),
      ...projectCities.filter(Boolean),
    ])
  ).sort();

  res.status(200).json({
    success: true,
    data: {
      cities: allCityNames,
      registeredCities,
      developers: developers.filter(Boolean).sort(),
      categories: Array.from(new Set(categories.flat().filter(Boolean))).sort(),
      propertyTypes: propertyTypes.filter(Boolean).sort(),
      defaultPropertyTypes: ['Apartments', 'High Rise', 'Low Rise', 'Plots', 'Commercial', 'Villas', 'Penthouse'],
      defaultCategories: ['Luxury', 'Ultra Luxury', 'Affordable', 'Residential', 'Commercial', 'Mixed Use'],
      launchStatuses: ['Pre Launch', 'New Launch', 'Under Construction', 'Ready to Move-In (New)', 'Ready to Move-In (Resale)'],
    },
  });
});

/**
 * Admin: Idempotent Seeding of 81 Excel projects into MongoDB
 */
export const adminSeedExcelProjects = asyncHandler(async (req, res, next) => {
  // Locate excel_projects_raw.json in zvisory-web or root
  const pathsToTry = [
    path.join(__dirname, '../../zvisory-web/src/data/excel_projects_raw.json'),
    path.join(process.cwd(), 'zvisory-web/src/data/excel_projects_raw.json'),
    path.join(process.cwd(), '../zvisory-web/src/data/excel_projects_raw.json'),
  ];

  let rawData = null;
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      rawData = JSON.parse(fs.readFileSync(p, 'utf-8'));
      break;
    }
  }

  if (!rawData || !Array.isArray(rawData)) {
    return next(new AppError('excel_projects_raw.json could not be loaded for seeding', 500));
  }

  // Normalization logic
  const isInvalid = (val) => {
    if (!val) return true;
    const c = String(val).trim().toUpperCase();
    return c === '' || c === 'NULL' || c === 'NONE' || c === 'NO DATA' || c === 'NA' || c === 'N/A' || c === 'URL';
  };

  const clean = (val, def = '') => (isInvalid(val) ? def : String(val).trim());

  const splitSemi = (val) => {
    if (isInvalid(val)) return [];
    return String(val)
      .split(';')
      .map((s) => s.trim())
      .filter((s) => !isInvalid(s));
  };

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

  const parsePrice = (priceStr) => {
    if (isInvalid(priceStr)) return null;
    const str = String(priceStr).toLowerCase().replace(/,/g, '');
    const crMatch = str.match(/(?:₹|rs\.?)?\s*([\d.]+)\s*(?:cr|crore)/i);
    if (crMatch) return Math.round(parseFloat(crMatch[1]) * 10000000);
    const lacMatch = str.match(/(?:₹|rs\.?)?\s*([\d.]+)\s*(?:lac|lakh|lacs)/i);
    if (lacMatch) return Math.round(parseFloat(lacMatch[1]) * 100000);
    const numMatch = str.match(/[\d.]+/);
    if (numMatch) {
      const num = parseFloat(numMatch[0]);
      if (num > 0 && num < 1000) return Math.round(num * 10000000);
      return Math.round(num);
    }
    return null;
  };

  let insertedCount = 0;
  let updatedCount = 0;
  const errors = [];
  const cityWarnings = [];

  const existingMasterCities = await City.find({}).lean();
  const cityMapByName = new Map(existingMasterCities.map((c) => [c.name.toLowerCase().trim(), c]));

  for (let idx = 0; idx < rawData.length; idx++) {
    const raw = rawData[idx];
    try {
      const title = clean(raw.project_title, `Project ${idx + 1}`);

      // Derive slug
      let slug = '';
      if (!isInvalid(raw.keywords)) {
        slug = slugify(raw.keywords);
      } else {
        slug = slugify(title);
      }
      if (!slug) slug = `project-${idx + 1}`;

      const keywords = splitSemi(raw.keywords);
      const secondaryKeywords = splitSemi(raw.keywords_1);

      // Specs
      const specTitles = splitSemi(raw.detail_section_title);
      const specValues = splitSemi(raw.detail_section_value);
      const detailSpecs = [];

      let developer = clean(raw.developer);
      let landArea = clean(raw.land_area);
      let totalUnits = clean(raw.total_units);
      let elevation = '';
      let launchStatus = 'Under Construction';
      let possessionText = '';

      specTitles.forEach((t, i) => {
        const v = specValues[i] || '';
        if (t && v) {
          detailSpecs.push({ label: t, value: v });
          const lt = t.toLowerCase();
          if (!developer && lt.includes('developer')) developer = v;
          if (!landArea && (lt.includes('land') || lt.includes('area'))) landArea = v;
          if (!totalUnits && lt.includes('units')) totalUnits = v;
          if (!elevation && lt.includes('elevation')) elevation = v;
          if (lt.includes('status')) launchStatus = v;
          if (!possessionText && lt.includes('possession')) possessionText = v;
        }
      });

      if (!developer) developer = 'Zvisory Partner Developer';

      const locations = splitSemi(raw.locations);
      const rawCityStr = locations.length > 0 ? clean(locations[0]) : '';
      let city = 'Gurugram';

      if (rawCityStr) {
        const lowerRaw = rawCityStr.toLowerCase().trim();
        const matched = cityMapByName.get(lowerRaw);
        if (matched) {
          city = matched.name;
        } else {
          // Normalization alias mappings
          const aliasMap = {
            gurgaon: 'Gurugram',
            gurugram: 'Gurugram',
            bangalore: 'Bengaluru',
            bengaluru: 'Bengaluru',
            madras: 'Chennai',
            chennai: 'Chennai',
            hyderabad: 'Hyderabad',
            delhi: 'Delhi',
            'new delhi': 'Delhi',
            noida: 'Noida',
            mumbai: 'Mumbai',
          };
          if (aliasMap[lowerRaw]) {
            city = aliasMap[lowerRaw];
          } else {
            city = rawCityStr
              .split(' ')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
            cityWarnings.push({ row: idx + 2, project: title, rawValue: rawCityStr, normalizedCity: city });
          }
        }
      }

      const microMarket = clean(raw.micro_market, locations.join(', ') || city);
      const location = microMarket ? `${microMarket}, ${city}` : city;

      const startingPrice = clean(raw.startingPrice || raw.unnamed_col_10, 'Price On Request');
      const priceNumeric = parsePrice(startingPrice);

      const unitTypeStr = clean(raw.unitType || raw.banner_info_section_value || raw.unnamed_col_9);
      const unitConfigurations = unitTypeStr ? unitTypeStr.split(',').map((s) => s.trim()).filter(Boolean) : ['3 BHK', '4 BHK'];
      const unitSizes = clean(raw.unit_sizes || raw.unnamed_col_11, 'Custom Layouts');
      const propertyType = clean(raw.propertyType, 'Apartments');
      const paymentPlan = clean(raw.paymentPlan, 'Construction Linked Plan');
      const reraNumber = clean(raw.rera_number, 'RC/REP/HARERA/GGM/2024');

      const categories = splitSemi(raw.categories);
      if (categories.length === 0) categories.push('Luxury');

      const bannerUrl = clean(raw.banner_url) || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';
      const cardBanner = bannerUrl;

      const overviewDesc = clean(
        raw.overview_section_description,
        `${title} offers world-class living spaces designed for comfort, luxury, and serenity.`
      );

      // Amenities
      const amenityTitles = splitSemi(raw.amenities_detail_section_title);
      const amenityImg = clean(raw.amenities_detail_section_image);
      const amenityItems = amenityTitles.map((n) => ({
        name: n,
        image: amenityImg,
        description: '',
      }));

      // Floor plans
      const planNames = splitSemi(raw.plan_section_details_plan_name);
      const planValues = splitSemi(raw.plan_section_details_plan_value);
      const planPrices = splitSemi(raw.plan_section_details_plan_base_price);
      const plans = planNames.map((n, i) => ({
        name: n,
        value: planValues[i] || 'Spacious Layout',
        basePrice: planPrices[i] || '',
        image: '',
      }));

      // Gallery
      const galleryImages = splitSemi(raw.gallery_section_images_url);
      if (galleryImages.length === 0) galleryImages.push(bannerUrl);

      // Location Advantages
      const advCategories = [];
      const advListsRaw = clean(raw.advantage_section_lists);
      if (advListsRaw) {
        advListsRaw.split('|').forEach((block) => {
          const parts = block.split(';').map((s) => s.trim()).filter((s) => !isInvalid(s));
          if (parts.length > 0) {
            advCategories.push({
              category: parts[0],
              items: parts.slice(1),
            });
          }
        });
      }

      // Info sections
      const infoSections = [];
      [
        {
          img: raw.info_section1_image,
          h: raw.info_section1_heading,
          t: raw.info_section1_title,
          v: raw.info_section1_description_varaint,
          d: raw.info_section1_description,
        },
        {
          img: raw.info_section2_image,
          h: raw.info_section2_heading,
          t: raw.info_section2_title,
          v: raw.info_section2_description_varaint,
          d: raw.info_section2_description,
        },
        {
          img: raw.info_section3_image,
          h: raw.info_section3_heading,
          t: raw.info_section3_title,
          v: raw.info_section3_description_varaint,
          d: raw.info_section3_description,
        },
      ].forEach((sec, i) => {
        if (!isInvalid(sec.d) || !isInvalid(sec.t)) {
          infoSections.push({
            heading: clean(sec.h, `Highlight ${i + 1}`),
            title: clean(sec.t),
            description: clean(sec.d),
            image: clean(sec.img),
            variant: clean(sec.v, 'para'),
          });
        }
      });

      // Offers
      const offers = [];
      if (!isInvalid(raw.offer_section_1)) offers.push(String(raw.offer_section_1).trim());
      if (!isInvalid(raw.offer_section_2)) offers.push(String(raw.offer_section_2).trim());

      // Documents
      const documents = [];
      const docsRaw = clean(raw.documents);
      if (docsRaw) {
        docsRaw.split('|').forEach((b) => {
          const parts = b.split(';').map((s) => s.trim());
          if (parts.length >= 1 && parts[0]) {
            documents.push({
              url: parts[0],
              name: parts[1] || 'Project Brochure',
              type: parts[2] || 'PDF',
            });
          }
        });
      }

      // FAQs
      const faqQuestions = splitSemi(raw.faq_section_questions);
      const faqAnswers = splitSemi(raw.faq_section_answers);
      const faqs = [];
      faqQuestions.forEach((q, i) => {
        if (q && faqAnswers[i]) {
          faqs.push({ question: q, answer: faqAnswers[i] });
        }
      });

      // SEO
      const seo = {
        title: clean(raw.metadata_og_title, `${title} | Zvisory`),
        description: clean(raw.metadata_og_description, overviewDesc),
        ogTitle: clean(raw.metadata_og_title, `${title} | Zvisory`),
        ogDescription: clean(raw.metadata_og_description, overviewDesc),
        ogImage: clean(raw.metadata_og_image || bannerUrl),
      };

      const gtag = {
        gtagId: clean(raw.gtag_id),
        gtagSendTo: clean(raw.gtag_send_to),
      };

      const contact = {
        heading: clean(raw.contact_section_heading, 'Contact Us'),
        title: clean(raw.contact_section_title, 'Schedule a Visit'),
        locationMapUrl: clean(raw.contact_section_location),
        phone: '+91 99999 99999',
        email: 'contactus@zvisory.com',
      };

      const overviewImages = splitSemi(raw.overview_images_section_url);
      if (overviewImages.length === 0) overviewImages.push(bannerUrl);

      // Create or update Project
      const projectDoc = await Project.findOneAndUpdate(
        { slug },
        {
          title,
          slug,
          keywords,
          secondaryKeywords,
          developer,
          city,
          microMarket,
          location,
          categories,
          propertyType,
          startingPrice,
          priceNumeric,
          unitConfigurations,
          unitSizes,
          landArea,
          totalUnits,
          elevation,
          launchStatus,
          possessionText,
          paymentPlan,
          reraNumber,
          cardBanner,
          bannerUrl,
          shortDescription: overviewDesc.slice(0, 190),
          status: 'published',
          featured: idx < 6, // feature top 6 by default
          seo,
          gtag,
          publishedAt: new Date(),
        },
        { upsert: true, new: true, runValidators: true }
      );

      // Create or update ProjectDetail
      await ProjectDetail.findOneAndUpdate(
        { projectId: projectDoc._id },
        {
          projectId: projectDoc._id,
          detailSpecs,
          detailSpecsImage: clean(raw.detail_section_image),
          overview: {
            heading: clean(raw.overview_section_heading, 'Project Overview'),
            title: clean(raw.overview_section_title, title),
            description: overviewDesc,
            images: overviewImages,
          },
          amenities: {
            heading: clean(raw.amenities_section_heading, 'Amenities'),
            title: clean(raw.amenities_section_title, 'Designed to meet the highest criteria'),
            items: amenityItems,
          },
          floorPlans: {
            heading: clean(raw.plan_section_heading, 'Floor Plans'),
            title: clean(raw.plan_section_title, 'Sophisticated and Spacious'),
            plans,
          },
          gallery: {
            heading: clean(raw.gallery_section_heading, 'Gallery'),
            title: clean(raw.gallery_section_title, 'Photos & Media'),
            description: clean(raw.gallery_section_description),
            images: galleryImages,
          },
          locationAdvantages: {
            heading: clean(raw.advantage_section_heading, 'Location Advantage'),
            title: clean(raw.advantage_section_title, 'Sophisticated and Spacious'),
            categories: advCategories,
          },
          infoSections,
          offers,
          documents,
          faqs,
          contact,
        },
        { upsert: true, new: true, runValidators: true }
      );

      insertedCount++;
    } catch (err) {
      errors.push({ index: idx, title: raw.project_title, error: err.message });
    }
  }

  // Update master cities and developers
  const distinctCities = await Project.distinct('city');
  for (const c of distinctCities) {
    if (c) {
      const count = await Project.countDocuments({ city: c, status: 'published' });
      await City.findOneAndUpdate(
        { slug: c.toLowerCase().replace(/\s+/g, '-') },
        {
          $setOnInsert: {
            name: c,
            slug: c.toLowerCase().replace(/\s+/g, '-'),
            isFeatured: false,
          },
          $set: {
            projectCount: count,
          },
        },
        { upsert: true }
      );
    }
  }

  res.status(200).json({
    success: true,
    message: `Seeded ${insertedCount} projects into MongoDB (${errors.length} failed, ${cityWarnings.length} city warnings)`,
    insertedCount,
    updatedCount,
    totalProcessed: rawData.length,
    failedCount: errors.length,
    errors,
    cityWarnings,
  });
});

/**
 * Admin: Get real-time dashboard statistics from MongoDB
 */
export const adminGetStats = asyncHandler(async (_req, res) => {
  const [
    statusCounts,
    featuredCount,
    totalCitiesInDb,
    publishedCitiesInDb,
    distinctCitiesInProjects,
    developerCount,
    recentProjects,
    projectsByCity,
  ] = await Promise.all([
    Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Project.countDocuments({ featured: true }),
    City.countDocuments(),
    City.countDocuments({ status: 'published' }),
    Project.distinct('city').then((arr) => arr.filter(Boolean).length),
    Project.distinct('developer').then((arr) => arr.filter(Boolean).length),
    Project.find({})
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title slug status launchStatus updatedAt cardBanner city developer')
      .lean(),
    Project.aggregate([
      {
        $group: {
          _id: '$city',
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const statusMap = { published: 0, draft: 0, archived: 0 };
  let total = 0;
  statusCounts.forEach((item) => {
    if (item._id && statusMap[item._id] !== undefined) {
      statusMap[item._id] = item.count;
    }
    total += item.count;
  });

  res.status(200).json({
    success: true,
    data: {
      projects: {
        total,
        published: statusMap.published,
        draft: statusMap.draft,
        archived: statusMap.archived,
        featured: featuredCount,
      },
      cities: totalCitiesInDb, // Preserve scalar for backward compatibility
      cityStats: {
        total: totalCitiesInDb,
        published: publishedCitiesInDb,
        distinctInProjects: distinctCitiesInProjects,
      },
      projectsByCity,
      developers: developerCount,
      recentProjects,
    },
  });
});
