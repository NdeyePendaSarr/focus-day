


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."debriefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "local_date" "date" NOT NULL,
    "reached_goals" boolean,
    "did_more" boolean,
    "missing_note" "text",
    "mood" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "debriefs_missing_note_len" CHECK (("char_length"("missing_note") <= 2000)),
    CONSTRAINT "debriefs_mood_check" CHECK ((("mood" >= 1) AND ("mood" <= 5)))
);


ALTER TABLE "public"."debriefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "why" "text",
    "target_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'done'::"text", 'paused'::"text", 'abandoned'::"text"]))),
    CONSTRAINT "goals_title_len" CHECK (("char_length"("title") <= 200)),
    CONSTRAINT "goals_why_len" CHECK (("char_length"("why") <= 1000))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "evidence" "jsonb",
    "days_observed" integer,
    "period_start" "date",
    "period_end" "date",
    "shown_at" timestamp with time zone,
    "user_verdict" "text",
    "acted_on" boolean,
    "action_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "insights_action_note_len" CHECK (("char_length"("action_note") <= 1000)),
    CONSTRAINT "insights_body_len" CHECK (("char_length"("body") <= 5000)),
    CONSTRAINT "insights_kind_check" CHECK (("kind" = ANY (ARRAY['observation'::"text", 'tendance'::"text", 'hypothese'::"text", 'recommandation'::"text"]))),
    CONSTRAINT "insights_title_len" CHECK (("char_length"("title") <= 200)),
    CONSTRAINT "insights_user_verdict_check" CHECK (("user_verdict" = ANY (ARRAY['utile'::"text", 'deja_su'::"text", 'faux'::"text", 'inutile'::"text"])))
);


ALTER TABLE "public"."insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "timezone" "text" DEFAULT 'Africa/Dakar'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_display_name_len" CHECK (("char_length"("display_name") <= 100)),
    CONSTRAINT "profiles_timezone_len" CHECK (("char_length"("timezone") <= 64))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "goal_id" "uuid",
    "local_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "why" "text",
    "planned_start" time without time zone,
    "planned_end" time without time zone,
    "estimated_minutes" integer,
    "planned_minutes" integer GENERATED ALWAYS AS (
CASE
    WHEN (("planned_start" IS NULL) OR ("planned_end" IS NULL)) THEN NULL::integer
    WHEN ("planned_end" > "planned_start") THEN ((EXTRACT(epoch FROM ("planned_end" - "planned_start")) / (60)::numeric))::integer
    ELSE (((EXTRACT(epoch FROM ("planned_end" - "planned_start")) / (60)::numeric))::integer + 1440)
END) STORED,
    "actual_minutes" integer,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "gap_reason" "text",
    "gap_note" "text",
    "origin" "text" DEFAULT 'planned'::"text" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "note" "text",
    "actual_source" "text",
    CONSTRAINT "sessions_actual_minutes_check" CHECK (("actual_minutes" >= 0)),
    CONSTRAINT "sessions_actual_source_check" CHECK (("actual_source" = ANY (ARRAY['panneau'::"text", 'rattrapage'::"text", 'hors_plan'::"text"]))),
    CONSTRAINT "sessions_description_len" CHECK (("char_length"("description") <= 1000)),
    CONSTRAINT "sessions_estimated_minutes_check" CHECK (("estimated_minutes" > 0)),
    CONSTRAINT "sessions_gap_note_len" CHECK (("char_length"("gap_note") <= 1000)),
    CONSTRAINT "sessions_gap_reason_check" CHECK (("gap_reason" = ANY (ARRAY['imprevu'::"text", 'mauvaise_estimation'::"text", 'distraction'::"text", 'fatigue'::"text", 'difficulte'::"text", 'changement_priorite'::"text", 'autre'::"text"]))),
    CONSTRAINT "sessions_note_len" CHECK (("char_length"("note") <= 10000)),
    CONSTRAINT "sessions_origin_check" CHECK (("origin" = ANY (ARRAY['planned'::"text", 'unplanned'::"text"]))),
    CONSTRAINT "sessions_planned_or_actual" CHECK ((("planned_start" IS NOT NULL) OR ("actual_minutes" IS NOT NULL))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in_progress'::"text", 'done'::"text", 'partial'::"text", 'missed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "sessions_title_len" CHECK (("char_length"("title") <= 200)),
    CONSTRAINT "sessions_why_len" CHECK (("char_length"("why") <= 1000))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_completion_by_slot" WITH ("security_invoker"='on') AS
 SELECT "user_id",
        CASE
            WHEN ("planned_start" < '12:00:00'::time without time zone) THEN 'matin'::"text"
            WHEN ("planned_start" < '18:00:00'::time without time zone) THEN 'apres-midi'::"text"
            ELSE 'soir'::"text"
        END AS "moment",
    "count"(*) AS "n_sessions",
    "count"(*) FILTER (WHERE ("status" = 'done'::"text")) AS "terminees",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("status" = 'done'::"text")))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "taux_achevement"
   FROM "public"."sessions" "s"
  WHERE (("origin" = 'planned'::"text") AND ("planned_start" IS NOT NULL))
  GROUP BY "user_id",
        CASE
            WHEN ("planned_start" < '12:00:00'::time without time zone) THEN 'matin'::"text"
            WHEN ("planned_start" < '18:00:00'::time without time zone) THEN 'apres-midi'::"text"
            ELSE 'soir'::"text"
        END;


ALTER VIEW "public"."v_completion_by_slot" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_day_summary" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "local_date",
    "count"(*) FILTER (WHERE ("origin" = 'planned'::"text")) AS "sessions_prevues",
    "count"(*) FILTER (WHERE (("origin" = 'planned'::"text") AND ("status" = 'done'::"text"))) AS "sessions_terminees",
    COALESCE("sum"(COALESCE("estimated_minutes", "planned_minutes")) FILTER (WHERE ("origin" = 'planned'::"text")), (0)::bigint) AS "minutes_prevues",
    COALESCE("sum"("actual_minutes"), (0)::bigint) AS "minutes_realisees",
    COALESCE("sum"("actual_minutes") FILTER (WHERE ("origin" = 'unplanned'::"text")), (0)::bigint) AS "minutes_hors_plan",
    "round"(((100.0 * ("count"(*) FILTER (WHERE (("origin" = 'planned'::"text") AND ("status" = 'done'::"text"))))::numeric) / (NULLIF("count"(*) FILTER (WHERE ("origin" = 'planned'::"text")), 0))::numeric), 1) AS "taux_achevement"
   FROM "public"."sessions" "s"
  GROUP BY "user_id", "local_date";


ALTER VIEW "public"."v_day_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_estimation_bias" WITH ("security_invoker"='on') AS
 SELECT "s"."user_id",
    "s"."goal_id",
    "g"."title" AS "objectif",
    "count"(*) AS "n_sessions",
    "sum"(COALESCE("s"."estimated_minutes", "s"."planned_minutes")) AS "minutes_prevues",
    "sum"("s"."actual_minutes") AS "minutes_realisees",
    "round"((("sum"("s"."actual_minutes"))::numeric / (NULLIF("sum"(COALESCE("s"."estimated_minutes", "s"."planned_minutes")), 0))::numeric), 2) AS "ratio"
   FROM ("public"."sessions" "s"
     LEFT JOIN "public"."goals" "g" ON (("g"."id" = "s"."goal_id")))
  WHERE (("s"."actual_minutes" IS NOT NULL) AND (COALESCE("s"."estimated_minutes", "s"."planned_minutes") IS NOT NULL) AND ("s"."origin" = 'planned'::"text"))
  GROUP BY "s"."user_id", "s"."goal_id", "g"."title";


ALTER VIEW "public"."v_estimation_bias" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_experiment_scorecard" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "count"(*) AS "insights_affiches",
    "count"(*) FILTER (WHERE ("user_verdict" = 'utile'::"text")) AS "juges_utiles",
    "count"(*) FILTER (WHERE ("user_verdict" = 'deja_su'::"text")) AS "deja_connus",
    "count"(*) FILTER (WHERE ("user_verdict" = 'faux'::"text")) AS "juges_faux",
    "count"(*) FILTER (WHERE "acted_on") AS "ont_change_une_decision"
   FROM "public"."insights" "i"
  WHERE ("shown_at" IS NOT NULL)
  GROUP BY "user_id";


ALTER VIEW "public"."v_experiment_scorecard" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_gap_reasons" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "gap_reason",
    "count"(*) AS "n_sessions",
    "sum"(GREATEST((COALESCE("estimated_minutes", "planned_minutes", 0) - COALESCE("actual_minutes", 0)), 0)) AS "minutes_perdues"
   FROM "public"."sessions" "s"
  WHERE ("gap_reason" IS NOT NULL)
  GROUP BY "user_id", "gap_reason";


ALTER VIEW "public"."v_gap_reasons" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_goal_time" WITH ("security_invoker"='on') AS
 SELECT "s"."user_id",
    ("date_trunc"('week'::"text", ("s"."local_date")::timestamp with time zone))::"date" AS "semaine",
    "s"."goal_id",
    COALESCE("g"."title", '(sans objectif)'::"text") AS "objectif",
    "sum"("s"."actual_minutes") AS "minutes_realisees"
   FROM ("public"."sessions" "s"
     LEFT JOIN "public"."goals" "g" ON (("g"."id" = "s"."goal_id")))
  WHERE ("s"."actual_minutes" IS NOT NULL)
  GROUP BY "s"."user_id", (("date_trunc"('week'::"text", ("s"."local_date")::timestamp with time zone))::"date"), "s"."goal_id", "g"."title";


ALTER VIEW "public"."v_goal_time" OWNER TO "postgres";


ALTER TABLE ONLY "public"."debriefs"
    ADD CONSTRAINT "debriefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debriefs"
    ADD CONSTRAINT "debriefs_user_id_local_date_key" UNIQUE ("user_id", "local_date");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "goals_user_status_idx" ON "public"."goals" USING "btree" ("user_id", "status");



CREATE INDEX "insights_user_created_idx" ON "public"."insights" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "sessions_user_date_idx" ON "public"."sessions" USING "btree" ("user_id", "local_date");



CREATE INDEX "sessions_user_goal_idx" ON "public"."sessions" USING "btree" ("user_id", "goal_id");



CREATE INDEX "sessions_user_status_idx" ON "public"."sessions" USING "btree" ("user_id", "status");



CREATE OR REPLACE TRIGGER "debriefs_touch" BEFORE UPDATE ON "public"."debriefs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "goals_touch" BEFORE UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "insights_touch" BEFORE UPDATE ON "public"."insights" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "sessions_touch" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."debriefs"
    ADD CONSTRAINT "debriefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."debriefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debriefs: propriétaire seulement" ON "public"."debriefs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals: propriétaire seulement" ON "public"."goals" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insights: propriétaire seulement" ON "public"."insights" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: propriétaire seulement" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions: propriétaire seulement" ON "public"."sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."debriefs" TO "anon";
GRANT ALL ON TABLE "public"."debriefs" TO "authenticated";
GRANT ALL ON TABLE "public"."debriefs" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."insights" TO "anon";
GRANT ALL ON TABLE "public"."insights" TO "authenticated";
GRANT ALL ON TABLE "public"."insights" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."v_completion_by_slot" TO "anon";
GRANT ALL ON TABLE "public"."v_completion_by_slot" TO "authenticated";
GRANT ALL ON TABLE "public"."v_completion_by_slot" TO "service_role";



GRANT ALL ON TABLE "public"."v_day_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_day_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_day_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_estimation_bias" TO "anon";
GRANT ALL ON TABLE "public"."v_estimation_bias" TO "authenticated";
GRANT ALL ON TABLE "public"."v_estimation_bias" TO "service_role";



GRANT ALL ON TABLE "public"."v_experiment_scorecard" TO "anon";
GRANT ALL ON TABLE "public"."v_experiment_scorecard" TO "authenticated";
GRANT ALL ON TABLE "public"."v_experiment_scorecard" TO "service_role";



GRANT ALL ON TABLE "public"."v_gap_reasons" TO "anon";
GRANT ALL ON TABLE "public"."v_gap_reasons" TO "authenticated";
GRANT ALL ON TABLE "public"."v_gap_reasons" TO "service_role";



GRANT ALL ON TABLE "public"."v_goal_time" TO "anon";
GRANT ALL ON TABLE "public"."v_goal_time" TO "authenticated";
GRANT ALL ON TABLE "public"."v_goal_time" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







