CREATE TABLE "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"path" text NOT NULL,
	"visitor" text NOT NULL,
	"source" text,
	"device" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "page_views_at_idx" ON "page_views" USING btree ("at");