CREATE TABLE `rate_limit_windows` (
	`key` varchar(192) NOT NULL,
	`count` int NOT NULL,
	`resetsAt` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rate_limit_windows_key` PRIMARY KEY(`key`)
);
