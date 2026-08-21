CREATE TABLE `app_collaboration_invitations` (
	`id` varchar(32) NOT NULL,
	`appId` varchar(32) NOT NULL,
	`email` varchar(320) NOT NULL,
	`access` enum('viewer','editor','manager') NOT NULL DEFAULT 'viewer',
	`tokenHash` varchar(128) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_collaboration_invitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_collaborators` (
	`id` varchar(32) NOT NULL,
	`appId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`access` enum('viewer','editor','manager') NOT NULL DEFAULT 'viewer',
	`addedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_collaborators_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_billing_accounts` (
	`organizationId` varchar(32) NOT NULL,
	`stripeCustomerId` varchar(128),
	`stripeSubscriptionId` varchar(128),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_billing_accounts_organizationId` PRIMARY KEY(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` varchar(32) NOT NULL,
	`endpointId` varchar(32) NOT NULL,
	`eventId` varchar(48) NOT NULL,
	`eventType` varchar(96) NOT NULL,
	`status` enum('pending','delivered','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`responseStatus` int,
	`errorMessage` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` varchar(32) NOT NULL,
	`organizationId` varchar(32) NOT NULL,
	`url` varchar(512) NOT NULL,
	`events` longtext NOT NULL,
	`secretCiphertext` longtext NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_endpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `app_collaboration_invitations_app_idx` ON `app_collaboration_invitations` (`appId`);--> statement-breakpoint
CREATE INDEX `app_collaboration_invitations_token_idx` ON `app_collaboration_invitations` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `app_collaborators_app_user_idx` ON `app_collaborators` (`appId`,`userId`);--> statement-breakpoint
CREATE INDEX `app_collaborators_user_idx` ON `app_collaborators` (`userId`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_endpoint_created_idx` ON `webhook_deliveries` (`endpointId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `webhook_endpoints_organization_idx` ON `webhook_endpoints` (`organizationId`);