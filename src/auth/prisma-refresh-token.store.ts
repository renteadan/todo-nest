import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type RefreshTokenRecord,
  type RefreshTokenStore,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

/** Used when a family is revoked but none of its tokens is stored any more. */
const FAR_FUTURE = new Date('9999-12-31T00:00:00Z');

@Injectable()
export class PrismaRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ refreshTokens: this });
  }

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      familyId: row.familyId,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      familyExpiresAt: row.familyExpiresAt,
      ...(row.usedAt && { usedAt: row.usedAt }),
      ...(row.claims !== null && {
        claims: row.claims as Record<string, unknown>,
      }),
    };
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: record.id,
        familyId: record.familyId,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        familyExpiresAt: record.familyExpiresAt,
        usedAt: record.usedAt ?? null,
        claims: (record.claims as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });

    // Keep both tables bounded: a family past its absolute lifetime can no
    // longer be refreshed, so neither its tokens nor its revocation matter.
    const expired = { familyExpiresAt: { lte: record.createdAt } };
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: expired }),
      this.prisma.revokedRefreshTokenFamily.deleteMany({ where: expired }),
    ]);
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    // One conditional write: of concurrent calls, exactly one updates the row.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return count === 1;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { familyId },
      select: { familyExpiresAt: true },
    });
    const familyExpiresAt = token?.familyExpiresAt ?? FAR_FUTURE;
    // INSERT … ON CONFLICT DO NOTHING: concurrent reuse detections revoke the
    // same family at once, and Prisma's upsert (read, then insert) would race.
    await this.prisma.revokedRefreshTokenFamily.createMany({
      data: [{ familyId, familyExpiresAt }],
      skipDuplicates: true,
    });
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    const revoked = await this.prisma.revokedRefreshTokenFamily.findUnique({
      where: { familyId },
      select: { familyId: true },
    });
    return revoked !== null;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    const families = await this.prisma.refreshToken.findMany({
      where: { userId },
      distinct: ['familyId'],
      select: { familyId: true, familyExpiresAt: true },
    });
    if (families.length === 0) {
      return;
    }
    await this.prisma.revokedRefreshTokenFamily.createMany({
      data: families,
      skipDuplicates: true,
    });
  }
}
