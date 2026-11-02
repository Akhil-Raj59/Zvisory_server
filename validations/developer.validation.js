import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createDeveloperSchema = z.object({
  name: z.string().min(2, 'Developer name must be at least 2 characters').max(150, 'Developer name cannot exceed 150 characters'),
  slug: z.string().regex(slugRegex, 'Slug must be valid kebab-case (e.g. dlf, godrej-properties)').optional().or(z.literal('')),
  logo: z.string().optional().default(''),
  shortDescription: z.string().max(300, 'Short description cannot exceed 300 characters').optional().default(''),
  description: z.string().optional().default(''),
  website: z.string().url('Website must be a valid URL').optional().or(z.literal('')).default(''),
  headquarters: z.string().optional().default(''),
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
});

export const updateDeveloperSchema = createDeveloperSchema.partial();

export const updateDeveloperStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived'], {
    errorMap: () => ({ message: 'Status must be one of: draft, published, archived' }),
  }),
});

export const transferDeveloperProjectsSchema = z.object({
  targetDeveloperId: z.string().min(1, 'Target developer ID or slug is required'),
});
