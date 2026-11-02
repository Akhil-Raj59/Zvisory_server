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
  IMPORT_COLUMNS,
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

const clean = (val, def = '') => (isInvalid(val) ? def : String(val).trim());

const splitSemi = (val) => {
  if (isInvalid(val)) return [];
  return String(val).split(';').map((s) => s.trim()).filter((s) => !isInvalid(s));
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
// Bulk import processing
// ──────────────────────────────────────────────────────────────
/**
 * Admin: Process uploaded Excel file and import projects
 * POST /api/v1/admin/projects/import
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
    const sheetName = workbook.SheetNames.find(
      (n) => n.trim().toLowerCase() === 'projects'
    ) || workbook.SheetNames[0];

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

    // ── 4. Skip metadata rows (rows 2-3 from template) ────────
    // Detect if first rows are template metadata rows (required/optional markers)
    const dataRows = rawRows.filter((row) => {
      const title = clean(row.project_title);
      return title && !['required', 'optional', 'description', 'example'].includes(title.toLowerCase());
    });

    if (dataRows.length === 0) {
      return next(new AppError('No valid data rows found in the uploaded file. Remove template instruction rows and ensure at least one project row is present.', 400));
    }

    if (dataRows.length > MAX_ROWS) {
      return next(
        new AppError(
          `File contains ${dataRows.length} data rows, which exceeds the maximum allowed limit of ${MAX_ROWS} rows per upload. Split your file and upload in batches.`,
          400
        )
      );
    }

    // ── 5. Pre-load master data ────────────────────────────────
    const [existingCities, existingDevelopers] = await Promise.all([
      City.find({ status: 'published' }).select('name slug').lean(),
      Developer.find({ status: 'published' }).select('name slug').lean(),
    ]);

    const cityMapByName = new Map(existingCities.map((c) => [c.name.toLowerCase().trim(), c]));
    const developerMapByName = new Map(existingDevelopers.map((d) => [d.name.toLowerCase().trim(), d]));

    // Also load all (including draft/archived) for matching
    const allCities = await City.find({}).select('name slug').lean();
    const allDevelopers = await Developer.find({}).select('name slug').lean();
    const allCityMapByName = new Map(allCities.map((c) => [c.name.toLowerCase().trim(), c]));
    const allDeveloperMapByName = new Map(allDevelopers.map((d) => [d.name.toLowerCase().trim(), d]));

    // ── 6. Pre-validate all slugs for duplicate detection ─────
    const slugsInThisBatch = new Set();
    const existingSlugsInDb = new Set(
      (await Project.find({}).select('slug').lean()).map((p) => p.slug)
    );

    // ── 7. Process rows ────────────────────────────────────────
    const results = {
      totalRows: dataRows.length,
      imported: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
    };

    // Process in batches of 50
    const BATCH_SIZE = 50;

    for (let idx = 0; idx < dataRows.length; idx++) {
      const raw = dataRows[idx];
      // +2 because: header row (1) + 0-index shift (1) = Excel row is idx+2
      // Additionally account for template metadata rows
      const excelRow = idx + 2;

      try {
        // ── 7a. Required field checks ──────────────────────────
        const title = clean(raw.project_title);
        if (!title) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: '—',
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
            field: 'developer',
            error: 'Developer is required.',
            suggestion: 'Enter a developer name that is registered in the system.',
          });
          continue;
        }

        const rawLocations = clean(raw.locations);
        if (!rawLocations) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: title,
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
            field: 'developer',
            error: `Developer "${rawDeveloper}" is not registered in the system.`,
            suggestion: `First create the developer "${rawDeveloper}" in the Developer Management section, then re-upload.`,
          });
          continue;
        }
        const developer = developerRecord.name; // Use canonical name

        // ── 7c. City validation ────────────────────────────────
        const cityNameRaw = rawLocations.split(';')[0].trim();
        const cityKey = cityNameRaw.toLowerCase().trim();
        const cityRecord = allCityMapByName.get(cityKey);
        let city;

        if (cityRecord) {
          city = cityRecord.name; // Use canonical name
        } else {
          // Try alias normalization
          const aliasMap = {
            gurgaon: 'Gurugram',
            bangalore: 'Bengaluru',
            madras: 'Chennai',
            bombay: 'Mumbai',
            'new delhi': 'Delhi',
            calcutta: 'Kolkata',
          };
          const alias = aliasMap[cityKey];
          if (alias && allCityMapByName.get(alias.toLowerCase())) {
            city = allCityMapByName.get(alias.toLowerCase()).name;
          } else {
            results.failed++;
            results.errors.push({
              row: excelRow,
              project: title,
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

        // Validate slug format
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          results.failed++;
          results.errors.push({
            row: excelRow,
            project: title,
            field: 'keywords',
            error: `Generated slug "${slug}" is invalid. Slugs must be lowercase letters and hyphens only.`,
            suggestion: 'Provide a valid slug in the keywords column (e.g. "my-project-name").',
          });
          continue;
        }

        // ── 7e. Duplicate check ────────────────────────────────
        if (existingSlugsInDb.has(slug)) {
          results.duplicates++;
          results.skipped++;
          results.errors.push({
            row: excelRow,
            project: title,
            field: 'keywords (slug)',
            error: `A project with slug "${slug}" already exists in the database.`,
            suggestion: 'Change the project title or keywords to generate a different slug, or update the project manually.',
          });
          continue;
        }

        if (slugsInThisBatch.has(slug)) {
          results.duplicates++;
          results.skipped++;
          results.errors.push({
            row: excelRow,
            project: title,
            field: 'keywords (slug)',
            error: `Duplicate slug "${slug}" found within this upload file (row ${excelRow}).`,
            suggestion: 'Ensure each project has a unique title or keywords column.',
          });
          continue;
        }

        slugsInThisBatch.add(slug);

        // ── 7f. Build project data ─────────────────────────────
        const microMarket = clean(raw.micro_market, clean(raw.locations, city));
        const location = microMarket ? `${microMarket}, ${city}` : city;

        const startingPrice = clean(raw.startingPrice || raw.banner_info_section_value?.split(';')[1], 'Price On Request');
        const priceNumeric = parsePrice(startingPrice);

        const unitTypeStr = clean(raw.unitType || raw.banner_info_section_value?.split(';')[0]);
        const unitConfigurations = unitTypeStr
          ? unitTypeStr.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

        const categories = splitSemi(raw.categories);
        if (categories.length === 0) categories.push('Luxury');

        const bannerUrl = clean(raw.banner_url, 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80');

        const overviewDesc = clean(
          raw.overview_section_description,
          `${title} offers world-class living spaces designed for comfort, luxury, and serenity.`
        );

        const seo = {
          title: clean(raw.metadata_og_title, `${title} | Zvisory`),
          description: clean(raw.metadata_og_description, overviewDesc.slice(0, 160)),
          ogTitle: clean(raw.metadata_og_title, `${title} | Zvisory`),
          ogDescription: clean(raw.metadata_og_description, overviewDesc.slice(0, 160)),
          ogImage: clean(raw.metadata_og_image, bannerUrl),
        };

        const gtag = {
          gtagId: clean(raw.gtag_id),
          gtagSendTo: clean(raw.gtag_send_to),
        };

        const keywords = splitSemi(raw.keywords);
        const secondaryKeywords = splitSemi(raw.keywords_1);

        // ── 7g. Build ProjectDetail data ──────────────────────
        const specTitles = splitSemi(raw.detail_section_title);
        const specValues = splitSemi(raw.detail_section_value);
        const detailSpecs = [];
        specTitles.forEach((t, i) => {
          const v = specValues[i] || '';
          if (t && v) detailSpecs.push({ label: t, value: v });
        });

        const amenityTitles = splitSemi(raw.amenities_detail_section_title);
        const amenityImg = clean(raw.amenities_detail_section_image);
        const amenityItems = amenityTitles.map((n) => ({ name: n, image: amenityImg, description: '' }));

        const planNames = splitSemi(raw.plan_section_details_plan_name);
        const planValues = splitSemi(raw.plan_section_details_plan_value);
        const planPrices = splitSemi(raw.plan_section_details_plan_base_price);
        const plans = planNames.map((n, i) => ({
          name: n,
          value: planValues[i] || '',
          basePrice: planPrices[i] || '',
          image: '',
        }));

        const galleryImages = splitSemi(raw.gallery_section_images_url);
        if (galleryImages.length === 0) galleryImages.push(bannerUrl);

        const overviewImages = splitSemi(raw.overview_images_section_url);
        if (overviewImages.length === 0) overviewImages.push(bannerUrl);

        const advCategories = [];
        const advListsRaw = clean(raw.advantage_section_lists);
        if (advListsRaw) {
          advListsRaw.split('|').forEach((block) => {
            const parts = block.split(';').map((s) => s.trim()).filter((s) => !isInvalid(s));
            if (parts.length > 0) {
              advCategories.push({ category: parts[0], items: parts.slice(1) });
            }
          });
        }

        const infoSections = [];
        [
          { img: raw.info_section1_image, h: raw.info_section1_heading, t: raw.info_section1_title, v: raw.info_section1_description_varaint, d: raw.info_section1_description },
          { img: raw.info_section2_image, h: raw.info_section2_heading, t: raw.info_section2_title, v: raw.info_section2_description_varaint, d: raw.info_section2_description },
          { img: raw.info_section3_image, h: raw.info_section3_heading, t: raw.info_section3_title, v: raw.info_section3_description_varaint, d: raw.info_section3_description },
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

        const offers = [];
        if (!isInvalid(raw.offer_section_1)) offers.push(String(raw.offer_section_1).trim());
        if (!isInvalid(raw.offer_section_2)) offers.push(String(raw.offer_section_2).trim());

        const documents = [];
        const docsRaw = clean(raw.documents);
        if (docsRaw) {
          docsRaw.split('|').forEach((b) => {
            const parts = b.split(';').map((s) => s.trim());
            if (parts.length >= 1 && parts[0]) {
              documents.push({ url: parts[0], name: parts[1] || 'Project Brochure', type: parts[2] || 'PDF' });
            }
          });
        }

        const faqQuestions = splitSemi(raw.faq_section_questions);
        const faqAnswers = splitSemi(raw.faq_section_answers);
        const faqs = [];
        faqQuestions.forEach((q, i) => {
          if (q && faqAnswers[i]) faqs.push({ question: q, answer: faqAnswers[i] });
        });

        const contact = {
          heading: clean(raw.contact_section_heading, 'Contact Us'),
          title: clean(raw.contact_section_title, 'Schedule a Visit'),
          locationMapUrl: clean(raw.contact_section_location),
          phone: '+91 99999 99999',
          email: 'contactus@zvisory.com',
        };

        // ── 7h. Database write ─────────────────────────────────
        // Create Project document
        const project = await Project.create({
          title,
          slug,
          keywords,
          secondaryKeywords,
          developer,
          city,
          microMarket: clean(raw.micro_market),
          location,
          categories,
          propertyType: clean(raw.propertyType, 'Apartments'),
          startingPrice,
          priceNumeric,
          unitConfigurations,
          unitSizes: clean(raw.unit_sizes),
          landArea: clean(raw.land_area),
          totalUnits: clean(raw.total_units),
          paymentPlan: clean(raw.paymentPlan, 'Construction Linked Plan'),
          reraNumber: clean(raw.rera_number),
          cardBanner: bannerUrl,
          bannerUrl,
          shortDescription: overviewDesc.slice(0, 190),
          status: 'published',
          featured: false,
          seo,
          gtag,
          publishedAt: new Date(),
        });

        // Create ProjectDetail document (atomic — delete project if this fails)
        try {
          await ProjectDetail.create({
            projectId: project._id,
            detailSpecs,
            detailSpecsImage: clean(raw.detail_section_image),
            bannerStatLabels: splitSemi(raw.banner_info_section_name) || ['Unit Typology', 'Starting Price', 'Unit Size', 'Location'],
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
          });
        } catch (detailErr) {
          // Roll back: delete the project to avoid orphaned record
          await Project.findByIdAndDelete(project._id).catch(() => {});
          throw new Error(`Failed to save project details: ${detailErr.message}`);
        }

        // Mark slug as used
        existingSlugsInDb.add(slug);
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: excelRow,
          project: clean(raw.project_title) || '—',
          field: 'general',
          error: err.message?.replace(/^ValidationError:\s*/i, '') || 'Unknown processing error',
          suggestion: 'Check the row data and fix the reported issue before re-uploading.',
        });
      }
    }

    const processingMs = Date.now() - startTime;

    // Return detailed report
    res.status(200).json({
      success: true,
      message: buildSummaryMessage(results),
      summary: {
        totalRows: results.totalRows,
        imported: results.imported,
        failed: results.failed,
        skipped: results.skipped,
        duplicates: results.duplicates,
        processingMs,
      },
      errors: results.errors,
    });
  } finally {
    // Always clean up temp file
    deleteTempFile(tempFilePath);
  }
});

function buildSummaryMessage(results) {
  if (results.imported === results.totalRows) {
    return `All ${results.imported} project(s) imported successfully.`;
  }
  if (results.imported === 0) {
    return `Import failed: 0 of ${results.totalRows} rows were imported. Review the error report below.`;
  }
  return `Partial import: ${results.imported} of ${results.totalRows} rows imported. ${results.failed} failed, ${results.duplicates} duplicate(s) skipped.`;
}
