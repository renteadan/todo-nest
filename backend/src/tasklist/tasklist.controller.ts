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
import { TasklistService } from './tasklist.service.js';
import {
  type CreateTasklistDto,
  createTasklistSchema,
} from './dto/create-tasklist.dto.js';
import {
  type UpdateTasklistDto,
  updateTasklistSchema,
} from './dto/update-tasklist.dto.js';

// Any signed-in user: TasklistService checks OwnerPolicy on each list and task.
@Can.Anyone()
@Controller('tasklist')
export class TasklistController {
  constructor(private readonly tasklistService: TasklistService) {}

  @Post()
  create(
    @Body({ schema: createTasklistSchema })
    createTasklistDto: CreateTasklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasklistService.create(createTasklistDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.tasklistService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasklistService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateTasklistSchema })
    updateTasklistDto: UpdateTasklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasklistService.update(id, updateTasklistDto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.tasklistService.remove(id, user);
  }

  /** Adds one task to the list (moving it out of any other list). */
  @Post(':id/task/:taskId')
  addTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasklistService.addTask(id, taskId, user);
  }

  /** Takes one task out of the list; the task itself is kept. */
  @Delete(':id/task/:taskId')
  removeTask(
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasklistService.removeTask(id, taskId, user);
  }
}
