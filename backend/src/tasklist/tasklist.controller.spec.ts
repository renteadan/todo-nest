import { Test, TestingModule } from '@nestjs/testing';
import { TasklistController } from './tasklist.controller.js';
import { TasklistService } from './tasklist.service.js';

describe('TasklistController', () => {
  let controller: TasklistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasklistController],
      providers: [{ provide: TasklistService, useValue: {} }],
    }).compile();

    controller = module.get<TasklistController>(TasklistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
