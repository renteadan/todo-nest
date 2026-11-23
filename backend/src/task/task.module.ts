import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TaskService } from './task.service.js';
import { TaskController } from './task.controller.js';
import { TaskGateway } from './task.gateway.js';

@Module({
  imports: [PrismaModule],
  controllers: [TaskController],
  providers: [TaskService, TaskGateway],
  exports: [TaskService, TaskGateway],
})
export class TaskModule {}
