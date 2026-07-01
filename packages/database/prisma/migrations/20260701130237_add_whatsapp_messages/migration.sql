-- CreateEnum
CREATE TYPE "WaMsgDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WaMsgType" AS ENUM ('TEXT', 'DOCUMENT', 'IMAGE');

-- CreateEnum
CREATE TYPE "WaMsgStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "direction" "WaMsgDirection" NOT NULL,
    "messageType" "WaMsgType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL DEFAULT '',
    "mediaUrl" TEXT,
    "mediaFileName" TEXT,
    "sentByUserId" TEXT,
    "whatsappMessageId" TEXT,
    "status" "WaMsgStatus" NOT NULL DEFAULT 'SENT',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_messages_dealId_createdAt_idx" ON "whatsapp_messages"("dealId", "createdAt");

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
