import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createHandler} from './handler.mjs';

const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const client=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler(client,serviceKey));
