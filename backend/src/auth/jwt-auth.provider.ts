import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { UserService } from '../user/user.service.js';
import { type AuthUser } from './auth-types.js';

@Injectable()
export class JwtAuth extends JwtBearerProvider<AuthUser> {
  constructor(
    private readonly userService: UserService,
    registry: AuthenticationRegistry,
  ) {
    super({ realm: 'v12' });
    registry.registerProvider(this);
  }

  // Runs after the signature and claims are verified; null rejects the token.
  protected async validate({ sub }: JwtClaims): Promise<AuthUser | null> {
    const id = Number(sub);
    if (!Number.isInteger(id)) {
      return null;
    }
    const user = await this.userService.findOne(id);
    return (
      user && {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    );
  }
}
