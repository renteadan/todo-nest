import { z } from 'zod';
import { createTaskSchema } from './create-task.dto.js';

// `completed`, not completedAt: the server stamps the time with its own clock.
export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ completed: z.boolean().optional() });

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
