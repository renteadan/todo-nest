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
import { type TokenPair, TokenService } from '@nestjs/authentication';
import { UserService } from '../user/user.service.js';
import {
  type RegisterUserDto,
  type RegisterUserResponse,
} from './dto/create-user.dto.js';

const argon2 = promisify(argon2Callback);

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async register(
    createUserDto: RegisterUserDto,
  ): Promise<RegisterUserResponse> {
    if (await this.userService.exists(createUserDto.email)) {
      throw new BadRequestException('User with this email already exists');
    }
    const salt = randomBytes(16).toString('hex');
    const hash = await this.hashPassword(createUserDto.password, salt);

    const user = await this.userService.create({
      ...createUserDto,
      password: hash.toString('hex'),
      salt,
      updatedAt: new Date(),
    });

    return this.toResponse(user);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.userService.findByEmail(email);
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

  /** Exchanges a refresh token for a new pair; reuse revokes the whole family. */
  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.refresh(refreshToken);
  }

  /** Signs out the device holding this refresh token (revokes its family). */
  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revoke(refreshToken);
  }

  /** Signs the user out of every device. Issued access tokens live until they expire. */
  logoutAll(userId: number): Promise<void> {
    return this.tokenService.revokeAll(String(userId));
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
