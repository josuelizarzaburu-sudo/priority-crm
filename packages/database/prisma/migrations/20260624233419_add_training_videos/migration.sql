-- CreateEnum
CREATE TYPE "TrainingCategory" AS ENUM ('CRM_USAGE', 'QUOTING_TOOLS', 'VITALITY', 'SALES_TECHNIQUES', 'OTHER');

-- CreateTable
CREATE TABLE "training_videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "youtubeUrl" TEXT NOT NULL,
    "category" "TrainingCategory" NOT NULL,
    "durationMinutes" INTEGER,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_video_views" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_video_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_videos_organizationId_category_idx" ON "training_videos"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "training_video_views_videoId_userId_key" ON "training_video_views"("videoId", "userId");

-- AddForeignKey
ALTER TABLE "training_videos" ADD CONSTRAINT "training_videos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_videos" ADD CONSTRAINT "training_videos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_video_views" ADD CONSTRAINT "training_video_views_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "training_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_video_views" ADD CONSTRAINT "training_video_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
