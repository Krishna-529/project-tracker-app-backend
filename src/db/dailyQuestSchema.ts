import { pgTable, uuid, text, boolean, timestamp, integer, varchar, jsonb, pgSchema } from 'drizzle-orm/pg-core';

// Reference to Supabase auth schema (read-only)
export const authSchema = pgSchema('auth');

// Supabase auth.users table (read-only reference - we only query this)
export const users = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }),
  rawAppMetaData: jsonb('raw_app_meta_data'),
  rawUserMetaData: jsonb('raw_user_meta_data'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// Tasks table for Daily Quest integration
// This table references Supabase auth.users (the existing users table)
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(), // References auth.users.id
  projectId: uuid('project_id'),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  priority: text('priority').notNull().default('medium'),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  projectTags: text('project_tags').array(),
  pinnedScope: text('pinned_scope'),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }),
  orderIndex: integer('order_index'),
  // Store Project Tracker info for reference
  projectTrackerNodeId: integer('project_tracker_node_id'),
  isProject: boolean('is_project').notNull().default(false),
});
