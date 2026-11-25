import { Test, TestingModule } from '@nestjs/testing';
import { TasklistController } from './tasklist.controller.js';
import { TasklistService } from './tasklist.service.js';

describe('TasklistController', () => {
  let controller: TasklistController;
  const service = { findAll: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasklistController],
      providers: [{ provide: TasklistService, useValue: service }],
    }).compile();

    controller = module.get<TasklistController>(TasklistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('loads tasks only for include=tasks', () => {
    const user = { id: 1, email: 'o@x.io', name: null, role: 'USER' } as const;
    void controller.findAll(user, 'tasks');
    expect(service.findAll).toHaveBeenLastCalledWith(user, true);
    void controller.findAll(user, undefined);
    expect(service.findAll).toHaveBeenLastCalledWith(user, false);
    void controller.findAll(user, 'other');
    expect(service.findAll).toHaveBeenLastCalledWith(user, false);
  });
});
