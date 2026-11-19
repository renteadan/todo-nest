import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import {
  type CreateUserDto,
  type CreateUserResponse,
  createUserSchema,
} from './dto/create-user.dto.js';
import { type LoginUserDto, loginUserSchema } from './dto/login-user.dto.js';
import { type UpdateUserDto, updateUserSchema } from './dto/update-user.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  create(
    @Body({ schema: createUserSchema }) createUserDto: CreateUserDto,
  ): Promise<CreateUserResponse> {
    return this.usersService.register(createUserDto);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body({ schema: loginUserSchema }) loginUserDto: LoginUserDto,
  ): Promise<CreateUserResponse> {
    return this.usersService.login(loginUserDto.email, loginUserDto.password);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: updateUserSchema }) updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
