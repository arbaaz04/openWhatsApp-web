-- 1. Create missing Enums safely
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_kind') THEN
        CREATE TYPE "public"."webhook_kind" AS ENUM('whatflow', 'meta');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_event') THEN
        CREATE TYPE "public"."webhook_event" AS ENUM('conversation.message.received', 'conversation.message.sent', 'conversation.window.opened', 'conversation.window.closed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_status') THEN
        CREATE TYPE "public"."channel_status" AS ENUM('active', 'paused', 'disabled');
    END IF;
END $$;

-- 2. Create missing Table safely (heals the gap in migration history)
CREATE TABLE IF NOT EXISTS "user_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"channel_id" integer,
	"kind" "webhook_kind" DEFAULT 'whatflow' NOT NULL,
	"url" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"events" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "user_webhooks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "user_webhooks_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action
);

-- 3. Ensure indexes exist
CREATE INDEX IF NOT EXISTS "user_webhooks_team_id_idx" ON "user_webhooks" USING btree ("team_id");
CREATE INDEX IF NOT EXISTS "user_webhooks_channel_id_idx" ON "user_webhooks" USING btree ("channel_id");

-- 4. Heal missing columns in other tables (handling potential gaps in 0001/0002)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sent_by') THEN
        ALTER TABLE "messages" ADD COLUMN "sent_by" text;
        ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    -- Ensure channel_status is applied correctly
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='status' AND data_type='character varying') THEN
        ALTER TABLE "channels" ALTER COLUMN "status" SET DATA TYPE "public"."channel_status" USING "status"::"public"."channel_status";
        ALTER TABLE "channels" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."channel_status";
        ALTER TABLE "channels" ALTER COLUMN "status" SET NOT NULL;
    END IF;
END $$;

-- 5. Perform the Rename (Safe multi-step process)
-- Add the new value 'whatflow-web' to the enum
ALTER TYPE "public"."webhook_kind" ADD VALUE IF NOT EXISTS 'whatflow-web';

-- Update the data
UPDATE "user_webhooks" SET "kind" = 'whatflow-web' WHERE "kind" = 'whatflow';

-- Update the default value for new rows
ALTER TABLE "user_webhooks" ALTER COLUMN "kind" SET DEFAULT 'whatflow-web';
