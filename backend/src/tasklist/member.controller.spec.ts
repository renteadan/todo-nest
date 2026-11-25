import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MemberController } from './member.controller.js';
import { MemberService } from './member.service.js';

describe('MemberController', () => {
  let controller: MemberController;
  const service = { remove: vi.fn() };
  const user = { id: 1, email: 'o@x.io', name: null, role: 'USER' } as const;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [MemberController],
      providers: [{ provide: MemberService, useValue: service }],
    }).compile();
    controller = moduleRef.get(MemberController);
  });

  it('passes me or a numeric user id to remove', async () => {
    await controller.remove(14, 'me', user);
    expect(service.remove).toHaveBeenLastCalledWith(14, 'me', user);
    await controller.remove(14, '4', user);
    expect(service.remove).toHaveBeenLastCalledWith(14, 4, user);
  });

  it('400s for any other user id', () => {
    expect(() => controller.remove(14, 'abc', user)).toThrow(
      BadRequestException,
    );
    expect(() => controller.remove(14, '1.5', user)).toThrow(
      BadRequestException,
    );
    expect(service.remove).not.toHaveBeenCalled();
  });
});
