ALTER TABLE "messages" ADD COLUMN "sent_by" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_sent_by_idx" ON "messages" USING btree ("sent_by");
