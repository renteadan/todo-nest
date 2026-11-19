import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  argon2 as argon2Callback,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import {
  type CreateUserDto,
  type CreateUserResponse,
} from './dto/create-user.dto.js';
import { type UpdateUserDto } from './dto/update-user.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

const argon2 = promisify(argon2Callback);

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(createUserDto: CreateUserDto) {
    if (await this.exists(createUserDto.email)) {
      throw new BadRequestException('User with this email already exists');
    }
    const salt = randomBytes(16).toString('hex');
    const hash = await this.hashPassword(createUserDto.password, salt);

    const user = await this.create({
      ...createUserDto,

      password: hash.toString('hex'),
      salt,
      updatedAt: new Date(),
    });

    return this.toResponse(user);
  }

  async login(email: string, password: string): Promise<CreateUserResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const hash = await this.hashPassword(password, user.salt);
    const stored = Buffer.from(user.password, 'hex');
    if (hash.length !== stored.length || !timingSafeEqual(hash, stored)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.toResponse(user);
  }

  private hashPassword(password: string, salt: string) {
    return argon2('argon2id', {
      message: password,
      nonce: salt,
      parallelism: 4,
      tagLength: 64,
      memory: 65536,
      passes: 3,
    });
  }

  private toResponse(user: {
    id: number;
    name: string | null;
    email: string;
  }): CreateUserResponse {
    return { id: user.id, name: user.name, email: user.email };
  }

  async exists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  create(createUserDto: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: { ...updateUserDto, updatedAt: new Date() },
    });
  }

  remove(id: number) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
