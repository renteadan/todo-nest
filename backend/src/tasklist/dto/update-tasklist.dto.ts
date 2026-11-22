import { z } from 'zod';
import { createTasklistSchema } from './create-tasklist.dto.js';

export const updateTasklistSchema = createTasklistSchema.partial();

export type UpdateTasklistDto = z.infer<typeof updateTasklistSchema>;
