DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_status') THEN
        CREATE TYPE "public"."channel_status" AS ENUM('active', 'paused', 'disabled');
    END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "status" TYPE "public"."channel_status" USING (
  CASE
    WHEN "status" IN ('active', 'paused', 'disabled') THEN "status"::"public"."channel_status"
    ELSE 'active'::"public"."channel_status"
  END
);
--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."channel_status";
--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "status" SET NOT NULL;
