BEGIN;

-- Enable pg_trgm extension for fuzzy text search and similarity functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMIT;
