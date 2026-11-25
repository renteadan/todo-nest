import { z } from 'zod';

// The single place notification types are defined. Payloads snapshot the
// titles/names they show, so a notification renders without lookups.
export const notificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INVITE'),
    data: z.object({
      taskListId: z.int(),
      listTitle: z.string(),
      actorId: z.int(),
      actorName: z.string(),
    }),
  }),
  z.object({
    type: z.literal('TASK_COMPLETED'),
    data: z.object({
      taskListId: z.int(),
      listTitle: z.string(),
      taskId: z.int(),
      taskTitle: z.string(),
      actorId: z.int(),
      actorName: z.string(),
    }),
  }),
]);

export type NotificationPayload = z.infer<typeof notificationSchema>;

export const actorName = (user: {
  name: string | null;
  email: string;
}): string => user.name ?? user.email;
