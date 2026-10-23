CREATE TABLE public.cg_member_credentials (
 member_id text PRIMARY KEY CHECK (member_id IN ('chang','cha','four','xia','fish','red')),
 code_hash text NOT NULL
);
CREATE TABLE public.cg_login_attempts (
 key text PRIMARY KEY,
 failures integer NOT NULL DEFAULT 0,
 window_started timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cg_member_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cg_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_direct_client_access ON public.cg_member_credentials AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY no_direct_client_access ON public.cg_login_attempts AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.cg_member_credentials,public.cg_login_attempts FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cg_member_credentials,public.cg_login_attempts TO service_role;

-- Credentials are provisioned privately. No real access codes belong in source.
CREATE FUNCTION public.cg_authenticate_member(input_code text,client_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE checked_at timestamptz:=clock_timestamp(); bucket text; attempt public.cg_login_attempts%ROWTYPE; matched text; wait_seconds integer;
BEGIN
 IF input_code IS NULL OR client_key IS NULL OR input_code !~ '^[0-9]{4}$' OR client_key !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('error','invalid_code');
 END IF;
 PERFORM pg_advisory_xact_lock(74610329);
 DELETE FROM public.cg_login_attempts WHERE window_started<=checked_at-interval '15 minutes';
 FOREACH bucket IN ARRAY ARRAY['global','ip:'||client_key] LOOP
  SELECT * INTO attempt FROM public.cg_login_attempts WHERE key=bucket;
  IF FOUND AND attempt.failures>=(CASE WHEN bucket='global' THEN 60 ELSE 5 END) THEN
   wait_seconds:=GREATEST(1,ceil(extract(epoch FROM (attempt.window_started+interval '15 minutes'-checked_at)))::integer);
   RETURN jsonb_build_object('error','rate_limited','retryAfter',wait_seconds);
  END IF;
 END LOOP;
 SELECT member_id INTO matched FROM public.cg_member_credentials
 WHERE extensions.crypt(input_code,code_hash)=code_hash;
 IF matched IS NOT NULL THEN
  DELETE FROM public.cg_login_attempts WHERE key='ip:'||client_key;
  RETURN jsonb_build_object('memberId',matched);
 END IF;
 FOREACH bucket IN ARRAY ARRAY['global','ip:'||client_key] LOOP
  INSERT INTO public.cg_login_attempts(key,failures,window_started) VALUES(bucket,1,checked_at)
  ON CONFLICT(key) DO UPDATE SET failures=cg_login_attempts.failures+1;
 END LOOP;
 RETURN jsonb_build_object('error','invalid_code');
END $$;
REVOKE EXECUTE ON FUNCTION public.cg_authenticate_member(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cg_authenticate_member(text,text) TO service_role;
