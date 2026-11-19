CREATE SEQUENCE "public"."ocpp_transaction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'FAULT' NOT NULL,
	"title" text NOT NULL,
	"station_id" text NOT NULL,
	"severity" text DEFAULT 'HIGH' NOT NULL,
	"source" text DEFAULT 'SIMULATION' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"ip_address" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charging_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"station_number" text NOT NULL,
	"user_id" text,
	"connector_id" integer DEFAULT 1 NOT NULL,
	"ocpp_transaction_id" integer,
	"id_tag" text DEFAULT 'unknown' NOT NULL,
	"meter_start" double precision DEFAULT 0 NOT NULL,
	"meter_stop" double precision,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"stop_requested_at" timestamp with time zone,
	"stop_reason" text,
	"energy_used" double precision DEFAULT 0 NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"applied_price" double precision DEFAULT 0 NOT NULL,
	"convenience_fee" double precision DEFAULT 0 NOT NULL,
	"tax" double precision DEFAULT 0 NOT NULL,
	"tax_percent" double precision,
	"prepaid_amount" double precision,
	"payment_id" text,
	"order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_token" text NOT NULL,
	"platform" text DEFAULT 'android' NOT NULL,
	"app_version" text DEFAULT '1.0.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faults" (
	"id" text PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"user_id" text,
	"session_id" text,
	"type" text NOT NULL,
	"fault_code" text,
	"fault_name" text,
	"source" text DEFAULT 'SIMULATION' NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"message" text,
	"status" text DEFAULT 'active' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"station_id" text NOT NULL,
	"session_id" text,
	"order_id" text NOT NULL,
	"payment_id" text,
	"signature" text,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"tax" double precision DEFAULT 0 NOT NULL,
	"convenience_fee" double precision DEFAULT 0 NOT NULL,
	"energy_cost" double precision NOT NULL,
	"total_amount" double precision NOT NULL,
	"estimated_amount" double precision,
	"estimated_energy_kwh" double precision,
	"price_per_kwh" double precision,
	"tax_percent" double precision,
	"actual_amount" double precision,
	"refund_amount" double precision,
	"extra_amount" double precision,
	"refund_id" text,
	"refund_timestamp" timestamp with time zone,
	"refund_error" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"station_number" text NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"district" text,
	"latitude" double precision,
	"longitude" double precision,
	"status" text DEFAULT 'offline' NOT NULL,
	"ports" integer DEFAULT 1 NOT NULL,
	"slots" integer,
	"power_output" double precision,
	"connector_type" text DEFAULT 'Type 2' NOT NULL,
	"image" text,
	"base_price_per_kwh" double precision DEFAULT 0 NOT NULL,
	"dynamic_pricing" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"convenience_fee" double precision DEFAULT 0 NOT NULL,
	"tax" double precision DEFAULT 18 NOT NULL,
	"last_seen" timestamp with time zone,
	"ocpp_connected" boolean DEFAULT false NOT NULL,
	"ocpp" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fault_status" text DEFAULT 'none' NOT NULL,
	"total_energy_consumed" double precision DEFAULT 0 NOT NULL,
	"health" text DEFAULT 'NORMAL' NOT NULL,
	"last_resolved_at" timestamp with time zone,
	"simulated" boolean DEFAULT false NOT NULL,
	"ocpp_password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"station_id" text NOT NULL,
	"station_object_id" text,
	"session_id" text,
	"connector_id" integer,
	"transaction_id" integer,
	"voltage" double precision,
	"current" double precision,
	"power" double precision,
	"temperature" double precision,
	"energy_consumed" double precision,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"mobile" text,
	"google_id" text,
	"auth_provider" text DEFAULT 'local' NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"vehicle_type" text,
	"session_timeout" integer DEFAULT 30 NOT NULL,
	"operator_id" text,
	"fcm_token" text DEFAULT '',
	"notification_preferences" jsonb DEFAULT '{"emailAlerts":true,"smsAlerts":false,"pushAlerts":true,"faultAlerts":true,"paymentAlerts":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faults" ADD CONSTRAINT "faults_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_station_status_idx" ON "alerts" USING btree ("station_id","status");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_station_tx_uq" ON "charging_sessions" USING btree ("station_id","ocpp_transaction_id");--> statement-breakpoint
CREATE INDEX "sessions_station_status_idx" ON "charging_sessions" USING btree ("station_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "charging_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_start_idx" ON "charging_sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "sessions_order_idx" ON "charging_sessions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_uq" ON "device_tokens" USING btree ("device_token");--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "faults_station_status_idx" ON "faults" USING btree ("station_id","status");--> statement-breakpoint
CREATE INDEX "faults_created_idx" ON "faults" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_uq" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_station_idx" ON "payments" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "payments_session_idx" ON "payments" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_number_uq" ON "stations" USING btree ("station_number");--> statement-breakpoint
CREATE INDEX "stations_user_idx" ON "stations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "telemetry_station_time_idx" ON "telemetry" USING btree ("station_id","timestamp");--> statement-breakpoint
CREATE INDEX "telemetry_time_idx" ON "telemetry" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_mobile_uq" ON "users" USING btree ("mobile");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_id_uq" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");