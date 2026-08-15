import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { MUSCLES } from './lib/muscles';

const muscleIds = MUSCLES.map((m) => m.id);

const activities = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/activities' }),
  schema: z.discriminatedUnion('metricType', [
    z.object({
      metricType: z.literal('sets'),
      name: z.string(),
      discipline: z.literal('gym'),
      muscles: z.array(
        z.string().refine((id) => muscleIds.includes(id), {
          message: 'Unknown muscle id — must match an id in src/lib/muscles.ts',
        })
      ),
      equipment: z.string(),
      videoUrl: z.string().url().optional(),
    }),
    z.object({
      metricType: z.literal('session'),
      name: z.string(),
      discipline: z.enum(['running', 'natacion', 'combate']),
      videoUrl: z.string().url().optional(),
    }),
  ]),
});

const routineDay = z.array(z.string()).default([]);

const plans = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/plans' }),
  schema: z.object({
    name: z.string(),
    goal: z.string(),
    level: z.string(),
    days: z.object({
      lunes: routineDay,
      martes: routineDay,
      miercoles: routineDay,
      jueves: routineDay,
      viernes: routineDay,
      sabado: routineDay,
      domingo: routineDay,
    }),
  }),
});

export const collections = { activities, plans };
