/**
 * Generates the Zvisory client-ready Excel import template.
 * Run: node generate_excel_template.js
 * Output: docs/Zvisory_Project_Import_Template.xlsx
 *
 * Requires: npm install xlsx (already in server/node_modules)
 */

import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// SHEET 1 — README / Instructions
// ─────────────────────────────────────────────────────────────────────────────
const README_ROWS = [
  ['ZVISORY PROJECT IMPORT — INSTRUCTIONS & FIELD REFERENCE'],
  [''],
  ['HOW THIS IMPORT WORKS'],
  ['The importer reads this workbook\'s "Projects" sheet. It converts each row to a MongoDB project record.'],
  ['The backend uses the file: zvisory-web/src/data/excel_projects_raw.json (converted from Projects.xlsx).'],
  ['The admin seed endpoint (POST /api/v1/admin/projects/bulk-seed) reads that JSON file on the server.'],
  ['⚠ This is NOT a direct file-upload endpoint. You must: (1) export this sheet as excel_projects_raw.json'],
  ['   and (2) place it at zvisory-web/src/data/excel_projects_raw.json then trigger the seed endpoint.'],
  [''],
  ['MATCHING KEY — SLUG (prevents duplicates on re-seed)'],
  ['The slug is derived from the first non-empty "keywords" column value.'],
  ['If keywords is empty, the slug is derived from project_title.'],
  ['The importer uses upsert (findOneAndUpdate) matching on slug — existing projects are updated safely.'],
  [''],
  ['REQUIRED vs OPTIONAL'],
  ['R = Required (blank rows will cause an error)'],
  ['O = Optional (blank values are gracefully skipped)'],
  [''],
  ['SEPARATORS'],
  ['Use ; (semicolon) to separate multiple values within a single cell.'],
  ['Use | (pipe) to separate groups/blocks (e.g. location advantage categories).'],
  [''],
  ['BOOLEAN / ENUM / STATUS'],
  ['status field in the seeder is always set to "published" for seeded records.'],
  ['featured is set automatically: first 6 rows become featured=true.'],
  [''],
  ['IMAGE & DOCUMENT URLS'],
  ['Provide full HTTPS URLs. Relative paths and "URL"/"NA"/"NO DATA" placeholders are treated as empty.'],
  ['Multiple gallery images: separate with ; (semicolon).'],
  ['Documents format: url;name;type — separate multiple documents with |'],
  ['Example: https://example.com/brochure.pdf;Project Brochure;PDF|https://example.com/cert.pdf;Certificate;PDF'],
  [''],
  ['PRICES'],
  ['Use human-readable format: ₹4.85 Cr* or 4.85 Cr or 48500000 (raw integer INR).'],
  ['The parser supports: Cr, Crore, Lac, Lakh, Lacs.'],
  [''],
  ['DO NOT RENAME HEADERS'],
  ['The exact header names in the "Projects" sheet are required by the importer.'],
  ['Do not add, remove, or rename columns. Unsupported columns are ignored.'],
  [''],
  ['COLUMN REFERENCE TABLE — SEE "Projects" SHEET FOR ACTUAL HEADERS'],
];

const COLUMN_REFERENCE = [
  ['#', 'Header (exact)', 'R/O', 'Description', 'Format / Examples'],
  [0, 'project_title', 'R', 'Full project name', 'Conscient Hines Elevate'],
  [1, 'keywords', 'R', 'Primary slug keyword (unique identifier). First value becomes the URL slug.', 'conscient-hines-elevate'],
  [2, 'keywords_1', 'O', 'Secondary SEO keywords (semicolon-separated)', '3bhk-4bhk-luxury-apartment-sector-59-gurgaon'],
  [3, 'detail_section_title', 'O', 'Detail spec labels (semicolon-separated)', 'Developer;Land Area;Total Units;Elevation;Status;Possession'],
  [4, 'detail_section_image', 'O', 'Image URL for detail specs section', 'https://example.com/specs.jpg'],
  [5, 'detail_section_value', 'O', 'Detail spec values (semicolon-separated, matches order of detail_section_title)', 'Conscient Hines;7.75 Acres;556;5;Stilt + 32;Ready To Move-In'],
  [6, 'categories', 'O', 'Property categories (semicolon-separated)', 'Luxury;Premium'],
  [7, 'locations', 'R', 'City name (first value is used as city; additional as alternatives)', 'Gurugram'],
  [8, 'banner_info_section_value', 'O', 'Banner stats row values (semicolon-separated)', '3, 4 BHK;₹4.85 Cr*;2145 - 5947 sq. ft.;Sector 59'],
  [9, 'unnamed_col_9 (unitType)', 'R', 'Unit configurations extracted from banner row (e.g. col 9)', '3, 4 BHK'],
  [10, 'unnamed_col_10 (startingPrice)', 'R', 'Starting price extracted from banner row (e.g. col 10)', '₹4.85 Cr*'],
  [11, 'unnamed_col_11 (unitSizes)', 'O', 'Unit size range extracted from banner row (e.g. col 11)', '2145 - 5947 sq. ft.'],
  [12, 'unnamed_col_12', 'O', 'Location/micro market from banner row (e.g. col 12)', 'Sector 59'],
  [13, 'banner_info_section_name', 'O', 'Banner stats row labels', 'Unit Typology;Starting Price;Unit Size;Location'],
  [14, 'overview_section_heading', 'O', 'Overview section heading text', 'Project Overview'],
  [15, 'overview_section_title', 'O', 'Overview section title', 'About This Project'],
  [16, 'overview_section_description', 'R', 'Full description paragraph', 'This project offers world-class...'],
  [17, 'amenities_section_heading', 'O', 'Amenities section heading', 'Amenities'],
  [18, 'amenities_section_title', 'O', 'Amenities section subtitle', 'Designed to meet the highest criteria'],
  [19, 'amenities_detail_section_image', 'O', 'Shared image URL for amenity icons', 'https://example.com/amenity.png'],
  [20, 'amenities_detail_section_title', 'O', 'Semicolon-separated amenity names', 'Swimming Pool;Gym;Clubhouse;Children Play Area'],
  [21, 'amenities_detail_section_description', 'O', 'Amenity descriptions (not used currently)', ''],
  [22, 'plan_section_heading', 'O', 'Floor plans section heading', 'Floor Plans'],
  [23, 'plan_section_title', 'O', 'Floor plans section subtitle', 'Sophisticated and Spacious'],
  [24, 'plan_section_details_plan_name', 'O', 'Floor plan type names (semicolon-separated)', '3 BHK; 4 BHK'],
  [25, 'plan_section_details_plan_value', 'O', 'Floor plan sizes matching plan names', '2095 SQ. FEET; 3395 SQ. FEET'],
  [26, 'plan_section_details_plan_base_price', 'O', 'Floor plan base prices matching plan names', '4.80 Cr; 6.50 Cr'],
  [27, 'gallery_section_heading', 'O', 'Gallery heading', 'Gallery'],
  [28, 'gallery_section_title', 'O', 'Gallery subtitle', 'Photos & Media'],
  [29, 'gallery_section_description', 'O', 'Gallery description text', 'Explore the architecture...'],
  [30, 'advantage_section_heading', 'O', 'Location advantage heading', 'Location Advantage'],
  [31, 'advantage_section_title', 'O', 'Location advantage subtitle', 'Prime Connectivity'],
  [32, 'advantage_section_lists', 'O', 'Location advantage groups. Format: Category;Item1;Item2|Category2;Item1', 'Hotels;Hyatt;Hilton|Malls;Worldmark;DLF'],
  [33, 'contact_section_heading', 'O', 'Contact section heading', 'Contact Us'],
  [34, 'contact_section_title', 'O', 'Contact section subtitle', 'Schedule a Visit'],
  [35, 'contact_section_location', 'O', 'Google Maps embed URL', 'https://www.google.com/maps/embed?pb=...'],
  [36, 'faq_section_questions', 'O', 'FAQ questions (semicolon-separated)', 'What is the location?;Who is the developer?'],
  [37, 'faq_section_answers', 'O', 'FAQ answers matching questions (semicolon-separated)', 'Sector 59, Gurugram;Conscient Hines'],
  [38, 'metadata_og_image', 'O', 'OpenGraph/SEO image URL', 'https://example.com/og.jpg'],
  [39, 'metadata_og_title', 'O', 'SEO title tag', 'Project Name, 3 & 4 BHK in Sector 59'],
  [40, 'metadata_og_description', 'O', 'SEO meta description', '150-160 character description...'],
  [41, 'gtag_id', 'O', 'Google Tag Manager ID (or NA)', 'NA'],
  [42, 'gtag_send_to', 'O', 'GTM send_to parameter (or NA)', 'NA'],
  [43, 'banner_url', 'O', 'Hero/banner image URL', 'https://example.com/banner.jpg'],
  [44, 'overview_images_section_url', 'O', 'Overview section image(s). Multiple separated by ;', 'https://example.com/img1.jpg'],
  [45, 'gallery_section_images_url', 'O', 'Gallery image URLs separated by ;', 'https://example.com/a.jpg;https://example.com/b.jpg'],
  [46, 'startingPrice', 'R', 'Starting price string (duplicate of col 10 — kept for compatibility)', '₹4.85 Cr*'],
  [47, 'developer', 'R', 'Developer company name', 'Conscient Hines'],
  [48, 'unitType', 'O', 'Unit type string (duplicate of col 9)', '3, 4 BHK'],
  [49, 'land_area', 'O', 'Total land area', '7.75 Acres'],
  [50, 'propertyType', 'O', 'Property type. Defaults to "Apartments"', 'Apartments | High Rise | Low Rise | Plots | Commercial'],
  [51, 'paymentPlan', 'O', 'Payment plan name', 'Construction Linked Plan'],
  [52, 'info_section1_image', 'O', 'Info highlight 1 image URL (or NA)', 'https://example.com/ext.jpg'],
  [53, 'info_section1_heading', 'O', 'Info highlight 1 section heading', 'Exterior'],
  [54, 'info_section1_title', 'O', 'Info highlight 1 title', 'Fine Touch of Luxury'],
  [55, 'info_section1_description_varaint', 'O', 'Info highlight 1 display variant', 'para'],
  [56, 'info_section1_description', 'O', 'Info highlight 1 body text', 'Full paragraph of text...'],
  [57, 'info_section2_image', 'O', 'Info highlight 2 image URL (or NA)', 'NA'],
  [58, 'info_section2_heading', 'O', 'Info highlight 2 heading', 'Balcony Views'],
  [59, 'info_section2_title', 'O', 'Info highlight 2 title', 'Highlights'],
  [60, 'info_section2_description_varaint', 'O', 'Info highlight 2 display variant', 'para'],
  [61, 'info_section2_description', 'O', 'Info highlight 2 body text', '...'],
  [62, 'info_section3_image', 'O', 'Info highlight 3 image URL (or NA/NO DATA)', 'NO DATA'],
  [63, 'info_section3_heading', 'O', 'Info highlight 3 heading (or NO DATA)', 'NO DATA'],
  [64, 'info_section3_title', 'O', 'Info highlight 3 title (or NO DATA)', 'NO DATA'],
  [65, 'info_section3_description_varaint', 'O', 'Info highlight 3 variant (or NO DATA)', 'NO DATA'],
  [66, 'info_section3_description', 'O', 'Info highlight 3 body (or NO DATA)', 'NO DATA'],
  [67, 'offer_section_1', 'O', 'Offer/special deal text 1', 'No Pre-EMI till possession'],
  [68, 'offer_section_2', 'O', 'Offer/special deal text 2', ''],
  [69, 'rera_number', 'O', 'RERA registration number', 'RC/REP/HARERA/GGM/914/646/2025/17'],
  [70, 'unit_sizes', 'O', 'Unit size range (text)', '2145 - 5947 sq. ft.'],
  [71, 'total_units', 'O', 'Total units count', '556'],
  [72, 'documents', 'O', 'Project documents. Format: url;name;type — pipe-separated for multiple', 'https://example.com/brochure.pdf;Brochure;PDF'],
  [73, 'micro_market', 'O', 'Micro-market / locality name', 'Golf Course Extension Road'],
];

// ─────────────────────────────────────────────────────────────────────────────
// SHEET 2 — Projects (actual data template with 2 sample rows)
// ─────────────────────────────────────────────────────────────────────────────

// Exact headers from the seed script (74 columns, indices 0-73)
const HEADERS = [
  'project_title',
  'keywords',
  'keywords_1',
  'detail_section_title',
  'detail_section_image',
  'detail_section_value',
  'categories',
  'locations',
  'banner_info_section_value',
  'unnamed_col_9',   // unitType extracted from banner
  'unnamed_col_10',  // startingPrice extracted from banner
  'unnamed_col_11',  // unitSizes extracted from banner
  'unnamed_col_12',  // location label from banner
  'banner_info_section_name',
  'overview_section_heading',
  'overview_section_title',
  'overview_section_description',
  'amenities_section_heading',
  'amenities_section_title',
  'amenities_detail_section_image',
  'amenities_detail_section_title',
  'amenities_detail_section_description',
  'plan_section_heading',
  'plan_section_title',
  'plan_section_details_plan_name',
  'plan_section_details_plan_value',
  'plan_section_details_plan_base_price',
  'gallery_section_heading',
  'gallery_section_title',
  'gallery_section_description',
  'advantage_section_heading',
  'advantage_section_title',
  'advantage_section_lists',
  'contact_section_heading',
  'contact_section_title',
  'contact_section_location',
  'faq_section_questions',
  'faq_section_answers',
  'metadata_og_image',
  'metadata_og_title',
  'metadata_og_description',
  'gtag_id',
  'gtag_send_to',
  'banner_url',
  'overview_images_section_url',
  'gallery_section_images_url',
  'startingPrice',
  'developer',
  'unitType',
  'land_area',
  'propertyType',
  'paymentPlan',
  'info_section1_image',
  'info_section1_heading',
  'info_section1_title',
  'info_section1_description_varaint',
  'info_section1_description',
  'info_section2_image',
  'info_section2_heading',
  'info_section2_title',
  'info_section2_description_varaint',
  'info_section2_description',
  'info_section3_image',
  'info_section3_heading',
  'info_section3_title',
  'info_section3_description_varaint',
  'info_section3_description',
  'offer_section_1',
  'offer_section_2',
  'rera_number',
  'unit_sizes',
  'total_units',
  'documents',
  'micro_market',
];

const SAMPLE_ROW_1 = [
  'Zvisory Sample Tower — Gurugram',                // project_title
  'zvisory-sample-tower-gurugram',                  // keywords (SLUG)
  'luxury-3bhk-4bhk-sector-62-gurugram',            // keywords_1
  'Developer;Land Area;Total Units;Elevation;Status;Possession', // detail_section_title
  'NA',                                              // detail_section_image
  'Sample Developer;8.5 Acres;450;Stilt + 30;Under Construction;December 2027', // detail_section_value
  'Luxury',                                          // categories
  'Gurugram',                                        // locations (city)
  '3, 4 BHK;₹3.50 Cr*;1850 - 3200 sq. ft.;Sector 62', // banner_info_section_value
  '3, 4 BHK',                                        // col9 unitType
  '₹3.50 Cr*',                                       // col10 startingPrice
  '1850 - 3200 sq. ft.',                             // col11 unitSizes
  'Sector 62',                                       // col12 location label
  'Unit Typology;Starting Price;Unit Size;Location', // banner_info_section_name
  'Project Overview',                                // overview_section_heading
  'Zvisory Sample Tower Overview',                   // overview_section_title
  'Zvisory Sample Tower is a premium luxury residential development in Sector 62, Gurugram. Offering 3 BHK and 4 BHK apartments with world-class amenities, lush green surroundings, and unmatched connectivity to NH-8 and IGI Airport.', // overview_section_description
  'Amenities',                                       // amenities_section_heading
  'Designed to meet the highest criteria',           // amenities_section_title
  'NA',                                              // amenities_detail_section_image
  'Swimming Pool;Gymnasium;Clubhouse;Cricket Pitch;CCTV Surveillance;Power Backup;24/7 Security;Children Play Area;Jogging Track;Indoor Games', // amenities_detail_section_title
  '',                                                // amenities_detail_section_description
  'Floor Plans',                                     // plan_section_heading
  'Sophisticated and Spacious',                      // plan_section_title
  '3 BHK; 4 BHK',                                   // plan_section_details_plan_name
  '1850 SQ. FEET; 3200 SQ. FEET',                   // plan_section_details_plan_value
  '3.50 Cr; 5.80 Cr',                               // plan_section_details_plan_base_price
  'Gallery',                                         // gallery_section_heading
  'Photos & Media',                                  // gallery_section_title
  'Explore the stunning architecture and interiors of Zvisory Sample Tower.', // gallery_section_description
  'Location Advantage',                              // advantage_section_heading
  'Prime Connectivity',                              // advantage_section_title
  'Metro;Sector 56 Metro 800m;HUDA City Centre 2.5km|Malls;MGF Metropolitan 1.2km;Ambience Mall 4km|Hospitals;Medanta 6km;Max Healthcare 3km', // advantage_section_lists
  'Contact Us',                                      // contact_section_heading
  'Schedule a Site Visit',                           // contact_section_title
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3507.0!2d77.06!3d28.42!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjjCsDI1JzEyLjAiTiA3N8KwMDMnMzYuMCJF!5e0!3m2!1sen!2sin!4v1620000000000!5m2!1sen!2sin', // contact_section_location
  'What is the location of Zvisory Sample Tower?;Who is the developer?;What is the possession date?', // faq_section_questions
  'Zvisory Sample Tower is located in Sector 62, Gurugram, near NH-8.;Sample Developer, a leading real estate firm.;December 2027.', // faq_section_answers
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', // metadata_og_image
  'Zvisory Sample Tower — 3 & 4 BHK Luxury in Sector 62, Gurugram', // metadata_og_title
  'Discover premium 3 & 4 BHK apartments at Zvisory Sample Tower, Sector 62, Gurugram. Starting ₹3.50 Cr*. World-class amenities, verified RERA registered.', // metadata_og_description
  'NA',                                              // gtag_id
  'NA',                                              // gtag_send_to
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', // banner_url
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', // overview_images_section_url
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80;https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80', // gallery_section_images_url
  '₹3.50 Cr*',                                      // startingPrice (col 46)
  'Sample Developer',                                // developer
  '3, 4 BHK',                                       // unitType
  '8.5 Acres',                                      // land_area
  'Apartments',                                      // propertyType
  'Construction Linked Plan',                        // paymentPlan
  'NA',                                              // info_section1_image
  'Exterior',                                        // info_section1_heading
  'Thoughtfully Designed Living',                    // info_section1_title
  'para',                                            // info_section1_description_varaint
  'The exterior facade of Zvisory Sample Tower is inspired by contemporary European architecture with clean lines and premium materials.', // info_section1_description
  'NA',                                              // info_section2_image
  'Interiors',                                       // info_section2_heading
  'Luxury Inside Out',                               // info_section2_title
  'para',                                            // info_section2_description_varaint
  'Each apartment features Italian marble flooring, modular kitchen, VRV air-conditioning, and private balconies with city views.', // info_section2_description
  'NO DATA',                                         // info_section3_image
  'NO DATA',                                         // info_section3_heading
  'NO DATA',                                         // info_section3_title
  'NO DATA',                                         // info_section3_description_varaint
  'NO DATA',                                         // info_section3_description
  '',                                                // offer_section_1
  '',                                                // offer_section_2
  'RC/REP/HARERA/GGM/2025/SAMPLE/001',              // rera_number
  '1850 - 3200 sq. ft.',                            // unit_sizes
  '450',                                             // total_units
  'https://example.com/brochure.pdf;Project Brochure;PDF', // documents
  'Sector 62, Golf Course Extension Road',           // micro_market
];

const SAMPLE_ROW_2 = [
  'Prestige Park View — Bengaluru',
  'prestige-park-view-bengaluru',
  '3bhk-luxury-apartment-whitefield-bengaluru',
  'Developer;Land Area;Total Units;Elevation;Status;Possession',
  'NA',
  'Prestige Group;12 Acres;800;Stilt + 25;New Launch;March 2028',
  'Luxury;Premium',
  'Bengaluru',
  '2, 3 BHK;₹1.85 Cr*;1150 - 1950 sq. ft.;Whitefield',
  '2, 3 BHK',
  '₹1.85 Cr*',
  '1150 - 1950 sq. ft.',
  'Whitefield',
  'Unit Typology;Starting Price;Unit Size;Location',
  'Project Overview',
  'Prestige Park View — Bengaluru',
  'Prestige Park View is a new luxury residential development in Whitefield, Bengaluru. Featuring 2 BHK and 3 BHK apartments overlooking a 5-acre central park with state-of-the-art clubhouse and modern amenities.',
  'Amenities',
  'World Class Living Spaces',
  'NA',
  'Infinity Pool;Gymnasium;Badminton Court;Amphitheatre;Jogging Track;Senior Citizen Zone;Kids Play Area;EV Charging;Co-working Space',
  '',
  'Floor Plans',
  'Sophisticated and Spacious',
  '2 BHK; 3 BHK',
  '1150 SQ. FEET; 1950 SQ. FEET',
  '1.85 Cr; 3.20 Cr',
  'Gallery',
  'Photos & Media',
  'Discover the elegance of Prestige Park View through our curated photo gallery.',
  'Location Advantage',
  'Whitefield — The IT Hub',
  'IT Parks;ITPL 1.5km;Manyata Tech Park 8km|Metro;Whitefield Metro 0.5km;Majestic 18km|Hospitals;Manipal Hospital 4km;Cloudnine 3km',
  'Contact Us',
  'Schedule a Site Visit',
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.0!2d77.74!3d12.98!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTLCsDU4JzQ4LjAiTiA3N8KwNDQnMjQuMCJF!5e0!3m2!1sen!2sin!4v1620000000000!5m2!1sen!2sin',
  'Where is Prestige Park View located?;What is the unit size range?;Is this RERA approved?',
  'Prestige Park View is in Whitefield, Bengaluru, near ITPL.;Units range from 1150 to 1950 sq. ft.;Yes, RERA approved.',
  'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80',
  'Prestige Park View — 2 & 3 BHK in Whitefield, Bengaluru',
  'New luxury project by Prestige Group in Whitefield. 2 BHK & 3 BHK apartments starting ₹1.85 Cr*. Overlooking central park with world-class amenities.',
  'NA',
  'NA',
  'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80;https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
  '₹1.85 Cr*',
  'Prestige Group',
  '2, 3 BHK',
  '12 Acres',
  'Apartments',
  'Flexi Payment Plan',
  'NA',
  'Architecture',
  'Inspired by Nature',
  'para',
  'Prestige Park View features a biophilic design philosophy that blends nature with modern urban living.',
  'NA',
  'Interiors',
  'Premium Finishes',
  'para',
  'Every home features engineered wooden flooring in bedrooms, Italian marble in living areas, and premium bathroom fittings.',
  'NO DATA',
  'NO DATA',
  'NO DATA',
  'NO DATA',
  'NO DATA',
  'Free Club Membership for First 50 Buyers',
  '',
  'PRM/KA/RERA/2025/SAMPLE/002',
  '1150 - 1950 sq. ft.',
  '800',
  'https://example.com/prestige-brochure.pdf;Project Brochure;PDF',
  'Whitefield, ITPL Road',
];

// ─────────────────────────────────────────────────────────────────────────────
// Build workbook
// ─────────────────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();

// README sheet
const wsReadme = XLSX.utils.aoa_to_sheet([
  ...README_ROWS,
  [''],
  ...COLUMN_REFERENCE,
]);
// Style the first row as title
wsReadme['A1'] = { v: 'ZVISORY PROJECT IMPORT — INSTRUCTIONS & FIELD REFERENCE', t: 's' };
XLSX.utils.book_append_sheet(wb, wsReadme, 'README');

// Projects data sheet
const projectsData = [HEADERS, SAMPLE_ROW_1, SAMPLE_ROW_2];
const wsProjects = XLSX.utils.aoa_to_sheet(projectsData);

// Set column widths
const colWidths = HEADERS.map((h) => ({ wch: Math.max(h.length + 5, 20) }));
wsProjects['!cols'] = colWidths;

XLSX.utils.book_append_sheet(wb, wsProjects, 'Projects');

// ─────────────────────────────────────────────────────────────────────────────
// Save file
// ─────────────────────────────────────────────────────────────────────────────
const outputDir = path.resolve(__dirname, '../docs');
const outputPath = path.join(outputDir, 'Zvisory_Project_Import_Template.xlsx');

import { mkdirSync } from 'fs';
try {
  mkdirSync(outputDir, { recursive: true });
} catch {}

XLSX.writeFile(wb, outputPath);

console.log('✅ Excel template generated successfully!');
console.log('📁 Saved to:', outputPath);
console.log('');
console.log('IMPORTANT NOTES:');
console.log('- This template is for the bulk-seed JSON workflow, NOT direct file upload.');
console.log('- To import new projects:');
console.log('  1. Fill in the "Projects" sheet with your project data.');
console.log('  2. Export the sheet to JSON format (excel_projects_raw.json).');
console.log('  3. Place the JSON at: zvisory-web/src/data/excel_projects_raw.json');
console.log('  4. Trigger: POST /api/v1/admin/projects/bulk-seed (admin auth required).');
console.log('- The importer uses upsert on slug — re-seeding is safe (no duplicates).');
