import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { type AuthUser } from '../auth/auth-types.js';
import { TaskService } from './task.service.js';
import { type CreateTaskDto, createTaskSchema } from './dto/create-task.dto.js';
import { type UpdateTaskDto, updateTaskSchema } from './dto/update-task.dto.js';

// Any signed-in user: TaskService checks OwnerPolicy on each task.
@Can.Anyone()
@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  create(
    @Body({ schema: createTaskSchema }) createTaskDto: CreateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.create(createTaskDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.taskService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateTaskSchema }) updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.update(id, updateTaskDto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.taskService.remove(id, user);
  }

  /** Marks the task done, at the server's time. */
  @Post(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.complete(id, user);
  }

  /** Marks the task not done. */
  @Delete(':id/complete')
  uncomplete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.uncomplete(id, user);
  }
}
