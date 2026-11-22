import { Policy, type PolicyBefore } from '@nestjs/authorization';
import { type AuthUser } from './auth-types.js';
import { Role } from '../generated/prisma/enums.js';

/**
 * For records that belong to one user (task lists, tasks): the owner can do
 * anything with them, admins can do everything.
 * Routes are `@Can.Anyone()`; the services check each record (404 when not
 * allowed, so ids don't reveal which records exist).
 */
@Policy()
export class OwnerPolicy implements PolicyBefore<AuthUser> {
  before(user: AuthUser | null): true | undefined {
    if (user?.role === Role.ADMIN) return true;
  }

  /** Every user's records, not just one's own: admins only (via before()). */
  viewAll(_user: AuthUser | null): boolean {
    return false;
  }

  owns(user: AuthUser | null, record: { userId: number }): boolean {
    return user?.id === record.userId;
  }
}
