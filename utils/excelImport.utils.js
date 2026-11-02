import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Excel column headers used by the Zvisory project import format.
 * SINGLE SOURCE OF TRUTH — keep in sync with the Excel parser.
 */
export const IMPORT_COLUMNS = {
  // ─── Required ──────────────────────────────────────────────────────────
  project_title: { required: true, description: 'Project name / title', example: 'Conscient Hines Elevate' },
  developer: { required: true, description: 'Developer / builder name (must match a registered developer)', example: 'Conscient Hines' },
  locations: { required: true, description: 'City name (first semicolon-separated value is the city)', example: 'Gurugram' },
  // ─── Strongly Recommended ─────────────────────────────────────────────
  keywords: { required: false, description: 'URL slug OR semicolon-separated keywords. First value used as slug.', example: 'conscient-hines-elevate' },
  startingPrice: { required: false, description: 'Starting price string (e.g. ₹4.85 Cr*)', example: '₹4.85 Cr*' },
  unitType: { required: false, description: 'Unit configurations, comma-separated', example: '3, 4 BHK' },
  unit_sizes: { required: false, description: 'Unit size range', example: '2145 - 5947 sq. ft.' },
  categories: { required: false, description: 'Project categories, semicolon-separated', example: 'Luxury' },
  propertyType: { required: false, description: 'Property type', example: 'Apartments' },
  paymentPlan: { required: false, description: 'Payment plan description', example: 'Construction Linked Plan' },
  rera_number: { required: false, description: 'RERA registration number', example: 'RC/REP/HARERA/GGM/914/646/2025/17' },
  land_area: { required: false, description: 'Total land area', example: '7.75 Acres' },
  total_units: { required: false, description: 'Total number of units', example: '556' },
  micro_market: { required: false, description: 'Micro-market / sub-location', example: 'golf-course-road' },
  banner_url: { required: false, description: 'Main hero/banner image URL', example: 'https://...' },
  // ─── Detail Specs ──────────────────────────────────────────────────────
  detail_section_title: { required: false, description: 'Spec label names, semicolon-separated', example: 'Developer;Land Area;Total Units' },
  detail_section_value: { required: false, description: 'Spec values, semicolon-separated (same order as titles)', example: 'Conscient Hines;7.75 Acres;556' },
  detail_section_image: { required: false, description: 'Spec section image URL', example: 'https://...' },
  // ─── Overview ──────────────────────────────────────────────────────────
  overview_section_heading: { required: false, description: 'Overview section heading', example: 'Project Overview' },
  overview_section_title: { required: false, description: 'Overview section title', example: 'Project Overview' },
  overview_section_description: { required: false, description: 'Overview description text', example: 'A one of a kind project...' },
  overview_images_section_url: { required: false, description: 'Overview image URLs, semicolon-separated', example: 'https://...' },
  // ─── Amenities ─────────────────────────────────────────────────────────
  amenities_section_heading: { required: false, description: 'Amenities section heading', example: 'Amenities' },
  amenities_section_title: { required: false, description: 'Amenities section title', example: 'Designed to meet the highest criteria' },
  amenities_detail_section_title: { required: false, description: 'Amenity item names, semicolon-separated', example: 'CCTV; GYM; Library' },
  amenities_detail_section_image: { required: false, description: 'Amenities background image URL', example: 'https://...' },
  // ─── Floor Plans ───────────────────────────────────────────────────────
  plan_section_heading: { required: false, description: 'Floor plans section heading', example: 'Floor Plans' },
  plan_section_title: { required: false, description: 'Floor plans section title', example: 'Sophisticated and Spacious' },
  plan_section_details_plan_name: { required: false, description: 'Plan names, semicolon-separated', example: '3 BHK; 4 BHK' },
  plan_section_details_plan_value: { required: false, description: 'Plan sizes, semicolon-separated', example: '2095 SQ. FEET; 3395 SQ. FEET' },
  plan_section_details_plan_base_price: { required: false, description: 'Plan base prices, semicolon-separated', example: '4.80 Cr; 6 Cr' },
  // ─── Gallery ───────────────────────────────────────────────────────────
  gallery_section_heading: { required: false, description: 'Gallery section heading', example: 'Gallery' },
  gallery_section_title: { required: false, description: 'Gallery section title', example: 'Photos & Media' },
  gallery_section_description: { required: false, description: 'Gallery description', example: 'European style...' },
  gallery_section_images_url: { required: false, description: 'Gallery image URLs, semicolon-separated', example: 'https://...;https://...' },
  // ─── Location Advantages ──────────────────────────────────────────────
  advantage_section_heading: { required: false, description: 'Location advantage heading', example: 'Location Advantage' },
  advantage_section_title: { required: false, description: 'Location advantage title', example: 'Sophisticated and Spacious' },
  advantage_section_lists: { required: false, description: 'Location categories using | to separate groups and ; within groups. First item in each group is the category name.', example: 'Hotels;Grand Hyatt;DoubleTree Hilton|Malls;Worldmark;AIPL' },
  // ─── Info Sections ─────────────────────────────────────────────────────
  info_section1_heading: { required: false, description: 'Info section 1 heading', example: 'Exterior' },
  info_section1_title: { required: false, description: 'Info section 1 title', example: 'Fine Touch of Luxury' },
  info_section1_description: { required: false, description: 'Info section 1 description', example: 'An oasis of serenity...' },
  info_section1_description_varaint: { required: false, description: 'Info section 1 variant (para or list)', example: 'para' },
  info_section1_image: { required: false, description: 'Info section 1 image URL', example: 'https://...' },
  info_section2_heading: { required: false, description: 'Info section 2 heading', example: 'Balcony Views' },
  info_section2_title: { required: false, description: 'Info section 2 title', example: 'Highlights' },
  info_section2_description: { required: false, description: 'Info section 2 description', example: 'Elevate enjoys...' },
  info_section2_description_varaint: { required: false, description: 'Info section 2 variant', example: 'para' },
  info_section2_image: { required: false, description: 'Info section 2 image URL', example: 'https://...' },
  info_section3_heading: { required: false, description: 'Info section 3 heading', example: 'Interior' },
  info_section3_title: { required: false, description: 'Info section 3 title', example: 'Modern Comforts' },
  info_section3_description: { required: false, description: 'Info section 3 description', example: 'Every detail...' },
  info_section3_description_varaint: { required: false, description: 'Info section 3 variant', example: 'para' },
  info_section3_image: { required: false, description: 'Info section 3 image URL', example: 'https://...' },
  // ─── Contact ───────────────────────────────────────────────────────────
  contact_section_heading: { required: false, description: 'Contact section heading', example: 'Contact Us' },
  contact_section_title: { required: false, description: 'Contact section title', example: 'Schedule a Visit' },
  contact_section_location: { required: false, description: 'Google Maps embed URL', example: 'https://www.google.com/maps/embed?pb=...' },
  // ─── FAQs ──────────────────────────────────────────────────────────────
  faq_section_questions: { required: false, description: 'FAQ questions, semicolon-separated', example: 'What is the location?; Who is the developer?' },
  faq_section_answers: { required: false, description: 'FAQ answers, semicolon-separated (same order as questions)', example: 'Sector 59 Gurgaon; Conscient Hines' },
  // ─── SEO & Tracking ────────────────────────────────────────────────────
  metadata_og_title: { required: false, description: 'SEO / OG title', example: 'Conscient Hines Elevate, 3 & 4 BHK in Sector 59' },
  metadata_og_description: { required: false, description: 'SEO / OG description', example: 'Elevate is Under Construction...' },
  metadata_og_image: { required: false, description: 'OG image URL', example: 'https://...' },
  gtag_id: { required: false, description: 'Google Tag Manager ID (use NA if none)', example: 'GTM-XXXXXXX' },
  gtag_send_to: { required: false, description: 'GTM conversion label (use NA if none)', example: 'AW-XXXXX/XXXXX' },
  // ─── Documents ────────────────────────────────────────────────────────
  documents: { required: false, description: 'Documents using | to separate entries and ; for fields within each. Format: url;name;type', example: 'https://example.com/brochure.pdf;Project Brochure;PDF' },
  // ─── Offers ───────────────────────────────────────────────────────────
  offer_section_1: { required: false, description: 'Offer / promo text 1', example: 'Limited Time Offer' },
  offer_section_2: { required: false, description: 'Offer / promo text 2', example: 'Free Modular Kitchen' },
  // ─── Banner info ──────────────────────────────────────────────────────
  banner_info_section_value: { required: false, description: 'Banner stats values, semicolon-separated', example: '3, 4 BHK;₹4.85 Cr*;2145 - 5947 sq. ft.;Sector 59' },
  banner_info_section_name: { required: false, description: 'Banner stat labels, semicolon-separated', example: 'Unit Typology;Starting Price;Unit Size;Location' },
  keywords_1: { required: false, description: 'Secondary keywords, semicolon-separated', example: 'luxury-apartments;gurugram' },
};

export const REQUIRED_COLUMNS = Object.entries(IMPORT_COLUMNS)
  .filter(([, v]) => v.required)
  .map(([k]) => k);

/**
 * Generate a downloadable Excel template using xlsx.
 * Returns a Buffer containing the .xlsx file.
 */
export async function generateExcelTemplate() {
  // Dynamically import xlsx (devDependency) to keep runtime bundle lean
  const XLSX = (await import('xlsx')).default;

  const headers = Object.keys(IMPORT_COLUMNS);

  // Row 1: Column names
  // Row 2: Required marker
  // Row 3: Description
  // Row 4: Example row

  const row1 = headers; // headers
  const row2 = headers.map((h) => (IMPORT_COLUMNS[h].required ? 'REQUIRED' : 'optional'));
  const row3 = headers.map((h) => IMPORT_COLUMNS[h].description);
  const row4 = headers.map((h) => IMPORT_COLUMNS[h].example || '');

  // Instructions sheet data
  const instructions = [
    ['Zvisory Project Bulk Import – Instructions', '', ''],
    ['', '', ''],
    ['HOW IT WORKS (Create OR Update per slug)', '', ''],
    ['Each row is matched to an existing project by its SLUG (from "keywords" column, or auto-generated from title).', '', ''],
    ['  • Slug does NOT exist in DB  →  a NEW project is CREATED.', '', ''],
    ['  • Slug ALREADY exists in DB  →  the EXISTING project is UPDATED (no duplicate created).', '', ''],
    ['  • Blank optional cells during update PRESERVE the existing database value.', '', ''],
    ['  • Slugs are never changed via import. Use the Project edit page to change a slug.', '', ''],
    ['', '', ''],
    ['STEPS', '', ''],
    ['STEP 1: Download this template and fill in the "Projects" sheet.', '', ''],
    ['STEP 2: Do NOT rename or delete column headers in Row 1.', '', ''],
    ['STEP 3: Add one project per row, starting from Row 5.', '', ''],
    ['STEP 4: Remove Rows 2–4 (markers/examples) before uploading.', '', ''],
    ['STEP 5: Upload only .xlsx or .xls files. Max file size: 10 MB. Max rows: 500.', '', ''],
    ['', '', ''],
    ['FIELD RULES', 'TYPE', 'DETAILS'],
    ['project_title', 'REQUIRED – Text', 'Project title. Required for both create and update.'],
    ['developer', 'REQUIRED – Text', 'Must match a registered developer (case-insensitive). Updated on existing projects.'],
    ['locations', 'REQUIRED – Text', 'City name. Must match a registered city (e.g. "Gurugram", not "Gurgaon"). Updated on existing.'],
    ['keywords', 'Recommended – Text', 'Controls the URL slug. New slug = create. Existing slug = update. Must be kebab-case.'],
    ['startingPrice', 'Optional – Text', 'e.g. "₹4.85 Cr*" or "Price On Request". Blank preserves existing value on update.'],
    ['unitType', 'Optional – Text', 'Comma-separated, e.g. "3, 4 BHK". Blank preserves existing.'],
    ['unit_sizes', 'Optional – Text', 'e.g. "2145 - 5947 sq. ft.". Blank preserves existing.'],
    ['categories', 'Optional – Text', 'Semicolon-separated, e.g. "Luxury;Residential". Blank preserves existing.'],
    ['propertyType', 'Optional – Text', 'e.g. "Apartments", "Villas", "Plots". Blank preserves existing.'],
    ['paymentPlan', 'Optional – Text', 'e.g. "Construction Linked Plan". Blank preserves existing.'],
    ['rera_number', 'Optional – Text', 'RERA number. Blank preserves existing.'],
    ['land_area', 'Optional – Text', 'e.g. "7.75 Acres". Blank preserves existing.'],
    ['total_units', 'Optional – Text', 'e.g. "556". Blank preserves existing.'],
    ['micro_market', 'Optional – Text', 'Sub-area/locality. Blank preserves existing.'],
    ['banner_url', 'Optional – URL', 'Full URL to hero image. Blank preserves existing image.'],
    ['detail_section_title', 'Optional – Semicolon list', 'Spec labels. Blank preserves existing specs on update.'],
    ['detail_section_value', 'Optional – Semicolon list', 'Spec values. Same order as detail_section_title.'],
    ['gallery_section_images_url', 'Optional – Semicolon list', 'Gallery image URLs. Blank preserves existing gallery.'],
    ['overview_images_section_url', 'Optional – Semicolon list', 'Overview images. Blank preserves existing.'],
    ['amenities_detail_section_title', 'Optional – Semicolon list', 'Amenity names. Blank preserves existing amenities.'],
    ['plan_section_details_plan_name', 'Optional – Semicolon list', 'Floor plan names. Blank preserves existing plans.'],
    ['plan_section_details_plan_value', 'Optional – Semicolon list', 'Plan sizes. Same order as plan names.'],
    ['advantage_section_lists', 'Optional – Pipe+Semicolon', 'Location advantages. Blank preserves existing.'],
    ['documents', 'Optional – Pipe+Semicolon', 'Format: url;name;type per doc, separated by |. Blank preserves existing.'],
    ['faq_section_questions', 'Optional – Semicolon list', 'Questions. Both questions AND answers must be supplied together.'],
    ['faq_section_answers', 'Optional – Semicolon list', 'Answers in same order as questions.'],
    ['gtag_id / gtag_send_to', 'Optional – Text', 'Google Tag IDs. Blank preserves existing.'],
    ['', '', ''],
    ['PROTECTED FIELDS (never overwritten via import)', '', ''],
    ['_id, slug, status, featured, createdAt, publishedAt, launchStatus', '', 'System-managed. Ignored during update rows.'],
    ['', '', ''],
    ['SAME SLUG TWICE IN ONE FILE (batch duplicate)', '', ''],
    ['Only the FIRST occurrence of a slug in a file is processed.', '', ''],
    ['Subsequent rows with the same slug are SKIPPED and reported in the error report.', '', ''],
    ['Re-uploading the same file is safe: each project updates once per upload.', '', ''],
    ['', '', ''],
    ['CITY & DEVELOPER NAMES', '', ''],
    ['City names must match registered cities (e.g. "Gurugram" not "Gurgaon").', '', ''],
    ['Developer names must match registered developers. Case-insensitive matching is used.', '', ''],
    ['Invalid city or developer → row fails with a clear error message.', '', ''],
    ['', '', ''],
    ['VALUES TREATED AS BLANK (preserve existing on update)', '', ''],
    ['"NULL", "NONE", "NO DATA", "NA", "N/A", "URL"', '', 'Treated as missing. Existing DB value is kept during update.'],
    ['', '', ''],
    ['IMPORT SUMMARY REPORT', '', ''],
    ['After upload you will see: Total rows, Created, Updated, Failed, Skipped (batch duplicates).', '', ''],
    ['Failed rows report: Excel row number, project name/slug, field, error reason, fix suggestion.', '', ''],
    ['You can download the error report as a CSV for offline correction.', '', ''],
  ];

  // Build workbook
  const wb = XLSX.utils.book_new();

  // Projects sheet
  const wsData = [row1, row2, row3, row4];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style header row (bold, yellow background — supported in xlsx write)
  if (!ws['!rows']) ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 20 };

  // Column widths
  ws['!cols'] = headers.map(() => ({ wch: 28 }));

  XLSX.utils.book_append_sheet(wb, ws, 'Projects');

  // Instructions sheet
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr['!cols'] = [{ wch: 45 }, { wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  // Generate buffer
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return buffer;
}

/**
 * Safely delete a temp file, ignoring errors.
 */
export function deleteTempFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Non-fatal — log but don't throw
    console.warn(`[import] Could not delete temp file: ${filePath}`);
  }
}
