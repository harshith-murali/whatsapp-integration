-- Phase 6 hardening: idempotency and dead-letter review metadata.

ALTER TABLE `messages`
    ADD COLUMN `failure_category` VARCHAR(191) NULL,
    ADD COLUMN `requires_manual_review` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dead_lettered_at` DATETIME(3) NULL,
    ADD COLUMN `dead_letter_resolved_at` DATETIME(3) NULL;

CREATE TABLE `idempotency_keys` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `admin_id` INTEGER NULL,
    `route` VARCHAR(191) NOT NULL,
    `request_hash` VARCHAR(191) NOT NULL,
    `status` ENUM('PROCESSING', 'COMPLETED') NOT NULL DEFAULT 'PROCESSING',
    `response_status` INTEGER NULL,
    `response_body` JSON NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `idempotency_keys_key_route_key`(`key`, `route`),
    INDEX `idempotency_keys_admin_id_idx`(`admin_id`),
    INDEX `idempotency_keys_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
