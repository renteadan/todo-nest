import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { type AuthUser } from '../auth/auth-types.js';
import { NotificationService } from './notification.service.js';

// Any signed-in user: every query is scoped to the caller's own rows.
@Can.Anyone()
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notificationService.findAll(user.id, unread === 'true');
  }

  @Patch(':id/read')
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationService.markRead(id, user.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationService.markAllRead(user.id);
  }
}
