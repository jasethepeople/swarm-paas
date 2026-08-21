CREATE TABLE `app_share_links` (
	`id` varchar(32) NOT NULL,
	`appId` varchar(32) NOT NULL,
	`versionId` varchar(32),
	`tokenHash` varchar(128) NOT NULL,
	`createdByUserId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_share_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_routing_policies` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`model` varchar(96) NOT NULL,
	`inputMicrosPer1k` int NOT NULL,
	`outputMicrosPer1k` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`priority` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_routing_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_audit_logs` (
	`id` varchar(32) NOT NULL,
	`organizationId` varchar(32) NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(96) NOT NULL,
	`targetType` varchar(64) NOT NULL,
	`targetId` varchar(64),
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` varchar(32) NOT NULL,
	`organizationId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tenant_quotas` ADD `monthlyBudgetMicros` int DEFAULT 2500000 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_quotas` ADD `routingPolicy` enum('manual','balanced','lowest_cost') DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_usage` ADD `estimatedCostMicros` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `app_share_links_app_idx` ON `app_share_links` (`appId`);--> statement-breakpoint
CREATE INDEX `app_share_links_token_idx` ON `app_share_links` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `model_routing_policies_user_idx` ON `model_routing_policies` (`userId`,`model`);--> statement-breakpoint
CREATE INDEX `organization_audit_org_created_idx` ON `organization_audit_logs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `organization_members_org_user_idx` ON `organization_members` (`organizationId`,`userId`);--> statement-breakpoint
CREATE INDEX `organizations_owner_idx` ON `organizations` (`ownerId`);