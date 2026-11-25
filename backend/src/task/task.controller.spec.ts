import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';

describe('TaskController', () => {
  let controller: TaskController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: {} }],
    }).compile();

    controller = module.get<TaskController>(TaskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('declares GET /task/inbox before GET /task/:id', () => {
    const methods = Object.getOwnPropertyNames(TaskController.prototype);
    expect(methods.indexOf('findInbox')).toBeGreaterThan(-1);
    expect(methods.indexOf('findInbox')).toBeLessThan(
      methods.indexOf('findOne'),
    );
  });
});
