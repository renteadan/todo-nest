/** Spread into a TaskList query's `include` to load its accepted members. */
export const acceptedMembers = {
  TaskListMember: {
    where: { acceptedAt: { not: null } },
    select: { userId: true },
  },
} as const;

export type ListWithMembers = {
  userId: number;
  TaskListMember: { userId: number }[];
};

export function listRole(
  list: ListWithMembers,
  userId: number,
): 'owner' | 'member' | null {
  if (list.userId === userId) return 'owner';
  return list.TaskListMember.some((m) => m.userId === userId) ? 'member' : null;
}

/** Everyone with access to the list, owner first. */
export function listUserIds(list: ListWithMembers): number[] {
  return [list.userId, ...list.TaskListMember.map((m) => m.userId)];
}
