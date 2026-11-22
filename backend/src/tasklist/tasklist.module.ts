import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TaskModule } from '../task/task.module.js';
import { TasklistService } from './tasklist.service.js';
import { TasklistController } from './tasklist.controller.js';

@Module({
  imports: [PrismaModule, TaskModule],
  controllers: [TasklistController],
  providers: [TasklistService],
})
export class TasklistModule {}
