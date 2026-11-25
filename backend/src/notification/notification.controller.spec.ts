import { Test } from '@nestjs/testing';
import { type AuthUser } from '../auth/auth-types.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';

const USER_ID = 2;
const user: AuthUser = {
  id: USER_ID,
  email: 'u@x.io',
  name: null,
  role: 'USER',
};

describe('NotificationController', () => {
  const service = { findAll: vi.fn() };
  let controller: NotificationController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: service }],
    }).compile();
    controller = moduleRef.get(NotificationController);
  });

  it('passes unread=true through, and false when absent', async () => {
    await controller.findAll(user, 'true');
    expect(service.findAll).toHaveBeenLastCalledWith(USER_ID, true);
    await controller.findAll(user, undefined);
    expect(service.findAll).toHaveBeenLastCalledWith(USER_ID, false);
  });
});
