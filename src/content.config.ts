import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const exercises = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exercises' }),
  schema: z.object({
    name: z.string(),
    muscles: z.array(z.string()),
    equipment: z.string(),
    videoUrl: z.string().url().optional(),
  }),
});

const plans = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/plans' }),
  schema: z.object({
    name: z.string(),
    goal: z.string(),
    level: z.string(),
  }),
});

export const collections = { exercises, plans };
