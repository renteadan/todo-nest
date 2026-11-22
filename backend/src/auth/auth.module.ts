import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { UsersModule } from '../users/users.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaRefreshTokenStore } from './prisma-refresh-token.store.js';

@Module({
  imports: [UsersModule, PrismaModule],
  providers: [AuthService, JwtAuth, PrismaRefreshTokenStore],
  controllers: [AuthController],
})
export class AuthModule {}
