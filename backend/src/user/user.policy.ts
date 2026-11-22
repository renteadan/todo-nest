import { Policy, type PolicyBefore } from '@nestjs/authorization';
import { type AuthUser } from '../auth/auth-types.js';
import { Role } from '../generated/prisma/enums.js';

@Policy()
export class UserPolicy implements PolicyBefore<AuthUser> {
  // Admins can do everything.
  before(user: AuthUser | null): true | undefined {
    if (user?.role === Role.ADMIN) return true;
  }

  view(user: AuthUser | null, id: number): boolean {
    return user?.id === id;
  }

  /** Listing, updating and deleting users: admins only (via before()). */
  manage(_user: AuthUser | null): boolean {
    return false;
  }
}
