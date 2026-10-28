import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCitySchema = z.object({
  name: z.string().min(2, 'City name must be at least 2 characters').max(100, 'City name cannot exceed 100 characters'),
  slug: z.string().regex(slugRegex, 'Slug must be valid kebab-case (e.g. gurugram, new-delhi)').optional().or(z.literal('')),
  state: z.string().optional().default(''),
  country: z.string().optional().default('India'),
  image: z.string().optional().default('https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80'),
  coverImage: z.string().optional(),
  startingPrice: z.string().optional().default('₹1.5 Cr*'),
  shortDescription: z.string().optional().default(''),
  description: z.string().optional().default(''),
  highlights: z.union([z.array(z.string()), z.string()]).optional().default([]),
  localities: z.union([z.array(z.string()), z.string()]).optional().default([]),
  gallery: z.array(z.string()).optional().default([]),
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
  status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
  isFeatured: z.boolean().optional().default(false),
});

export const updateCitySchema = createCitySchema.partial();

export const updateCityStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived'], {
    errorMap: () => ({ message: 'Status must be one of: draft, published, archived' }),
  }),
});

export const transferProjectsSchema = z.object({
  targetCityId: z.string().min(1, 'Target city ID or slug is required'),
});
