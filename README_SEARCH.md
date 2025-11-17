# Chess Moments - AI-Powered Search

## Quick Start

### 1. Install Meilisearch

**Docker (Recommended)**:
```bash
docker run -d \
  --name meilisearch \
  -p 7700:7700 \
  -e MEILI_MASTER_KEY=change_me_to_a_secure_key \
  -v meilisearch-data:/meili_data \
  getmeili/meilisearch:latest
```

### 2. Configure Environment

Add to `.env.local`:
```env
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=change_me_to_a_secure_key
OPENAI_API_KEY=sk-your-openai-api-key
```

### 3. Index Your Data

```bash
npm run search:index
```

### 4. Start Searching

Visit http://localhost:3000/search

## Features

- **AI-Powered Semantic Search** - Understands context and meaning
- **Multi-Index Search** - Search games, videos, tournaments, and players
- **Faceted Filtering** - Dynamic filters with result counts
- **Real-time Sync** - Automatic indexing of new data
- **Hybrid Search** - Combines keyword and semantic search

## Search Examples

- "Magnus Carlsen Sicilian Defense"
- "World Championship 2024"
- "games with brilliant moves"
- "tournament in Norway"

## Documentation

See [docs/SEARCH_FEATURE.md](docs/SEARCH_FEATURE.md) for complete documentation.

## API Endpoints

- `GET /api/search` - Unified search across all indexes
- `GET /api/search/facets` - Get facet distributions
- `POST /api/search/sync` - Sync individual items
- `GET /api/search/sync?full=true` - Full re-index

## Maintenance

**Re-index all data**:
```bash
npm run search:index
```

**Check Meilisearch status**:
```bash
curl http://localhost:7700/health
```

**View indexes**:
Visit http://localhost:7700 in your browser

## Troubleshooting

**No results found**:
1. Run `npm run search:index`
2. Check Meilisearch is running: `curl http://localhost:7700/health`
3. Verify environment variables

**AI search not working**:
1. Check `OPENAI_API_KEY` is valid
2. Ensure OpenAI billing is set up
3. Toggle off "AI-powered search" for keyword-only mode

## Architecture

```
┌─────────────┐
│   User UI   │
│  /search    │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│ Search API  │────▶│ Meilisearch  │
│ /api/search │     │   Indexes    │
└──────┬──────┘     └──────────────┘
       │                    ▲
       │                    │
       ▼                    │
┌─────────────┐     ┌──────┴───────┐
│  Database   │────▶│  Sync API    │
│ PostgreSQL  │     │ /api/search/ │
└─────────────┘     │    sync      │
                    └──────────────┘
```

## Costs

**Meilisearch**: Free (self-hosted) or Cloud plans starting at $29/mo
**OpenAI Embeddings**: ~$0.02 per 1M tokens (~$0.001 per 1000 games indexed)

## License

Same as main project license.
