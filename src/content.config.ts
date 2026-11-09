import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** One Markdown file per project in src/content/projects. The schema is the contract. */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** One line, plain words. Optional until written. */
    summary: z.string().optional(),
    /** building ● · live ▶ · paused ❚❚ · archived ■ */
    status: z.enum(['building', 'live', 'paused', 'archived']),
    stack: z.array(z.string()).default([]),
    repo: z.url().optional(),
    lastActivity: z.coerce.date(),
  }),
});

export const collections = { projects };
