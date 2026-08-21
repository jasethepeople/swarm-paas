CREATE TABLE `builder_api_keys` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(120) NOT NULL,
	`keyPrefix` varchar(24) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	CONSTRAINT `builder_api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `builder_api_keys_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `generated_app_artifacts` (
	`id` varchar(32) NOT NULL,
	`appId` varchar(32) NOT NULL,
	`kind` enum('source_manifest','sqlite_database','zip_export') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(640) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`contentType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_app_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_app_files` (
	`id` varchar(32) NOT NULL,
	`appId` varchar(32) NOT NULL,
	`path` varchar(512) NOT NULL,
	`language` varchar(48) NOT NULL,
	`content` longtext NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_app_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_apps` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`prompt` text NOT NULL,
	`status` enum('generating','ready','failed','archived') NOT NULL DEFAULT 'generating',
	`summary` text,
	`model` varchar(96),
	`schemaSummary` longtext,
	`routes` longtext,
	`componentTree` longtext,
	`previewConfig` longtext,
	`sourceManifestKey` varchar(512),
	`sourceBundleKey` varchar(512),
	`sqliteArtifactKey` varchar(512),
	`exportArtifactKey` varchar(512),
	`latencyMs` int,
	`inputTokens` int,
	`outputTokens` int,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generated_apps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `builder_api_keys_user_idx` ON `builder_api_keys` (`userId`);--> statement-breakpoint
CREATE INDEX `generated_app_artifacts_app_idx` ON `generated_app_artifacts` (`appId`);--> statement-breakpoint
CREATE INDEX `generated_app_files_app_idx` ON `generated_app_files` (`appId`);--> statement-breakpoint
CREATE INDEX `generated_apps_user_created_idx` ON `generated_apps` (`userId`,`createdAt`);