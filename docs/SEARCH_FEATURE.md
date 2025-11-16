# Search Feature Documentation

## Overview

This chess analysis platform now features a powerful AI-powered search system built on Meilisearch. It enables semantic search across chess games, videos, tournaments, and players with advanced filtering and faceted search capabilities.

## Features

### 1. AI-Powered Hybrid Search
- **Semantic Search**: Uses OpenAI embeddings to understand context and meaning
- **Keyword Search**: Traditional full-text search for precise matches
- **Hybrid Mode**: Combines both approaches for best results (default)
- **Configurable**: Toggle AI features on/off based on needs

### 2. Multi-Index Search
Search across multiple data types simultaneously:
- **Chess Games**: Player names, openings, results, annotations
- **Videos**: Game metadata, composition types, YouTube status
- **Tournaments**: Names, locations, players, dates
- **Players**: FIDE profiles and platform usernames

### 3. Faceted Search & Filtering
- **Dynamic Facets**: Automatic facet generation with counts
- **Filters**: Status, result, opening, tournament type, etc.
- **Date Ranges**: Search by game/tournament dates
- **Annotations**: Filter games with user annotations
- **Real-time Updates**: Facet counts update with search results

### 4. Background Sync
- **Automatic Indexing**: New data automatically synced to Meilisearch
- **Manual Sync**: API endpoints for on-demand synchronization
- **Batch Processing**: Efficient bulk indexing for large datasets

## Architecture

### Components

```
src/
├── lib/
│   └── meilisearch.ts          # Core Meilisearch service
├── app/
│   ├── search/
│   │   └── page.tsx            # Search UI component
│   └── api/
│       └── search/
│           ├── route.ts        # Unified search endpoint
│           ├── facets/route.ts # Facet distribution endpoint
│           └── sync/route.ts   # Background sync service
└── scripts/
    └── index-meilisearch.ts    # Initial data indexing script
```

### Data Flow

```
User Query → Search UI → API Endpoint → Meilisearch → Results
                                ↓
                        Database (PostgreSQL)
                                ↓
                        Background Sync → Meilisearch Indexes
```

## Setup Instructions

### 1. Install Meilisearch

**Option A: Docker (Recommended)**
```bash
docker run -d \
  --name meilisearch \
  -p 7700:7700 \
  -e MEILI_MASTER_KEY=your_master_key_here \
  -v meilisearch-data:/meili_data \
  getmeili/meilisearch:latest
```

**Option B: Binary Download**
```bash
# macOS/Linux
curl -L https://install.meilisearch.com | sh

# Run
./meilisearch --master-key=your_master_key_here
```

**Option C: Cloud**
Sign up for Meilisearch Cloud at https://cloud.meilisearch.com

### 2. Configure Environment Variables

Add to `.env.local`:
```env
# Meilisearch
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=your_master_key_here

# OpenAI (for AI-powered search)
OPENAI_API_KEY=sk-your-openai-api-key

# Database (already configured)
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

### 3. Initialize Indexes

Run the indexing script to populate Meilisearch with existing data:

```bash
npm run search:index
```

This will:
- Create and configure all indexes (games, videos, tournaments, players)
- Set up AI embedders for semantic search
- Index all existing database content
- Configure faceted attributes and filters

### 4. Verify Setup

Visit http://localhost:3000/search to test the search interface.

## Usage Guide

### Basic Search

Navigate to `/search` and enter a query:
- **Player names**: "Magnus Carlsen"
- **Openings**: "Sicilian Defense"
- **Tournaments**: "World Championship"
- **Mixed queries**: "Carlsen Sicilian 2024"

### Advanced Filters

Use the sidebar to filter results:
- **Status**: Filter by analysis/video status
- **Result**: 1-0, 0-1, 1/2-1/2
- **Annotations**: Only games with user annotations
- **Tournament Type**: Round robin, Swiss, etc.

### Index Selection

Choose which data types to search:
- **All**: Search across all indexes
- **Games**: Chess games only
- **Videos**: Generated videos only
- **Tournaments**: Tournament records only
- **Players**: FIDE and platform players only

### AI Toggle

Enable/disable AI-powered semantic search:
- **On** (default): Uses OpenAI embeddings for context-aware search
- **Off**: Traditional keyword-only search

## API Reference

### Unified Search

**Endpoint**: `GET /api/search`

**Query Parameters**:
- `q` (string): Search query
- `indexes` (string, optional): Comma-separated index names
- `limit` (number, optional): Results per index (default: 20)
- `hybrid` (boolean, optional): Enable hybrid search (default: true)
- `status` (string, optional): Filter by status
- `result` (string, optional): Filter by game result
- `opening_eco` (string, optional): Filter by ECO code
- `tournament_type` (string, optional): Filter by tournament type
- `composition_type` (string, optional): Filter by video composition type
- `has_annotations` (boolean, optional): Filter games with annotations
- `has_youtube_url` (boolean, optional): Filter videos on YouTube
- `title` (string, optional): Filter players by title
- `country` (string, optional): Filter by country code
- `date_from` (string, optional): Start date filter
- `date_to` (string, optional): End date filter

**Example**:
```bash
curl "http://localhost:3000/api/search?q=Magnus+Carlsen&indexes=chess_games&result=1-0&hybrid=true"
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "hits": [...],
      "query": "Magnus Carlsen",
      "processingTimeMs": 12,
      "estimatedTotalHits": 42,
      "indexUid": "chess_games"
    }
  ],
  "query": "Magnus Carlsen",
  "hybrid": true
}
```

### Facets

**Endpoint**: `GET /api/search/facets`

**Query Parameters**:
- `index` (string): Index name (default: chess_games)

**Example**:
```bash
curl "http://localhost:3000/api/search/facets?index=chess_games"
```

**Response**:
```json
{
  "success": true,
  "index": "chess_games",
  "facets": {
    "status": { "completed": 150, "processing": 5 },
    "result": { "1-0": 60, "0-1": 55, "1/2-1/2": 35 },
    "opening_eco": { "B20": 15, "C50": 12, "E20": 10 }
  }
}
```

### Background Sync

**Endpoint**: `POST /api/search/sync`

**Body**:
```json
{
  "action": "index | update | delete",
  "type": "game | video | tournament | player",
  "id": "resource-id"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/search/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "index", "type": "game", "id": "game-uuid"}'
```

**Full Re-index**:
```bash
curl "http://localhost:3000/api/search/sync?full=true"
```

## Meilisearch Configuration

### Index Settings

Each index has optimized settings for its data type:

**Chess Games**:
```javascript
{
  searchableAttributes: [
    'white_player',
    'black_player',
    'opening_name',
    'opening_eco',
    'tournament_name',
    'annotation_text',
    'search_text'
  ],
  filterableAttributes: [
    'status',
    'result',
    'opening_eco',
    'has_annotations',
    'tournament_id',
    'date',
    'created_at'
  ],
  sortableAttributes: ['date', 'created_at'],
  embedders: {
    default: {
      source: 'openAi',
      model: 'text-embedding-3-small',
      documentTemplate: "A chess game between {{doc.white_player}} (White) and {{doc.black_player}} (Black) with result {{doc.result}}. Opening: {{doc.opening_name}}. {{doc.annotation_text}}"
    }
  }
}
```

Similar optimized settings exist for videos, tournaments, and players.

### AI Embeddings

The system uses OpenAI's `text-embedding-3-small` model for semantic search:
- **Cost-effective**: ~$0.02 per 1M tokens
- **Fast**: Low latency for real-time search
- **Accurate**: 1536-dimensional embeddings
- **Context-aware**: Understands chess terminology and concepts

### Hybrid Search Parameters

```javascript
{
  semanticRatio: 0.5  // Balance between semantic (0.0) and keyword (1.0)
}
```

Adjust `semanticRatio` based on your needs:
- **0.0**: Pure semantic search (best for conceptual queries)
- **0.5**: Balanced (recommended default)
- **1.0**: Pure keyword search (best for exact matches)

## Maintenance

### Re-indexing

Full re-index all data:
```bash
npm run search:index
```

Or via API:
```bash
curl "http://localhost:3000/api/search/sync?full=true"
```

### Monitoring

Check Meilisearch dashboard:
```bash
open http://localhost:7700
```

View index statistics:
```bash
curl http://localhost:7700/indexes/chess_games/stats \
  -H "Authorization: Bearer your_master_key"
```

### Performance Tuning

**Index Settings**:
- Adjust `rankingRules` for result ordering
- Add more `filterableAttributes` as needed
- Optimize `searchableAttributes` order

**Caching**:
- Meilisearch has built-in caching
- Results are cached for identical queries
- Cache clears on document updates

**Scaling**:
- Meilisearch handles millions of documents efficiently
- Use Meilisearch Cloud for auto-scaling
- Consider read replicas for high traffic

## Troubleshooting

### Connection Issues

**Error**: "Failed to connect to Meilisearch"

**Solutions**:
1. Verify Meilisearch is running: `curl http://localhost:7700/health`
2. Check `MEILISEARCH_HOST` in `.env.local`
3. Verify `MEILISEARCH_MASTER_KEY` is correct
4. Check firewall/network settings

### OpenAI API Issues

**Error**: "OpenAI API key invalid"

**Solutions**:
1. Verify `OPENAI_API_KEY` in `.env.local`
2. Check API key permissions at https://platform.openai.com
3. Ensure billing is set up on OpenAI account
4. Disable hybrid search as fallback

### Empty Results

**Issue**: Search returns no results

**Solutions**:
1. Run initial indexing: `npm run search:index`
2. Check if indexes exist: Visit http://localhost:7700
3. Verify database has data
4. Check search query syntax

### Slow Performance

**Issue**: Search takes too long

**Solutions**:
1. Optimize `searchableAttributes` order
2. Reduce `limit` parameter
3. Disable hybrid search for faster keyword-only search
4. Check Meilisearch server resources
5. Consider upgrading to Meilisearch Cloud

## Best Practices

### Search Query Tips

1. **Player Names**: Use full names or common abbreviations
2. **Openings**: Include ECO codes for precision
3. **Dates**: Use ISO format (YYYY-MM-DD) in filters
4. **Multiple Terms**: Use spaces between terms
5. **Exact Matches**: Use quotes for exact phrases

### Indexing Strategy

1. **Incremental Updates**: Use `/api/search/sync` for single items
2. **Batch Updates**: Use full re-index for major changes
3. **Schedule**: Run full re-index weekly/monthly
4. **Monitor**: Check index sizes and performance

### Cost Optimization

1. **OpenAI Embeddings**: Only enable for important searches
2. **Caching**: Leverage Meilisearch's built-in cache
3. **Limits**: Set reasonable result limits (20-50)
4. **Batching**: Batch document updates when possible

## Future Enhancements

Potential improvements:
- [ ] Multi-modal search (upload chess positions)
- [ ] Search suggestions/autocomplete
- [ ] Advanced query syntax (AND, OR, NOT)
- [ ] Search analytics and popular queries
- [ ] Saved searches and search history
- [ ] Export search results
- [ ] Voice search integration
- [ ] Mobile app search optimization

## Support

For issues or questions:
- Check Meilisearch docs: https://docs.meilisearch.com
- Review OpenAI API docs: https://platform.openai.com/docs
- File issues on project repository
