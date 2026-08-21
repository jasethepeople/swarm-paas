CREATE TABLE `organization_invitations` (
	`id` varchar(32) NOT NULL,
	`organizationId` varchar(32) NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`tokenHash` varchar(128) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_invitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `organization_invitations_org_idx` ON `organization_invitations` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organization_invitations_token_idx` ON `organization_invitations` (`tokenHash`);