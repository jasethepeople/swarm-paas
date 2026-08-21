CREATE TABLE `generated_app_versions` (
	`id` varchar(32) NOT NULL,
	`appId` varchar(32) NOT NULL,
	`versionNumber` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`sourceManifestKey` varchar(512),
	`sqliteArtifactKey` varchar(512),
	`exportArtifactKey` varchar(512),
	`schemaSummary` longtext,
	`routes` longtext,
	`componentTree` longtext,
	`fileSnapshot` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_app_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_quotas` (
	`userId` int NOT NULL,
	`monthlyGenerationLimit` int NOT NULL DEFAULT 12,
	`monthlyTokenLimit` int NOT NULL DEFAULT 200000,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_quotas_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `tenant_usage` (
	`id` varchar(40) NOT NULL,
	`userId` int NOT NULL,
	`periodKey` varchar(7) NOT NULL,
	`generationCount` int NOT NULL DEFAULT 0,
	`inputTokens` int NOT NULL DEFAULT 0,
	`outputTokens` int NOT NULL DEFAULT 0,
	`latencyTotalMs` int NOT NULL DEFAULT 0,
	`artifactBytes` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `generated_app_versions_app_idx` ON `generated_app_versions` (`appId`,`versionNumber`);--> statement-breakpoint
CREATE INDEX `tenant_usage_user_period_idx` ON `tenant_usage` (`userId`,`periodKey`);