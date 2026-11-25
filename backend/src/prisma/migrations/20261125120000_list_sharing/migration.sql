-- CreateTable
CREATE TABLE "TaskListMember" (
    "taskListId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "invitedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(3),

    CONSTRAINT "TaskListMember_pkey" PRIMARY KEY ("taskListId","userId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskListMember_userId_idx" ON "TaskListMember"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskListMember" ADD CONSTRAINT "TaskListMember_taskListId_fkey" FOREIGN KEY ("taskListId") REFERENCES "TaskList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskListMember" ADD CONSTRAINT "TaskListMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

