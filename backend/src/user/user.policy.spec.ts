import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { UserPolicy } from './user.policy.js';

const user: AuthUser = { id: 1, email: 'u@x.io', name: null, role: 'USER' };
const admin: AuthUser = { id: 2, email: 'a@x.io', name: null, role: 'ADMIN' };

describe('UserPolicy', () => {
  const policy = new UserPolicy();

  it('lets a user view only themselves, and nothing else', () => {
    expect(policy.view(user, 1)).toBe(true);
    expect(policy.view(user, 2)).toBe(false);
    expect(policy.view(null, 1)).toBe(false);
    expect(policy.manage(user)).toBe(false);
  });

  it('lets admins through before() and leaves others to the ability', () => {
    expect(policy.before(admin)).toBe(true);
    expect(policy.before(user)).toBeUndefined();
    expect(policy.before(null)).toBeUndefined();
  });
});

describe('OwnerPolicy', () => {
  const policy = new OwnerPolicy();

  it('gives a user only their own records; admins pass before()', () => {
    expect(policy.owns(user, { userId: 1 })).toBe(true);
    expect(policy.owns(user, { userId: 2 })).toBe(false);
    expect(policy.owns(null, { userId: 1 })).toBe(false);
    expect(policy.viewAll(user)).toBe(false);
    expect(policy.before(admin)).toBe(true);
    expect(policy.before(user)).toBeUndefined();
  });
});
