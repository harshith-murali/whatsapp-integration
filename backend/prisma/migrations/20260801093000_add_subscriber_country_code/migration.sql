-- Add separate country code storage while preserving phone_number as the full normalized WhatsApp number.
ALTER TABLE `subscribers` ADD COLUMN `country_code` VARCHAR(8) NULL;
