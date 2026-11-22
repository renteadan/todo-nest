-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_taskListId_fkey";

-- AlterTable: add userId nullable, backfill it from each task's list, then require it.
ALTER TABLE "Task" ADD COLUMN     "userId" INTEGER,
ALTER COLUMN "taskListId" DROP NOT NULL;

UPDATE "Task" SET "userId" = "TaskList"."userId"
FROM "TaskList" WHERE "Task"."taskListId" = "TaskList"."id";

ALTER TABLE "Task" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskListId_fkey" FOREIGN KEY ("taskListId") REFERENCES "TaskList"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
