import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/dbConnection.js';
import Project from '../models/project.model.js';
import ProjectDetail from '../models/projectDetail.model.js';
import City from '../models/city.model.js';
import Developer from '../models/developer.model.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log('Connecting to MongoDB...');
  await connectDB();

  const jsonPath = path.resolve(__dirname, '../../zvisory-web/src/data/excel_projects_raw.json');
  console.log('Reading data from:', jsonPath);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File not found: ${jsonPath}`);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`Loaded ${rawData.length} raw records from JSON.`);

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

  let successCount = 0;
  let failCount = 0;

  for (let idx = 0; idx < rawData.length; idx++) {
    const raw = rawData[idx];
    try {
      const title = clean(raw.project_title, `Project ${idx + 1}`);

      let slug = '';
      if (!isInvalid(raw.keywords)) {
        slug = slugify(raw.keywords);
      } else {
        slug = slugify(title);
      }
      if (!slug) slug = `project-${idx + 1}`;

      const keywords = splitSemi(raw.keywords);
      const secondaryKeywords = splitSemi(raw.keywords_1);

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
      const city = locations.length > 0 ? locations[0] : 'Gurugram';
      const microMarket = clean(raw.micro_market, locations.join(', ') || city);
      const location = microMarket ? `${microMarket}, ${city}` : city;

      const startingPrice = clean(raw.startingPrice || raw.unnamed_col_10, 'Price On Request');
      const priceNumeric = parsePrice(startingPrice);

      const unitTypeStr = clean(raw.unitType || raw.banner_info_section_value || raw.unnamed_col_9);
      const unitConfigurations = unitTypeStr
        ? unitTypeStr.split(',').map((s) => s.trim()).filter(Boolean)
        : ['3 BHK', '4 BHK'];
      const unitSizes = clean(raw.unit_sizes || raw.unnamed_col_11, 'Custom Layouts');
      const propertyType = clean(raw.propertyType, 'Apartments');
      const paymentPlan = clean(raw.paymentPlan, 'Construction Linked Plan');
      const reraNumber = clean(raw.rera_number, 'RC/REP/HARERA/GGM/2024');

      const categories = splitSemi(raw.categories);
      if (categories.length === 0) categories.push('Luxury');

      const bannerUrl =
        clean(raw.banner_url) ||
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';
      const cardBanner = bannerUrl;

      const overviewDesc = clean(
        raw.overview_section_description,
        `${title} offers world-class living spaces designed for comfort, luxury, and serenity.`
      );

      const amenityTitles = splitSemi(raw.amenities_detail_section_title);
      const amenityImg = clean(raw.amenities_detail_section_image);
      const amenityItems = amenityTitles.map((n) => ({
        name: n,
        image: amenityImg,
        description: '',
      }));

      const planNames = splitSemi(raw.plan_section_details_plan_name);
      const planValues = splitSemi(raw.plan_section_details_plan_value);
      const planPrices = splitSemi(raw.plan_section_details_plan_base_price);
      const plans = planNames.map((n, i) => ({
        name: n,
        value: planValues[i] || 'Spacious Layout',
        basePrice: planPrices[i] || '',
        image: '',
      }));

      const galleryImages = splitSemi(raw.gallery_section_images_url);
      if (galleryImages.length === 0) galleryImages.push(bannerUrl);

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

      const offers = [];
      if (!isInvalid(raw.offer_section_1)) offers.push(String(raw.offer_section_1).trim());
      if (!isInvalid(raw.offer_section_2)) offers.push(String(raw.offer_section_2).trim());

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

      const faqQuestions = splitSemi(raw.faq_section_questions);
      const faqAnswers = splitSemi(raw.faq_section_answers);
      const faqs = [];
      faqQuestions.forEach((q, i) => {
        if (q && faqAnswers[i]) {
          faqs.push({ question: q, answer: faqAnswers[i] });
        }
      });

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

      // Upsert Project
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
          featured: idx < 6,
          seo,
          gtag,
          publishedAt: new Date(),
        },
        { upsert: true, new: true, runValidators: true }
      );

      // Upsert ProjectDetail
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

      successCount++;
    } catch (err) {
      failCount++;
      console.error(`Row ${idx + 1} (${raw.project_title}) failed:`, err.message);
    }
  }

  // Update master cities
  const distinctCities = await Project.distinct('city');
  for (const c of distinctCities) {
    if (c) {
      const count = await Project.countDocuments({ city: c, status: 'published' });
      await City.findOneAndUpdate(
        { slug: c.toLowerCase().replace(/\s+/g, '-') },
        {
          name: c,
          slug: c.toLowerCase().replace(/\s+/g, '-'),
          projectCount: count,
          isFeatured: true,
        },
        { upsert: true }
      );
    }
  }

  // Update master developers
  const distinctDevelopers = await Project.distinct('developer');
  for (const d of distinctDevelopers) {
    if (d) {
      const count = await Project.countDocuments({ developer: d, status: 'published' });
      await Developer.findOneAndUpdate(
        { slug: d.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
        {
          name: d,
          slug: d.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          projectCount: count,
        },
        { upsert: true }
      );
    }
  }

  console.log(`\n=== SEED COMPLETED ===`);
  console.log(`Successfully seeded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total projects in DB: ${await Project.countDocuments()}`);
  console.log(`Total details in DB: ${await ProjectDetail.countDocuments()}`);
  console.log(`Total cities in DB: ${await City.countDocuments()}`);
  console.log(`Total developers in DB: ${await Developer.countDocuments()}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
