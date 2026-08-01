-- CreateTable
CREATE TABLE `access_requests` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(191) NOT NULL,
  `last_name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone_number` VARCHAR(191) NOT NULL,
  `company` VARCHAR(191) NULL,
  `department` VARCHAR(191) NULL,
  `reason` TEXT NULL,
  `requested_role` ENUM('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER') NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
  `reviewed_by_id` INTEGER NULL,
  `reviewed_at` DATETIME(3) NULL,
  `rejection_reason` TEXT NULL,
  `approval_notes` TEXT NULL,
  `created_admin_id` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `access_requests_created_admin_id_key` (`created_admin_id`),
  INDEX `access_requests_email_idx` (`email`),
  INDEX `access_requests_phone_number_idx` (`phone_number`),
  INDEX `access_requests_status_idx` (`status`),
  INDEX `access_requests_created_at_idx` (`created_at`),
  INDEX `access_requests_reviewed_by_id_idx` (`reviewed_by_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_notifications` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `admin_id` INTEGER NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `entity_type` VARCHAR(191) NULL,
  `entity_id` INTEGER NULL,
  `link` VARCHAR(191) NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `admin_notifications_admin_id_is_read_idx` (`admin_id`, `is_read`),
  INDEX `admin_notifications_type_idx` (`type`),
  INDEX `admin_notifications_entity_type_entity_id_idx` (`entity_type`, `entity_id`),
  INDEX `admin_notifications_created_at_idx` (`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `access_requests`
  ADD CONSTRAINT `access_requests_reviewed_by_id_fkey`
  FOREIGN KEY (`reviewed_by_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `access_requests`
  ADD CONSTRAINT `access_requests_created_admin_id_fkey`
  FOREIGN KEY (`created_admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `admin_notifications`
  ADD CONSTRAINT `admin_notifications_admin_id_fkey`
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
