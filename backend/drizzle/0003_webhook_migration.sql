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

-- 2. Create missing Table safely
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

-- 4. Heal missing columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sent_by') THEN
        ALTER TABLE "messages" ADD COLUMN "sent_by" text;
        ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='status' AND data_type='character varying') THEN
        ALTER TABLE "channels" ALTER COLUMN "status" SET DATA TYPE "public"."channel_status" USING "status"::"public"."channel_status";
        ALTER TABLE "channels" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."channel_status";
        ALTER TABLE "channels" ALTER COLUMN "status" SET NOT NULL;
    END IF;
END $$;

-- 5. PERFORM THE RENAME (Transaction-safe RECREATION strategy)
-- Step 5a: Create a temporary type with the correct values
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_kind_new') THEN
        CREATE TYPE "public"."webhook_kind_new" AS ENUM('whatflow-web', 'meta');
    END IF;
END $$;

-- Step 5b: Update the column to use the temporary type
-- We cast to text first to ensure compatibility during the transition
ALTER TABLE "user_webhooks" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "user_webhooks" ALTER COLUMN "kind" SET DATA TYPE "public"."webhook_kind_new" USING (
    CASE 
        WHEN "kind"::text = 'whatflow' THEN 'whatflow-web'::"public"."webhook_kind_new"
        ELSE "kind"::text::"public"."webhook_kind_new"
    END
);

-- Step 5c: Clean up the old type and rename the new one
-- Note: We only do this if the old type still exists and is named 'webhook_kind'
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_kind') AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_kind_new') THEN
        DROP TYPE "public"."webhook_kind";
        ALTER TYPE "public"."webhook_kind_new" RENAME TO "webhook_kind";
    END IF;
END $$;

-- Step 5d: Restore the default value
ALTER TABLE "user_webhooks" ALTER COLUMN "kind" SET DEFAULT 'whatflow-web';
