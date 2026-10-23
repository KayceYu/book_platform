import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const events=sqliteTable('events',{id:text('id').primaryKey(),data:text('data').notNull(),version:integer('version').notNull().default(1),createdAt:text('created_at').notNull()});
export const rsvps=sqliteTable('rsvps',{eventId:text('event_id').notNull().references(()=>events.id,{onDelete:'cascade'}),stageId:text('stage_id').notNull(),memberId:text('member_id').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.eventId,t.stageId,t.memberId]})]);
export const comments=sqliteTable('comments',{id:text('id').primaryKey(),eventId:text('event_id').notNull().references(()=>events.id,{onDelete:'cascade'}),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const expenses=sqliteTable('expenses',{id:text('id').primaryKey(),eventId:text('event_id').notNull().references(()=>events.id,{onDelete:'cascade'}),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const acknowledgements=sqliteTable('acknowledgements',{eventId:text('event_id').notNull().references(()=>events.id,{onDelete:'cascade'}),memberId:text('member_id').notNull(),version:integer('version').notNull()},t=>[primaryKey({columns:[t.eventId,t.memberId]})]);
export const changes=sqliteTable('changes',{id:text('id').primaryKey(),eventId:text('event_id').notNull().references(()=>events.id,{onDelete:'cascade'}),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const appMeta=sqliteTable('app_meta',{key:text('key').primaryKey(),value:text('value').notNull()});
