import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueSession,verifySession,hashCode} from '../supabase/auth.mjs';
import {translateQuery} from '../supabase/postgres-adapter.mjs';
test('member session rejects forged signatures and expiration',async()=>{const token=await issueSession('xia','test-key',1000000);assert.equal(await verifySession(token,'test-key',1000000),'xia');assert.equal(await verifySession(token,'other-key',1000000),null);assert.equal(await verifySession(token,'test-key',1000000+8*86400000),null);assert.equal(await verifySession('forged.token.value','test-key'),null);});
test('group code stored as one-way digest and database adapter preserves result aliases',async()=>{assert.equal((await hashCode('test-code')).length,64);assert.notEqual(await hashCode('test-code'),await hashCode('other-code'));const sql=translateQuery("SELECT event_id as eventId, member_id as memberId, json_extract(data,'$.status') FROM rsvps");assert.match(sql,/as "eventId"/);assert.match(sql,/cg_json_extract/);assert.match(translateQuery('SELECT json_group_array(value)'),/COALESCE\(jsonb_agg/);});
