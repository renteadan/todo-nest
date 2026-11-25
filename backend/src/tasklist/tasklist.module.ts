import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { TaskModule } from '../task/task.module.js';
import { TasklistService } from './tasklist.service.js';
import { TasklistController } from './tasklist.controller.js';
import { MemberService } from './member.service.js';
import { MemberController } from './member.controller.js';

@Module({
  imports: [PrismaModule, TaskModule, NotificationModule],
  controllers: [TasklistController, MemberController],
  providers: [TasklistService, MemberService],
})
export class TasklistModule {}
