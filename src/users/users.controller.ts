import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  SerializeOptions,
  StandardSchemaSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { type UpdateUserDto, updateUserSchema } from './dto/update-user.dto.js';
import { userResponseSchema } from './dto/user-response.dto.js';

@Controller('users')
@UseInterceptors(StandardSchemaSerializerInterceptor)
@SerializeOptions({ schema: userResponseSchema })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
