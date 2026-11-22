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
import { Can } from '@nestjs/authorization';
import { UserService } from './user.service.js';
import { UserPolicy } from './user.policy.js';
import { type UpdateUserDto, updateUserSchema } from './dto/update-user.dto.js';
import { userResponseSchema } from './dto/user-response.dto.js';

@Controller('user')
@UseInterceptors(StandardSchemaSerializerInterceptor)
@SerializeOptions({ schema: userResponseSchema })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Can(UserPolicy, 'manage')
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  // Runs before pipes, so the id is still the raw route string.
  @Can(UserPolicy, 'view', (context) => [
    Number(
      context.switchToHttp().getRequest<{ params: { id: string } }>().params.id,
    ),
  ])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Can(UserPolicy, 'manage')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: updateUserSchema }) updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(+id, updateUserDto);
  }

  @Can(UserPolicy, 'manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
