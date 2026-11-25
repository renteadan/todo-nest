import { listRole, listUserIds } from './list-role.js';

const list = { userId: 1, TaskListMember: [{ userId: 5 }] };

describe('listRole', () => {
  it('tells the owner, a member and anyone else apart', () => {
    expect(listRole(list, 1)).toBe('owner');
    expect(listRole(list, 5)).toBe('member');
    expect(listRole(list, 9)).toBeNull();
  });
});

describe('listUserIds', () => {
  it('lists the owner first, then the members', () => {
    expect(listUserIds(list)).toEqual([1, 5]);
  });
});
