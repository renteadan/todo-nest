-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "familyExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "claims" JSONB,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedRefreshTokenFamily" (
    "familyId" TEXT NOT NULL,
    "familyExpiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RevokedRefreshTokenFamily_pkey" PRIMARY KEY ("familyId")
);

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyExpiresAt_idx" ON "RefreshToken"("familyExpiresAt");

-- CreateIndex
CREATE INDEX "RevokedRefreshTokenFamily_familyExpiresAt_idx" ON "RevokedRefreshTokenFamily"("familyExpiresAt");
