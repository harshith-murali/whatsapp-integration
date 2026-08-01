/*
  Warnings:

  - A unique constraint covering the columns `[broadcast_id,subscriber_id]` on the table `messages` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `message_status_events` DROP FOREIGN KEY `message_status_events_message_id_fkey`;

-- DropForeignKey
ALTER TABLE `messages` DROP FOREIGN KEY `messages_broadcast_id_fkey`;

-- DropForeignKey
ALTER TABLE `messages` DROP FOREIGN KEY `messages_subscriber_id_fkey`;

-- DropIndex
DROP INDEX `messages_subscriber_id_fkey` ON `messages`;

-- AlterTable
ALTER TABLE `broadcasts` ADD COLUMN `approved_at` DATETIME(3) NULL,
    ADD COLUMN `approved_by_id` INTEGER NULL,
    ADD COLUMN `audience_type` ENUM('ALL_ACTIVE_SUBSCRIBERS', 'GROUP') NOT NULL DEFAULT 'ALL_ACTIVE_SUBSCRIBERS',
    ADD COLUMN `cancellation_reason` TEXT NULL,
    ADD COLUMN `cancelled_at` DATETIME(3) NULL,
    ADD COLUMN `category` ENUM('EMERGENCY', 'SERVICE_UPDATE', 'REMINDER', 'ANNOUNCEMENT', 'OTHER') NOT NULL DEFAULT 'ANNOUNCEMENT',
    ADD COLUMN `group_id` INTEGER NULL,
    ADD COLUMN `queued_at` DATETIME(3) NULL,
    ADD COLUMN `rejected_at` DATETIME(3) NULL,
    ADD COLUMN `rejected_by_id` INTEGER NULL,
    ADD COLUMN `rejection_reason` TEXT NULL,
    ADD COLUMN `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    ADD COLUMN `submitted_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `subscriber_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriber_groups_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriber_group_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `subscriber_id` INTEGER NOT NULL,
    `added_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subscriber_group_members_group_id_idx`(`group_id`),
    INDEX `subscriber_group_members_subscriber_id_idx`(`subscriber_id`),
    UNIQUE INDEX `subscriber_group_members_group_id_subscriber_id_key`(`group_id`, `subscriber_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_admin_id_idx`(`admin_id`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `broadcasts_group_id_idx` ON `broadcasts`(`group_id`);

-- CreateIndex
CREATE INDEX `broadcasts_created_at_idx` ON `broadcasts`(`created_at`);

-- CreateIndex
CREATE UNIQUE INDEX `messages_broadcast_id_subscriber_id_key` ON `messages`(`broadcast_id`, `subscriber_id`);

-- AddForeignKey
ALTER TABLE `subscriber_groups` ADD CONSTRAINT `subscriber_groups_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriber_group_members` ADD CONSTRAINT `subscriber_group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `subscriber_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriber_group_members` ADD CONSTRAINT `subscriber_group_members_subscriber_id_fkey` FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriber_group_members` ADD CONSTRAINT `subscriber_group_members_added_by_id_fkey` FOREIGN KEY (`added_by_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `subscriber_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_rejected_by_id_fkey` FOREIGN KEY (`rejected_by_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_subscriber_id_fkey` FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_status_events` ADD CONSTRAINT `message_status_events_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `broadcasts` RENAME INDEX `broadcasts_created_by_id_fkey` TO `broadcasts_created_by_id_idx`;
