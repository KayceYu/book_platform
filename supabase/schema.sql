CREATE TABLE public.events(id text PRIMARY KEY,data text NOT NULL,version integer NOT NULL DEFAULT 1,created_at text NOT NULL);
CREATE TABLE public.rsvps(event_id text REFERENCES public.events(id) ON DELETE CASCADE,stage_id text NOT NULL,member_id text NOT NULL,data text NOT NULL,PRIMARY KEY(event_id,stage_id,member_id));
CREATE TABLE public.comments(id text PRIMARY KEY,event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,data text NOT NULL,created_at text NOT NULL);
CREATE TABLE public.expenses(id text PRIMARY KEY,event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,data text NOT NULL,created_at text NOT NULL);
CREATE TABLE public.acknowledgements(event_id text REFERENCES public.events(id) ON DELETE CASCADE,member_id text NOT NULL,version integer NOT NULL,PRIMARY KEY(event_id,member_id));
CREATE TABLE public.changes(id text PRIMARY KEY,event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,data text NOT NULL,created_at text NOT NULL);
CREATE TABLE public.app_meta(key text PRIMARY KEY,value text NOT NULL);
CREATE TABLE public.cg_access_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),secret_hash text NOT NULL);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cg_access_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.events,public.rsvps,public.comments,public.expenses,public.acknowledgements,public.changes,public.app_meta,public.cg_access_config FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.events,public.rsvps,public.comments,public.expenses,public.acknowledgements,public.changes,public.app_meta,public.cg_access_config TO service_role;

-- SQLite-compatible JSON primitives keep the tested API's prepared queries intact.
CREATE FUNCTION public.cg_json_extract(doc text,path text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT doc::jsonb #>> string_to_array(substr(path,3),'.') $$;
CREATE FUNCTION public.cg_json_array_length(doc text,path text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_array_length(doc::jsonb #> string_to_array(substr(path,3),'.')) $$;
CREATE FUNCTION public.cg_json_each(doc text) RETURNS TABLE(value text) LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_array_elements_text(doc::jsonb) $$;
CREATE FUNCTION public.cg_json_each(doc text,path text) RETURNS TABLE(value text) LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_array_elements_text(doc::jsonb #> string_to_array(substr(path,3),'.')) $$;
CREATE FUNCTION public.cg_json_array_append(state jsonb,value text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT state || jsonb_build_array(value) $$;
CREATE AGGREGATE public.cg_json_group_array(text)(SFUNC=public.cg_json_array_append,STYPE=jsonb,INITCOND='[]');
CREATE FUNCTION public.cg_json(value jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT value $$;
CREATE FUNCTION public.cg_json_set(doc text,path text,value jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_set(doc::jsonb,string_to_array(substr(path,3),'.'),value,true)::text $$;
CREATE FUNCTION public.cg_json_insert(doc text,path text,value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_set(doc::jsonb,ARRAY['settled'],COALESCE(doc::jsonb->'settled','[]'::jsonb)||jsonb_build_array(value),true)::text $$;

-- Only the trusted Edge Function can execute prepared queries. Arguments are
-- quoted by PostgreSQL, not concatenated into SQL by a browser.
CREATE FUNCTION public.cg_sql(query text,args jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE parts text[]; statement text; value jsonb; result jsonb; n bigint; i integer;
BEGIN
 IF query !~* '^\s*(SELECT|INSERT|UPDATE|DELETE)\s' OR position(';' in query)>0 THEN RAISE EXCEPTION 'Unsupported statement'; END IF;
 parts:=string_to_array(query,'?');
 IF cardinality(parts)-1<>jsonb_array_length(args) THEN RAISE EXCEPTION 'Binding count mismatch'; END IF;
 statement:=parts[1];
 FOR i IN 1..jsonb_array_length(args) LOOP
  value:=args->(i-1);
  statement:=statement || CASE jsonb_typeof(value) WHEN 'null' THEN 'NULL' WHEN 'number' THEN value::text WHEN 'boolean' THEN value::text ELSE quote_literal(value#>>'{}') END || parts[i+1];
 END LOOP;
 IF statement ~* '^INSERT OR IGNORE INTO' THEN statement:=regexp_replace(statement,'^INSERT OR IGNORE INTO','INSERT INTO','i')||' ON CONFLICT DO NOTHING'; END IF;
 IF statement ~* '^SELECT' THEN
  EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(row)),''[]''::jsonb) FROM ('||statement||') row' INTO result;
  RETURN jsonb_build_object('results',result,'meta',jsonb_build_object('changes',0));
 END IF;
 PERFORM pg_advisory_xact_lock(74610328);
 EXECUTE statement; GET DIAGNOSTICS n=ROW_COUNT;
 RETURN jsonb_build_object('results','[]'::jsonb,'meta',jsonb_build_object('changes',n));
END $$;
CREATE FUNCTION public.cg_batch(statements jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE item jsonb; results jsonb:='[]';
BEGIN
 PERFORM pg_advisory_xact_lock(74610328);
 FOR item IN SELECT value FROM jsonb_array_elements(statements) LOOP
  results:=results||jsonb_build_array(public.cg_sql(item->>'query',item->'args'));
 END LOOP;
 RETURN results;
END $$;
REVOKE EXECUTE ON FUNCTION public.cg_sql(text,jsonb),public.cg_batch(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cg_sql(text,jsonb),public.cg_batch(jsonb) TO service_role;
