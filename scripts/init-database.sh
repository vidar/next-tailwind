#!/bin/bash

# Database initialization script for Chess Moments
# This script creates a fresh database from scratch using the complete schema migration

set -e  # Exit on any error

echo "🚀 Chess Moments Database Initialization Script"
echo "================================================"

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
    echo "⚠️  Warning: .env file not found. Make sure DB_* environment variables are set."
fi

# Check required environment variables
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "❌ Error: Missing required environment variables."
    echo "   Required: DB_HOST, DB_USER, DB_NAME, DB_PASSWORD"
    exit 1
fi

# Set defaults
DB_PORT=${DB_PORT:-5432}

echo ""
echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Ask for confirmation
read -p "⚠️  This will DROP the existing database if it exists. Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Aborted."
    exit 0
fi

echo ""
echo "🗑️  Dropping existing database (if exists)..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1 | grep -v "does not exist" || true

echo "✨ Creating fresh database..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "📝 Running complete schema migration..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/000_init_complete_schema.sql

echo ""
echo "✅ Database initialization complete!"
echo ""
echo "Database: $DB_NAME"
echo "Tables created: 8"
echo "  - chess_analyses"
echo "  - videos"
echo "  - game_annotations"
echo "  - tournaments"
echo "  - players"
echo "  - tournament_players"
echo "  - tournament_rounds"
echo "  - tournament_games"
echo ""
echo "Additional objects:"
echo "  - Indexes: Multiple performance indexes"
echo "  - Triggers: Automatic updated_at timestamp updates"
echo "  - Views: recent_analyses, tournament_standings"
echo "  - Constraints: Foreign keys, check constraints, unique constraints"
echo ""
echo "🎉 Your database is ready to use!"
