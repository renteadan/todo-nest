import { z } from 'zod';
import { createTaskSchema } from './create-task.dto.js';

// No completedAt: POST/DELETE /task/:id/complete set it, with the server's clock.
export const updateTaskSchema = createTaskSchema.partial();

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
