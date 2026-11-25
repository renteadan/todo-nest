import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { type AuthUser } from '../auth/auth-types.js';
import { MemberService } from './member.service.js';
import {
  type InviteMemberDto,
  inviteMemberSchema,
} from './dto/invite-member.dto.js';

// Any signed-in user: MemberService checks the caller's role on each list.
@Can.Anyone()
@Controller('tasklist/:id/member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get()
  list(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.memberService.list(id, user);
  }

  @Post()
  invite(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: inviteMemberSchema }) { email }: InviteMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.memberService.invite(id, email, user);
  }

  @Post('me/accept')
  accept(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.memberService.accept(id, user);
  }

  /** `:userId` is a user id or the literal `me`. */
  @Delete(':userId')
  @HttpCode(204)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // Digits only: '42' passes, '1.5' and 'abc' do not.
    if (userId !== 'me' && !/^\d+$/.test(userId)) {
      throw new BadRequestException('userId must be a number or "me"');
    }
    return this.memberService.remove(
      id,
      userId === 'me' ? 'me' : Number(userId),
      user,
    );
  }
}
