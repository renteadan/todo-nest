import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, Public, type TokenPair } from '@nestjs/authentication';
import { AuthService } from './auth.service.js';
import { type AuthUser } from './auth-types.js';
import {
  type RegisterUserDto,
  type RegisterUserResponse,
  registerUserSchema,
} from './dto/create-user.dto.js';
import { type LoginUserDto, loginUserSchema } from './dto/login-user.dto.js';
import {
  type RefreshTokenDto,
  refreshTokenSchema,
} from './dto/refresh-token.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(
    @Body({ schema: registerUserSchema }) createUserDto: RegisterUserDto,
  ): Promise<RegisterUserResponse> {
    return this.authService.register(createUserDto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body({ schema: loginUserSchema }) loginUserDto: LoginUserDto,
  ): Promise<TokenPair> {
    return this.authService.login(loginUserDto.email, loginUserDto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body({ schema: refreshTokenSchema }) dto: RefreshTokenDto,
  ): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  /** 204 whether or not the token was known (RFC 7009 §2.2). */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(
    @Body({ schema: refreshTokenSchema }) dto: RefreshTokenDto,
  ): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(204)
  logoutAll(@CurrentUser() user: AuthUser): Promise<void> {
    return this.authService.logoutAll(user.id);
  }
}
