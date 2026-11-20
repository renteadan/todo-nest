import 'dotenv/config';
import { AuthenticationStorage } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrismaRefreshTokenStore } from './prisma-refresh-token.store.js';

// Runs the library's contract suite (compare-and-set, revocation rules,
// concurrent refreshes) against the real database. Ids are unique per case,
// so a shared dev database works.
// Skipped when no database is reachable.
const prisma = process.env.DATABASE_URL
  ? new PrismaService(new ConfigService())
  : undefined;
const reachable =
  prisma !== undefined &&
  (await prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  ));

describe.skipIf(!reachable)('PrismaRefreshTokenStore', () => {
  afterAll(() => prisma!.$disconnect());

  const cases = authenticationStoreContract(
    () => ({
      refreshTokens: new PrismaRefreshTokenStore(
        prisma!,
        new AuthenticationStorage(),
      ),
    }),
    { contracts: ['refreshTokens'], concurrent: true },
  );

  for (const contractCase of cases) {
    it(contractCase.name, () => contractCase.run());
  }
});
