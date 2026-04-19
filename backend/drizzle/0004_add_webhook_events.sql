ALTER TYPE "public"."webhook_event" ADD VALUE 'conversation.started';--> statement-breakpoint
ALTER TYPE "public"."webhook_event" ADD VALUE 'conversation.inactive';--> statement-breakpoint
ALTER TYPE "public"."webhook_event" ADD VALUE 'conversation.ended';--> statement-breakpoint
ALTER TYPE "public"."webhook_event" ADD VALUE 'message.delivered';--> statement-breakpoint
ALTER TYPE "public"."webhook_event" ADD VALUE 'message.read';--> statement-breakpoint
ALTER TYPE "public"."webhook_event" ADD VALUE 'message.failed';
