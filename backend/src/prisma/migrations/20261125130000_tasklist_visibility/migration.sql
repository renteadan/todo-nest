-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'SHARED');

-- AlterTable
ALTER TABLE "TaskList" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- Lists that already have members or invites were shared.
UPDATE "TaskList" SET "visibility" = 'SHARED'
WHERE "id" IN (SELECT DISTINCT "taskListId" FROM "TaskListMember");
