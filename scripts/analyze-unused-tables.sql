-- Database Cleanup Analysis
-- Tables that appear to be UNUSED and can be dropped:

-- 1. analysis_requests (37 rows) - Not referenced in any source code
--    DROP TABLE analysis_requests;

-- 2. user_sessions (0 rows, empty) - Not used in code, Clerk handles sessions
--    DROP TABLE user_sessions;

-- 3. users (1 row) - Not used in code, Clerk handles user management
--    DROP TABLE users;

-- 4. video_generation_requests (31 rows) - Not referenced in any source code
--    DROP TABLE video_generation_requests;

-- 5. schema_migrations (0 rows, empty) - Can be dropped if not using a migration tool that requires it
--    DROP TABLE schema_migrations;


-- VERIFICATION: Run these queries to confirm no foreign key dependencies
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (
  ccu.table_name IN ('analysis_requests', 'user_sessions', 'users', 'video_generation_requests', 'schema_migrations')
  OR tc.table_name IN ('analysis_requests', 'user_sessions', 'users', 'video_generation_requests', 'schema_migrations')
);

-- If the above query returns no rows, these tables can be safely dropped:
-- DROP TABLE IF EXISTS analysis_requests;
-- DROP TABLE IF EXISTS user_sessions;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS video_generation_requests;
-- DROP TABLE IF EXISTS schema_migrations;
