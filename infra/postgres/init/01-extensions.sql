-- Extensions the schema relies on. Prisma migrations create them too; this
-- file only makes a freshly created container match a migrated database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy search over names
CREATE EXTENSION IF NOT EXISTS unaccent;    -- accent-insensitive search
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE constraint on leave dates
