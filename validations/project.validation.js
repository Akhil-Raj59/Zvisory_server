import { z } from 'zod';

export const createProjectSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be valid kebab-case'),
  keywords: z.array(z.string()).optional().default([]),
  secondaryKeywords: z.array(z.string()).optional().default([]),
  developer: z.string().min(1, 'Developer is required'),
  city: z.string().min(1, 'City is required'),
  microMarket: z.string().optional().default(''),
  location: z.string().optional().default(''),
  categories: z.array(z.string()).optional().default(['Luxury']),
  propertyType: z.string().optional().default('Apartments'),
  startingPrice: z.string().optional().default('Price On Request'),
  priceNumeric: z.number().nullable().optional().default(null),
  priceMaxNumeric: z.number().nullable().optional().default(null),
  unitConfigurations: z.array(z.string()).optional().default([]),
  unitSizes: z.string().optional().default(''),
  landArea: z.string().optional().default(''),
  totalUnits: z.string().optional().default(''),
  elevation: z.string().optional().default(''),
  launchStatus: z.string().optional().default('Under Construction'),
  possessionDate: z.string().nullable().optional().default(null),
  possessionText: z.string().optional().default(''),
  paymentPlan: z.string().optional().default(''),
  reraNumber: z.string().optional().default(''),
  cardBanner: z.string().optional().default(''),
  bannerUrl: z.string().optional().default(''),
  shortDescription: z.string().optional().default(''),
  status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
  featured: z.boolean().optional().default(false),
  isOnHomeCarousel: z.boolean().optional().default(false),
  isFlagshipProject: z.boolean().optional().default(false),
  seo: z
    .object({
      title: z.string().optional().default(''),
      description: z.string().optional().default(''),
      keywords: z.string().optional().default(''),
      ogTitle: z.string().optional().default(''),
      ogDescription: z.string().optional().default(''),
      ogImage: z.string().optional().default(''),
    })
    .optional()
    .default({}),
  gtag: z
    .object({
      gtagId: z.string().optional().default(''),
      gtagSendTo: z.string().optional().default(''),
    })
    .optional()
    .default({}),
  projectDetails: z
    .object({
      detailSpecs: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          })
        )
        .optional()
        .default([]),
      detailSpecsImage: z.string().optional().default(''),
      bannerStatLabels: z.array(z.string()).optional().default([]),
      overview: z
        .object({
          heading: z.string().optional().default('Project Overview'),
          title: z.string().optional().default(''),
          description: z.string().optional().default(''),
          images: z.array(z.string()).optional().default([]),
        })
        .optional()
        .default({}),
      amenities: z
        .object({
          heading: z.string().optional().default('Amenities'),
          title: z.string().optional().default('Designed to meet the highest criteria'),
          items: z
            .array(
              z.object({
                name: z.string(),
                image: z.string().optional().default(''),
                description: z.string().optional().default(''),
              })
            )
            .optional()
            .default([]),
        })
        .optional()
        .default({}),
      floorPlans: z
        .object({
          heading: z.string().optional().default('Floor Plans'),
          title: z.string().optional().default('Sophisticated and Spacious'),
          plans: z
            .array(
              z.object({
                name: z.string(),
                value: z.string().optional().default(''),
                basePrice: z.string().optional().default(''),
                image: z.string().optional().default(''),
              })
            )
            .optional()
            .default([]),
        })
        .optional()
        .default({}),
      gallery: z
        .object({
          heading: z.string().optional().default('Gallery'),
          title: z.string().optional().default('Photos & Media'),
          description: z.string().optional().default(''),
          images: z.array(z.string()).optional().default([]),
        })
        .optional()
        .default({}),
      locationAdvantages: z
        .object({
          heading: z.string().optional().default('Location Advantage'),
          title: z.string().optional().default('Sophisticated and Spacious'),
          categories: z
            .array(
              z.object({
                category: z.string(),
                items: z.array(z.string()).optional().default([]),
              })
            )
            .optional()
            .default([]),
        })
        .optional()
        .default({}),
      infoSections: z
        .array(
          z.object({
            heading: z.string().optional().default(''),
            title: z.string().optional().default(''),
            description: z.string().optional().default(''),
            image: z.string().optional().default(''),
            variant: z.string().optional().default('para'),
          })
        )
        .optional()
        .default([]),
      offers: z.array(z.string()).optional().default([]),
      documents: z
        .array(
          z.object({
            name: z.string().optional().default('Project Brochure'),
            type: z.string().optional().default('PDF'),
            url: z.string(),
          })
        )
        .optional()
        .default([]),
      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .optional()
        .default([]),
      contact: z
        .object({
          heading: z.string().optional().default('Contact Us'),
          title: z.string().optional().default('Schedule a Visit'),
          locationMapUrl: z.string().optional().default(''),
          phone: z.string().optional().default('+91 99999 99999'),
          email: z.string().optional().default('contactus@zvisory.com'),
        })
        .optional()
        .default({}),
      customSections: z
        .array(
          z.object({
            sectionId: z.string().optional(),
            heading: z.string().optional(),
            title: z.string().optional(),
            content: z.string().optional(),
            images: z.array(z.string()).optional().default([]),
          })
        )
        .optional()
        .default([]),
    })
    .optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
});
