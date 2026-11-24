import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      short: z.string(),
      summary: z.string(),
      order: z.number(),
      period: z.string(),
      context: z.string(),
      role: z.string(),
      team: z.string().optional(),
      tools: z.array(z.string()),
      cover: image(),
      coverAlt: z.string(),
      coverFit: z.enum(['cover', 'contain']).default('cover'),
      coverPosition: z.string().default('50% 50%'),
      specs: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
      links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
      model: z
        .object({ src: z.string(), poster: image(), alt: z.string(), caption: z.string().optional(), credit: z.string().optional() })
        .optional(),
    }),
});

export const collections = { projects };
