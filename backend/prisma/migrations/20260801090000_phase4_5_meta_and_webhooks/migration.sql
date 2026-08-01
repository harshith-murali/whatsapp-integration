-- Phase 4/5: Meta WhatsApp Cloud API, webhooks, templates, inbox, and delivery tracking.

-- AlterTable
ALTER TABLE `subscribers`
    ADD COLUMN `last_inbound_message_at` DATETIME(3) NULL,
    ADD COLUMN `last_outbound_message_at` DATETIME(3) NULL,
    ADD COLUMN `unsubscribe_source` VARCHAR(191) NULL,
    ADD COLUMN `consent_updated_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `message_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `meta_template_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `status` ENUM('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `header_type` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `footer` TEXT NULL,
    `components` JSON NOT NULL,
    `parameter_schema` JSON NULL,
    `last_synced_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `message_templates_name_language_key`(`name`, `language`),
    INDEX `message_templates_status_idx`(`status`),
    INDEX `message_templates_last_synced_at_idx`(`last_synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `broadcasts`
    ADD COLUMN `template_language` VARCHAR(191) NULL,
    ADD COLUMN `template_variables` JSON NULL,
    ADD COLUMN `template_snapshot` JSON NULL,
    ADD COLUMN `message_template_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `messages`
    ADD COLUMN `sent_at` DATETIME(3) NULL,
    ADD COLUMN `delivered_at` DATETIME(3) NULL,
    ADD COLUMN `read_at` DATETIME(3) NULL,
    ADD COLUMN `provider_error_code` VARCHAR(191) NULL,
    ADD COLUMN `provider_error_subcode` VARCHAR(191) NULL,
    ADD COLUMN `provider_error_type` VARCHAR(191) NULL,
    ADD COLUMN `provider_error_title` VARCHAR(191) NULL,
    ADD COLUMN `provider_error_details` TEXT NULL,
    ADD COLUMN `last_webhook_at` DATETIME(3) NULL,
    ADD COLUMN `latest_provider_timestamp` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `message_status_events`
    ADD COLUMN `new_status` ENUM('QUEUED', 'PROCESSING', 'SUBMITTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED') NULL,
    ADD COLUMN `source` ENUM('WORKER', 'WEBHOOK', 'SYSTEM', 'ADMIN') NOT NULL DEFAULT 'WORKER',
    ADD COLUMN `event_key` VARCHAR(191) NULL,
    ADD COLUMN `provider_timestamp` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `message_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `message_id` INTEGER NOT NULL,
    `attempt_number` INTEGER NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `request_started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `request_completed_at` DATETIME(3) NULL,
    `result` ENUM('STARTED', 'SUCCESS', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE') NOT NULL DEFAULT 'STARTED',
    `provider_message_id` VARCHAR(191) NULL,
    `error_code` VARCHAR(191) NULL,
    `retryable` BOOLEAN NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_attempts_message_id_idx`(`message_id`),
    INDEX `message_attempts_provider_message_id_idx`(`provider_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_key` VARCHAR(191) NOT NULL,
    `object_type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `payload_hash` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `signature_valid` BOOLEAN NOT NULL,
    `processing_status` ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED') NOT NULL DEFAULT 'RECEIVED',
    `processing_attempts` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `webhook_events_event_key_key`(`event_key`),
    INDEX `webhook_events_processing_status_received_at_idx`(`processing_status`, `received_at`),
    INDEX `webhook_events_received_at_idx`(`received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incoming_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_message_id` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `subscriber_id` INTEGER NULL,
    `wa_contact_id` VARCHAR(191) NULL,
    `contact_name` VARCHAR(191) NULL,
    `message_type` VARCHAR(191) NOT NULL,
    `text_body` TEXT NULL,
    `interactive_payload` JSON NULL,
    `media_id` VARCHAR(191) NULL,
    `reply_to_provider_message_id` VARCHAR(191) NULL,
    `received_at` DATETIME(3) NOT NULL,
    `provider_timestamp` DATETIME(3) NOT NULL,
    `status` ENUM('UNREAD', 'OPEN', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'UNREAD',
    `assigned_admin_id` INTEGER NULL,
    `raw_webhook_event_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `incoming_messages_provider_message_id_key`(`provider_message_id`),
    INDEX `incoming_messages_subscriber_id_idx`(`subscriber_id`),
    INDEX `incoming_messages_status_idx`(`status`),
    INDEX `incoming_messages_assigned_admin_id_idx`(`assigned_admin_id`),
    INDEX `incoming_messages_received_at_idx`(`received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `broadcasts_message_template_id_idx` ON `broadcasts`(`message_template_id`);

-- CreateIndex
CREATE UNIQUE INDEX `message_status_events_event_key_key` ON `message_status_events`(`event_key`);

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_message_template_id_fkey` FOREIGN KEY (`message_template_id`) REFERENCES `message_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_attempts` ADD CONSTRAINT `message_attempts_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incoming_messages` ADD CONSTRAINT `incoming_messages_subscriber_id_fkey` FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incoming_messages` ADD CONSTRAINT `incoming_messages_assigned_admin_id_fkey` FOREIGN KEY (`assigned_admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incoming_messages` ADD CONSTRAINT `incoming_messages_raw_webhook_event_id_fkey` FOREIGN KEY (`raw_webhook_event_id`) REFERENCES `webhook_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
