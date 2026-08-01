/*
  Warnings:

  - You are about to drop the column `delivered_at` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `read_at` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `sent_at` on the `messages` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider_message_id]` on the table `messages` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `broadcasts` ADD COLUMN `failed_at` DATETIME(3) NULL,
    ADD COLUMN `processing_started_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `message_status_events` ADD COLUMN `error_code` VARCHAR(191) NULL,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `previous_status` ENUM('QUEUED', 'PROCESSING', 'SUBMITTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED') NULL,
    ADD COLUMN `worker_id` VARCHAR(191) NULL,
    MODIFY `event_timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `messages` DROP COLUMN `delivered_at`,
    DROP COLUMN `read_at`,
    DROP COLUMN `sent_at`,
    ADD COLUMN `cancelled_at` DATETIME(3) NULL,
    ADD COLUMN `claim_expires_at` DATETIME(3) NULL,
    ADD COLUMN `claim_token` VARCHAR(191) NULL,
    ADD COLUMN `last_attempt_at` DATETIME(3) NULL,
    ADD COLUMN `max_retries` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `next_retry_at` DATETIME(3) NULL,
    ADD COLUMN `processing_started_at` DATETIME(3) NULL,
    ADD COLUMN `provider_message_id` VARCHAR(191) NULL,
    ADD COLUMN `provider_name` VARCHAR(191) NULL,
    ADD COLUMN `worker_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `worker_heartbeats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `worker_id` VARCHAR(191) NOT NULL,
    `provider_name` VARCHAR(191) NOT NULL,
    `status` ENUM('STARTING', 'RUNNING', 'STOPPING', 'STOPPED', 'ERROR') NOT NULL DEFAULT 'STARTING',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_heartbeat_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `current_batch_size` INTEGER NOT NULL DEFAULT 0,
    `processed_count` INTEGER NOT NULL DEFAULT 0,
    `success_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `hostname` VARCHAR(191) NULL,
    `process_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `worker_heartbeats_worker_id_key`(`worker_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `messages_provider_message_id_key` ON `messages`(`provider_message_id`);

-- CreateIndex
CREATE INDEX `messages_next_retry_at_idx` ON `messages`(`next_retry_at`);

-- CreateIndex
CREATE INDEX `messages_claim_expires_at_idx` ON `messages`(`claim_expires_at`);

-- CreateIndex
CREATE INDEX `messages_created_at_idx` ON `messages`(`created_at`);
