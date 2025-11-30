import {
  bigserial,
  bigint,
  boolean as pgBoolean,
  customType,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const nodeStatusEnum = pgEnum('node_status', [
  'todo',
  'in_progress',
  'done',
  'archived',
]);

const ltree = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'ltree';
  },
  toDriver(value: string) {
    return value;
  },
  fromDriver(value: string) {
    return value;
  },
});

export const nodes = pgTable('nodes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  isTask: pgBoolean('is_task').notNull().default(false),
  parentId: bigint('parent_id', { mode: 'number' }),
  path: ltree('path').notNull().default(sql`'placeholder'::ltree`),
  status: nodeStatusEnum('status').default('todo'),
  metaDescription: text('meta_description'),
  deadline: timestamp('deadline', { withTimezone: true }),
  notes: text('notes'),
  partsCompleted: integer('parts_completed').default(0),
  data: jsonb('data')
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
