import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
 id:text('id').primaryKey(), inviteHash:text('invite_hash').notNull(), meta:text('meta').notNull(), floor:integer('floor').notNull(), doc:text('doc').notNull(), version:integer('version').notNull().default(0), expires:integer('expires').notNull(),
}, table=>[index('rooms_expiry_idx').on(table.expires)]);
export const members = sqliteTable('members', {
 id:text('id').primaryKey(), room:text('room').notNull().references(()=>rooms.id,{onDelete:'cascade'}), tokenHash:text('token_hash').notNull(), name:text('name').notNull(), host:integer('host').notNull().default(0), seen:integer('seen').notNull(),
}, table=>[index('members_room_idx').on(table.room)]);
export const visits = sqliteTable('visits', {
 key:text('key').primaryKey(), day:text('day').notNull(), path:text('path').notNull(), language:text('language').notNull(), count:integer('count').notNull().default(0),
},table=>[index('visits_day_idx').on(table.day)]);
