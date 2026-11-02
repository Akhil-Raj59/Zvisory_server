import Project from '../models/project.model.js';
import ProjectDetail from '../models/projectDetail.model.js';
import City from '../models/city.model.js';
import Developer from '../models/developer.model.js';
import asyncHandler from '../middleware/asyncHandler.middleware.js';
import AppError from '../utils/appError.js';
import {
  generateExcelTemplate,
  deleteTempFile,
  REQUIRED_COLUMNS,
} from '../utils/excelImport.utils.js';

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const MAX_ROWS = 500;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const isInvalid = (val) => {
  if (val === null || val === undefined || val === false) return true;
  const c = String(val).trim().toUpperCase();
  return c === '' || c === 'NULL' || c === 'NONE' || c === 'NO DATA' || c === 'NA' || c === 'N/A' || c === 'URL';
};

/**
 * Return cleaned string, OR the fallback `def` when the value is invalid.
 * For updates: pass `existingValue` as `def` so blank cells preserve DB data.
 */
const clean = (val, def = '') => (isInvalid(val) ? def : String(val).trim());

const splitSemi = (val) => {
  if (isInvalid(val)) return [];
  return String(val).split(';').map((s) => s.trim()).filter((s) => !isInvalid(s));
};

/**
 * Like splitSemi but returns null when the cell is blank/invalid.
 * Used during updates: null means "preserve existing", [] means "set empty array".
 */
const splitSemiOrNull = (val) => {
  if (isInvalid(val)) return null;
  const parts = String(val).split(';').map((s) => s.trim()).filter((s) => !isInvalid(s));
  return parts.length > 0 ? parts : null;
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

// ──────────────────────────────────────────────────────────────
// Template download
// ──────────────────────────────────────────────────────────────
/**
 * Admin: Download Excel import template
 * GET /api/v1/admin/projects/import/template
 */
export const adminDownloadImportTemplate = asyncHandler(async (_req, res, next) => {
  try {
    const buffer = await generateExcelTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="zvisory-project-import-template.xlsx"');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    return next(new AppError(`Failed to generate template: ${err.message}`, 500));
  }
});

// ──────────────────────────────────────────────────────────────
// Shared data builder  (used by both create and update paths)
// ──────────────────────────────────────────────────────────────
/**
 * Builds Project and ProjectDetail field objects from a raw Excel row.
 *
 * For UPDATE mode: existing<X> values are used as defaults so blank cells
 * preserve the current database value instead of overwriting with empty strings.
 *
 * @param {object} raw          - Raw Excel row
 * @param {string} title        - Validated project title
 * @param {string} developer    - Canonical developer name
 * @param {string} city         - Canonical city name
 * @param {string} slug         - Derived slug
 * @param {object|null} existing - Existing Project lean doc (null for CREATE)
 * @param {object|null} existingDetail - Existing ProjectDetail lean doc (null for CREATE)
 */
function buildProjectPayload(raw, title, developer, city, slug, existing, existingDetail) {
  const ex = existing || {};
  const exd = existingDetail || {};

  // ── Project fields ─────────────────────────────────────────────
  const microMarket = !isInvalid(raw.micro_market)
    ? clean(raw.micro_market)
    : (ex.microMarket || '');

  const location = microMarket ? `${microMarket}, ${city}` : city;

  const startingPriceRaw = !isInvalid(raw.startingPrice)
    ? raw.startingPrice
    : (!isInvalid(raw.banner_info_section_value) ? raw.banner_info_section_value.split(';')[1] : null);

  const startingPrice = !isInvalid(startingPriceRaw)
    ? clean(startingPriceRaw)
    : (ex.startingPrice || 'Price On Request');

  const priceNumeric = !isInvalid(startingPriceRaw)
    ? parsePrice(startingPrice)
    : (ex.priceNumeric ?? null);

  const unitTypeRaw = !isInvalid(raw.unitType)
    ? raw.unitType
    : (!isInvalid(raw.banner_info_section_value) ? raw.banner_info_section_value.split(';')[0] : null);

  const unitConfigurations = !isInvalid(unitTypeRaw)
    ? String(unitTypeRaw).split(',').map((s) => s.trim()).filter(Boolean)
    : (ex.unitConfigurations || []);

  const categoriesFromRow = splitSemiOrNull(raw.categories);
  const categories = categoriesFromRow !== null
    ? (categoriesFromRow.length > 0 ? categoriesFromRow : ['Luxury'])
    : (ex.categories?.length > 0 ? ex.categories : ['Luxury']);

  const bannerUrl = !isInvalid(raw.banner_url)
    ? clean(raw.banner_url)
    : (ex.bannerUrl || ex.cardBanner || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80');

  const overviewDesc = !isInvalid(raw.overview_section_description)
    ? clean(raw.overview_section_description)
    : (exd.overview?.description || `${title} offers world-class living spaces designed for comfort, luxury, and serenity.`);

  const seoTitleDefault = `${title} | Zvisory`;
  const seo = {
    title: !isInvalid(raw.metadata_og_title) ? clean(raw.metadata_og_title) : (ex.seo?.title || seoTitleDefault),
    description: !isInvalid(raw.metadata_og_description) ? clean(raw.metadata_og_description) : (ex.seo?.description || overviewDesc.slice(0, 160)),
    ogTitle: !isInvalid(raw.metadata_og_title) ? clean(raw.metadata_og_title) : (ex.seo?.ogTitle || seoTitleDefault),
    ogDescription: !isInvalid(raw.metadata_og_description) ? clean(raw.metadata_og_description) : (ex.seo?.ogDescription || overviewDesc.slice(0, 160)),
    ogImage: !isInvalid(raw.metadata_og_image) ? clean(raw.metadata_og_image) : (ex.seo?.ogImage || bannerUrl),
  };

  const gtag = {
    gtagId: !isInvalid(raw.gtag_id) ? clean(raw.gtag_id) : (ex.gtag?.gtagId || ''),
    gtagSendTo: !isInvalid(raw.gtag_send_to) ? clean(raw.gtag_send_to) : (ex.gtag?.gtagSendTo || ''),
  };

  const keywordsFromRow = splitSemiOrNull(raw.keywords);
  const keywords = keywordsFromRow !== null ? keywordsFromRow : (ex.keywords || []);

  const secondaryKeywordsFromRow = splitSemiOrNull(raw.keywords_1);
  const secondaryKeywords = secondaryKeywordsFromRow !== null ? secondaryKeywordsFromRow : (ex.secondaryKeywords || []);

  const projectFields = {
    title,
    developer,
    city,
    microMarket,
    location,
    categories,
    propertyType: !isInvalid(raw.propertyType) ? clean(raw.propertyType) : (ex.propertyType || 'Apartments'),
    startingPrice,
    priceNumeric,
    unitConfigurations,
    unitSizes: !isInvalid(raw.unit_sizes) ? clean(raw.unit_sizes) : (ex.unitSizes || ''),
    landArea: !isInvalid(raw.land_area) ? clean(raw.land_area) : (ex.landArea || ''),
    totalUnits: !isInvalid(raw.total_units) ? clean(raw.total_units) : (ex.totalUnits || ''),
    paymentPlan: !isInvalid(raw.paymentPlan) ? clean(raw.paymentPlan) : (ex.paymentPlan || 'Construction Linked Plan'),
    reraNumber: !isInvalid(raw.rera_number) ? clean(raw.rera_number) : (ex.reraNumber || ''),
    cardBanner: bannerUrl,
    bannerUrl,
    shortDescription: overviewDesc.slice(0, 190),
    keywords,
    secondaryKeywords,
    seo,
    gtag,
  };

  // ── ProjectDetail fields ────────────────────────────────────────
  const specTitles = splitSemi(raw.detail_section_title);
  const specValues = splitSemi(raw.detail_section_value);
  const detailSpecsFromRow = [];
  specTitles.forEach((t, i) => {
    const v = specValues[i] || '';
    if (t && v) detailSpecsFromRow.push({ label: t, value: v });
  });
  const detailSpecs = detailSpecsFromRow.length > 0 ? detailSpecsFromRow : (exd.detailSpecs || []);

  const detailSpecsImage = !isInvalid(raw.detail_section_image)
    ? clean(raw.detail_section_image)
    : (exd.detailSpecsImage || '');

  const bannerStatLabelsFromRow = splitSemiOrNull(raw.banner_info_section_name);
  const bannerStatLabels = bannerStatLabelsFromRow !== null
    ? bannerStatLabelsFromRow
    : (exd.bannerStatLabels || ['Unit Typology', 'Starting Price', 'Unit Size', 'Location']);

  const amenityTitles = splitSemi(raw.amenities_detail_section_title);
  const amenityImg = clean(raw.amenities_detail_section_image);
  const amenityItemsFromRow = amenityTitles.map((n) => ({ name: n, image: amenityImg, description: '' }));
  const amenityItems = amenityItemsFromRow.length > 0 ? amenityItemsFromRow : (exd.amenities?.items || []);

  const planNames = splitSemi(raw.plan_section_details_plan_name);
  const planValues = splitSemi(raw.plan_section_details_plan_value);
  const planPrices = splitSemi(raw.plan_section_details_plan_base_price);
  const plansFromRow = planNames.map((n, i) => ({
    name: n,
    value: planValues[i] || '',
    basePrice: planPrices[i] || '',
    image: '',
  }));
  const plans = plansFromRow.length > 0 ? plansFromRow : (exd.floorPlans?.plans || []);

  const galleryImagesFromRow = splitSemiOrNull(raw.gallery_section_images_url);
  const galleryImages = galleryImagesFromRow !== null
    ? (galleryImagesFromRow.length > 0 ? galleryImagesFromRow : [bannerUrl])
    : (exd.gallery?.images?.length > 0 ? exd.gallery.images : [bannerUrl]);

  const overviewImagesFromRow = splitSemiOrNull(raw.overview_images_section_url);
  const overviewImages = overviewImagesFromRow !== null
    ? (overviewImagesFromRow.length > 0 ? overviewImagesFromRow : [bannerUrl])
    : (exd.overview?.images?.length > 0 ? exd.overview.images : [bannerUrl]);

  const advListsRaw = !isInvalid(raw.advantage_section_lists) ? clean(raw.advantage_section_lists) : null;
  let advCategories;
  if (advListsRaw) {
    advCategories = [];
    advListsRaw.split('|').forEach((block) => {
      const parts = block.split(';').map((s) => s.trim()).filter((s) => !isInvalid(s));
      if (parts.length > 0) {
        advCategories.push({ category: parts[0], items: parts.slice(1) });
      }
    });
  } else {
    advCategories = exd.locationAdvantages?.categories || [];
  }

  const infoSectionsFromRow = [];
  [
    { img: raw.info_section1_image, h: raw.info_section1_heading, t: raw.info_section1_title, v: raw.info_section1_description_varaint, d: raw.info_section1_description },
    { img: raw.info_section2_image, h: raw.info_section2_heading, t: raw.info_section2_title, v: raw.info_section2_description_varaint, d: raw.info_section2_description },
    { img: raw.info_section3_image, h: raw.info_section3_heading, t: raw.info_section3_title, v: raw.info_section3_description_varaint, d: raw.info_section3_description },
  ].forEach((sec, i) => {
    if (!isInvalid(sec.d) || !isInvalid(sec.t)) {
      infoSectionsFromRow.push({
        heading: clean(sec.h, `Highlight ${i + 1}`),
        title: clean(sec.t),
        description: clean(sec.d),
        image: clean(sec.img),
        variant: clean(sec.v, 'para'),
      });
    }
  });
  const infoSections = infoSectionsFromRow.length > 0 ? infoSectionsFromRow : (exd.infoSections || []);

  const offersFromRow = [];
  if (!isInvalid(raw.offer_section_1)) offersFromRow.push(String(raw.offer_section_1).trim());
  if (!isInvalid(raw.offer_section_2)) offersFromRow.push(String(raw.offer_section_2).trim());
  const offers = offersFromRow.length > 0 ? offersFromRow : (exd.offers || []);

  const docsRaw = !isInvalid(raw.documents) ? clean(raw.documents) : null;
  let documents;
  if (docsRaw) {
    documents = [];
    docsRaw.split('|').forEach((b) => {
      const parts = b.split(';').map((s) => s.trim());
      if (parts.length >= 1 && parts[0]) {
        documents.push({ url: parts[0], name: parts[1] || 'Project Brochure', type: parts[2] || 'PDF' });
      }
    });
  } else {
    documents = exd.documents || [];
  }

  const faqQuestions = splitSemi(raw.faq_section_questions);
  const faqAnswers = splitSemi(raw.faq_section_answers);
  const faqsFromRow = [];
  faqQuestions.forEach((q, i) => {
    if (q && faqAnswers[i]) faqsFromRow.push({ question: q, answer: faqAnswers[i] });
  });
  const faqs = faqsFromRow.length > 0 ? faqsFromRow : (exd.faqs || []);

  const contact = {
    heading: !isInvalid(raw.contact_section_heading) ? clean(raw.contact_section_heading) : (exd.contact?.heading || 'Contact Us'),
    title: !isInvalid(raw.contact_section_title) ? clean(raw.contact_section_title) : (exd.contact?.title || 'Schedule a Visit'),
    locationMapUrl: !isInvalid(raw.contact_section_location) ? clean(raw.contact_section_location) : (exd.contact?.locationMapUrl || ''),
    phone: exd.contact?.phone || '+91 99999 99999',
    email: exd.contact?.email || 'contactus@zvisory.com',
  };

  const detailFields = {
    detailSpecs,
    detailSpecsImage,
    bannerStatLabels,
    overview: {
      heading: !isInvalid(raw.overview_section_heading) ? clean(raw.overview_section_heading) : (exd.overview?.heading || 'Project Overview'),
      title: !isInvalid(raw.overview_section_title) ? clean(raw.overview_section_title) : (exd.overview?.title || title),
      description: overviewDesc,
      images: overviewImages,
    },
    amenities: {
      heading: !isInvalid(raw.amenities_section_heading) ? clean(raw.amenities_section_heading) : (exd.amenities?.heading || 'Amenities'),
      title: !isInvalid(raw.amenities_section_title) ? clean(raw.amenities_section_title) : (exd.amenities?.title || 'Designed to meet the highest criteria'),
      items: amenityItems,
    },
    floorPlans: {
      heading: !isInvalid(raw.plan_section_heading) ? clean(raw.plan_section_heading) : (exd.floorPlans?.heading || 'Floor Plans'),
      title: !isInvalid(raw.plan_section_title) ? clean(raw.plan_section_title) : (exd.floorPlans?.title || 'Sophisticated and Spacious'),
      plans,
    },
    gallery: {
      heading: !isInvalid(raw.gallery_section_heading) ? clean(raw.gallery_section_heading) : (exd.gallery?.heading || 'Gallery'),
      title: !isInvalid(raw.gallery_section_title) ? clean(raw.gallery_section_title) : (exd.gallery?.title || 'Photos & Media'),
      description: !isInvalid(raw.gallery_section_description) ? clean(raw.gallery_section_description) : (exd.gallery?.description || ''),
      images: galleryImages,
    },
    locationAdvantages: {
      heading: !isInvalid(raw.advantage_section_heading) ? clean(raw.advantage_section_heading) : (exd.locationAdvantages?.heading || 'Location Advantage'),
      title: !isInvalid(raw.advantage_section_title) ? clean(raw.advantage_section_title) : (exd.locationAdvantages?.title || 'Sophisticated and Spacious'),
      categories: advCategories,
    },
    infoSections,
    offers,
    documents,
    faqs,
    contact,
  };

  return { projectFields, detailFields, bannerUrl };
}

// ──────────────────────────────────────────────────────────────
// Bulk import processing
// ──────────────────────────────────────────────────────────────
/**
 * Admin: Process uploaded Excel file — create or update projects by slug.
 * POST /api/v1/admin/projects/import
 *
 * Behaviour:
 *  - Slug not in DB  → CREATE new project + ProjectDetail
 *  - Slug in DB      → UPDATE existing project + ProjectDetail (blank cells preserve existing values)
 *  - Same slug twice in one file → skip the second occurrence and report the conflict row
 *  - Invalid city/developer → row-level failure, nothing written
 */
export const adminBulkImportProjects = asyncHandler(async (req, res, next) => {
  const tempFilePath = req.file?.path;
  const startTime = Date.now();

  try {
    if (!req.file) {
      return next(new AppError('No Excel file provided. Please upload a .xlsx or .xls file.', 400));
    }

    // ── 1. Parse workbook ─────────────────────────────────────
    let XLSX;
    try {
      XLSX = (await import('xlsx')).default;
    } catch {
      return next(new AppError('Excel processing library not available. Contact support.', 500));
    }

    let workbook;
    try {
      workbook = XLSX.readFile(tempFilePath, { type: 'file', cellDates: true });
    } catch {
      return next(new AppError('Could not read the uploaded file. The file may be corrupted or not a valid Excel file.', 400));
    }

    // ── 2. Locate the "Projects" sheet ────────────────────────
    const sheetName =
      workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'projects') ||
      workbook.SheetNames[0];

    if (!sheetName) {
      return next(new AppError('Excel workbook has no sheets. Upload a valid file.', 400));
    }

    const ws = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    // ── 3. Header validation ───────────────────────────────────
    if (rawRows.length === 0) {
      return next(new AppError('The Excel file is empty or has no data rows.', 400));
    }

    const actualHeaders = Object.keys(rawRows[0]);
    const missingRequired = REQUIRED_COLUMNS.filter((h) => !actualHeaders.includes(h));
    if (missingRequired.length > 0) {
      return next(
        new AppError(
          `Missing required column(s): ${missingRequired.join(', ')}. Download the official template and ensure all required headers are present.`,
          400
        )
      );
    }

    // ── 4. Filter out template metadata rows ──────────────────
    const dataRows = rawRows.filter((row) => {
      const title = clean(row.project_title);
      return title && !['required', 'optional', 'description', 'example'].includes(title.toLowerCase());
    });

    if (dataRows.length === 0) {
      return next(new AppError('No valid data rows found. Remove template instruction rows and ensure at least one project row is present.', 400));
    }

    if (dataRows.length > MAX_ROWS) {
      return next(
        new AppError(
          `File contains ${dataRows.length} rows, which exceeds the limit of ${MAX_ROWS} rows per upload. Split your file and upload in batches.`,
          400
        )
      );
    }

    // ── 5. Pre-load master data ────────────────────────────────
    const allCities = await City.find({}).select('name slug').lean();
    const allDevelopers = await Developer.find({}).select('name slug').lean();
    const allCityMapByName = new Map(allCities.map((c) => [c.name.toLowerCase().trim(), c]));
    const allDeveloperMapByName = new Map(allDevelopers.map((d) => [d.name.toLowerCase().trim(), d]));

    // ── 6. Pre-load existing projects keyed by slug ────────────
    const existingProjects = await Project.find({}).select('_id slug').lean();
    const existingSlugToId = new Map(existingProjects.map((p) => [p.slug, p._id.toString()]));

    // ── 7. Process rows ────────────────────────────────────────
    const results = {
      totalRows: dataRows.length,
      created: 0,   // new projects inserted
      updated: 0,   // existing projects updated
      failed: 0,
      skipped: 0,
      batchDuplicates: 0,  // same slug appearing multiple times in this file
      errors: [],
    };

    // Track slugs seen within this upload to catch within-batch duplicates
    // Map: slug → first excelRow that processed it (for error messages)
    const batchSlugsSeen = new Map();

    for (let idx = 0; idx < dataRows.length; idx++) {
      const raw = dataRows[idx];
      const excelRow = idx + 2; // header row = 1, data starts at 2

      try {
        // ── 7a. Required field checks ──────────────────────────
        const title = clean(raw.project_title);
        if (!title) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: '—',
            slug: '',
            action: 'none',
            field: 'project_title',
            error: 'Project title is required and cannot be empty.',
            suggestion: 'Add a project title in the project_title column.',
          });
          continue;
        }

        const rawDeveloper = clean(raw.developer);
        if (!rawDeveloper) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: title,
            slug: '',
            action: 'none',
            field: 'developer',
            error: 'Developer is required.',
            suggestion: 'Enter a developer name registered in the system.',
          });
          continue;
        }

        const rawLocations = clean(raw.locations);
        if (!rawLocations) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: title,
            slug: '',
            action: 'none',
            field: 'locations',
            error: 'City (locations) is required.',
            suggestion: 'Enter a valid city name such as "Gurugram", "Noida", or "Delhi".',
          });
          continue;
        }

        // ── 7b. Developer validation ───────────────────────────
        const developerKey = rawDeveloper.toLowerCase().trim();
        const developerRecord = allDeveloperMapByName.get(developerKey);
        if (!developerRecord) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: title,
            slug: '',
            action: 'none',
            field: 'developer',
            error: `Developer "${rawDeveloper}" is not registered in the system.`,
            suggestion: `Create the developer "${rawDeveloper}" in Developer Management first, then re-upload.`,
          });
          continue;
        }
        const developer = developerRecord.name; // canonical name

        // ── 7c. City validation ────────────────────────────────
        const cityNameRaw = rawLocations.split(';')[0].trim();
        const cityKey = cityNameRaw.toLowerCase().trim();
        let cityRecord = allCityMapByName.get(cityKey);
        let city;

        if (cityRecord) {
          city = cityRecord.name;
        } else {
          const aliasMap = {
            gurgaon: 'Gurugram', bangalore: 'Bengaluru', madras: 'Chennai',
            bombay: 'Mumbai', 'new delhi': 'Delhi', calcutta: 'Kolkata',
          };
          const alias = aliasMap[cityKey];
          if (alias && allCityMapByName.get(alias.toLowerCase())) {
            city = allCityMapByName.get(alias.toLowerCase()).name;
          } else {
            results.failed++;
            results.errors.push({
              row: excelRow,
              project: title,
              slug: '',
              action: 'none',
              field: 'locations',
              error: `City "${cityNameRaw}" is not registered in the system.`,
              suggestion: `Create city "${cityNameRaw}" in City Management first, then re-upload.`,
            });
            continue;
          }
        }

        // ── 7d. Slug derivation ────────────────────────────────
        let slug = '';
        if (!isInvalid(raw.keywords)) {
          slug = slugify(clean(raw.keywords).split(';')[0]);
        }
        if (!slug) slug = slugify(title);
        if (!slug) slug = `project-${idx + 1}`;

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: title,
            slug,
            action: 'none',
            field: 'keywords',
            error: `Generated slug "${slug}" is invalid. Slugs must be lowercase letters and hyphens only.`,
            suggestion: 'Provide a valid slug in the keywords column (e.g. "my-project-name").',
          });
          continue;
        }

        // ── 7e. Within-batch duplicate check ───────────────────
        // Same slug appearing twice in this file: skip the second occurrence
        if (batchSlugsSeen.has(slug)) {
          const firstRow = batchSlugsSeen.get(slug);
          results.batchDuplicates++;
          results.skipped++;
          results.errors.push({
            row: excelRow,
            project: title,
            slug,
            action: 'skipped',
            field: 'keywords (slug)',
            error: `Slug "${slug}" appears more than once in this file. First processed at row ${firstRow}.`,
            suggestion: 'Remove the duplicate row or give the project a unique slug.',
          });
          continue;
        }
        batchSlugsSeen.set(slug, excelRow);

        // ── 7f. Determine CREATE vs UPDATE ─────────────────────
        const isUpdate = existingSlugToId.has(slug);

        // Load existing documents only when updating (lazy fetch with populated detail)
        let existingProject = null;
        let existingDetail = null;

        if (isUpdate) {
          const projectId = existingSlugToId.get(slug);
          [existingProject, existingDetail] = await Promise.all([
            Project.findById(projectId).lean(),
            ProjectDetail.findOne({ projectId }).lean(),
          ]);
        }

        // ── 7g. Build payload (create) or delta (update) ───────
        const { projectFields, detailFields } = buildProjectPayload(
          raw, title, developer, city, slug,
          existingProject, existingDetail
        );

        // ── 7h. Database write ─────────────────────────────────
        if (!isUpdate) {
          // ─── CREATE ──────────────────────────────────────────
          const project = await Project.create({
            ...projectFields,
            slug,
            status: 'published',
            featured: false,
            publishedAt: new Date(),
          });

          try {
            await ProjectDetail.create({
              projectId: project._id,
              ...detailFields,
            });
          } catch (detailErr) {
            // Roll back project to avoid orphaned document
            await Project.findByIdAndDelete(project._id).catch(() => {});
            throw new Error(`Failed to save project details: ${detailErr.message}`);
          }

          // Track newly inserted slug so a later row with same slug hits batch-duplicate guard
          existingSlugToId.set(slug, project._id.toString());
          results.created++;
        } else {
          // ─── UPDATE ──────────────────────────────────────────
          // Protected fields that must never be overwritten via import
          const PROTECTED = ['_id', 'createdAt', 'slug', 'status', 'featured', 'publishedAt', 'launchStatus'];

          const projectUpdate = {};
          for (const [k, v] of Object.entries(projectFields)) {
            if (!PROTECTED.includes(k)) {
              projectUpdate[k] = v;
            }
          }

          const projectId = existingSlugToId.get(slug);

          // Perform both updates; if detail update fails, roll back project update
          const prevProject = existingProject;
          const prevDetail = existingDetail;

          const updatedProject = await Project.findByIdAndUpdate(
            projectId,
            { $set: { ...projectUpdate, updatedAt: new Date() } },
            { new: true, lean: true }
          );

          if (!updatedProject) {
            throw new Error(`Project with slug "${slug}" could not be found for update.`);
          }

          try {
            // Use findOneAndUpdate with upsert to handle rare case of missing detail doc
            await ProjectDetail.findOneAndUpdate(
              { projectId },
              { $set: detailFields },
              { upsert: true, new: true }
            );
          } catch (detailErr) {
            // Roll back project to previous state
            if (prevProject) {
              const rollbackFields = {};
              for (const k of Object.keys(projectUpdate)) {
                if (prevProject[k] !== undefined) rollbackFields[k] = prevProject[k];
              }
              await Project.findByIdAndUpdate(projectId, { $set: rollbackFields }).catch(() => {});
            }
            throw new Error(`Failed to update project details: ${detailErr.message}`);
          }

          results.updated++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: excelRow,
          project: clean(raw.project_title) || '—',
          slug: '',
          action: 'error',
          field: 'general',
          error: err.message?.replace(/^ValidationError:\s*/i, '') || 'Unknown processing error',
          suggestion: 'Check the row data and fix the reported issue before re-uploading.',
        });
      }
    }

    const processingMs = Date.now() - startTime;

    res.status(200).json({
      success: true,
      message: buildSummaryMessage(results),
      summary: {
        totalRows: results.totalRows,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
        skipped: results.skipped,
        batchDuplicates: results.batchDuplicates,
        processingMs,
      },
      errors: results.errors,
    });
  } finally {
    deleteTempFile(tempFilePath);
  }
});

function buildSummaryMessage(results) {
  const { totalRows, created, updated, failed, batchDuplicates } = results;
  const processed = created + updated;

  if (failed === 0 && batchDuplicates === 0) {
    if (updated === 0) return `All ${created} project(s) imported successfully.`;
    if (created === 0) return `All ${updated} project(s) updated successfully.`;
    return `Import complete: ${created} created, ${updated} updated (${processed} of ${totalRows} rows processed successfully).`;
  }

  if (processed === 0) {
    return `Import failed: 0 of ${totalRows} rows were processed. Review the error report below.`;
  }

  const parts = [];
  if (created > 0) parts.push(`${created} created`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (batchDuplicates > 0) parts.push(`${batchDuplicates} batch duplicate(s) skipped`);

  return `Partial import: ${parts.join(', ')}.`;
}
