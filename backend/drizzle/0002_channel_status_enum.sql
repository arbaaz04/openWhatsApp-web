CREATE TYPE "public"."channel_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "status" TYPE "public"."channel_status" USING (
  CASE
    WHEN "status" IN ('active', 'paused', 'disabled') THEN "status"::"public"."channel_status"
    ELSE 'active'::"public"."channel_status"
  END
);--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "status" SET NOT NULL;
