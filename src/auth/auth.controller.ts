import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  type RegisterUserDto,
  type RegisterUserResponse,
  registerUserSchema,
} from './dto/create-user.dto.js';
import { type LoginUserDto, loginUserSchema } from './dto/login-user.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body({ schema: registerUserSchema }) createUserDto: RegisterUserDto,
  ): Promise<RegisterUserResponse> {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body({ schema: loginUserSchema }) loginUserDto: LoginUserDto,
  ): Promise<RegisterUserResponse> {
    return this.authService.login(loginUserDto.email, loginUserDto.password);
  }
}
