import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  argon2 as argon2Callback,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { type AccessTokenResult, TokenService } from '@nestjs/authentication';
import { UsersService } from '../users/users.service.js';
import {
  type RegisterUserDto,
  type RegisterUserResponse,
} from './dto/create-user.dto.js';

const argon2 = promisify(argon2Callback);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  async register(
    createUserDto: RegisterUserDto,
  ): Promise<RegisterUserResponse> {
    if (await this.usersService.exists(createUserDto.email)) {
      throw new BadRequestException('User with this email already exists');
    }
    const salt = randomBytes(16).toString('hex');
    const hash = await this.hashPassword(createUserDto.password, salt);

    const user = await this.usersService.create({
      ...createUserDto,
      password: hash.toString('hex'),
      salt,
      updatedAt: new Date(),
    });

    return this.toResponse(user);
  }

  async login(email: string, password: string): Promise<AccessTokenResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const hash = await this.hashPassword(password, user.salt);
    const stored = Buffer.from(user.password, 'hex');
    if (hash.length !== stored.length || !timingSafeEqual(hash, stored)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.tokenService.issue(String(user.id), { method: 'password' });
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
  }): RegisterUserResponse {
    return { id: user.id, name: user.name, email: user.email };
  }
}
