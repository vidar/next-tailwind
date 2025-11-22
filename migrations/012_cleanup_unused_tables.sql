-- Migration 012: Remove unused tables
-- These tables are not referenced in the codebase and can be safely removed

-- Tables to drop:
-- 1. analysis_requests (37 rows) - Not used in codebase
-- 2. video_generation_requests (31 rows) - Not used in codebase
-- 3. user_sessions (0 rows) - Not used, Clerk handles sessions
-- 4. users (1 row) - Not used, Clerk handles user management
-- 5. schema_migrations (0 rows) - Not needed

-- Using CASCADE to handle foreign key constraints
DROP TABLE IF EXISTS analysis_requests CASCADE;
DROP TABLE IF EXISTS video_generation_requests CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
