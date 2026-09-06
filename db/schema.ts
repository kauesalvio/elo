import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    inviteHash: text('invite_hash').notNull(),
    adminHash: text('admin_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    revoked: integer('revoked').notNull().default(0),
  },
  (table) => [index('rooms_expiry_idx').on(table.expiresAt)],
);

export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [index('limits_expiry_idx').on(table.expiresAt)],
);
