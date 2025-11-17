import { NextRequest, NextResponse } from 'next/server';
import { unifiedSearch, getFacets, INDEXES } from '@/lib/meilisearch';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const indexes = searchParams.get('indexes')?.split(',') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const hybrid = searchParams.get('hybrid') !== 'false'; // Default to true

    // Parse filters
    const filters: Record<string, any> = {};
    const status = searchParams.get('status');
    const result = searchParams.get('result');
    const openingEco = searchParams.get('opening_eco');
    const tournamentType = searchParams.get('tournament_type');
    const compositionType = searchParams.get('composition_type');
    const hasAnnotations = searchParams.get('has_annotations');
    const hasYoutubeUrl = searchParams.get('has_youtube_url');
    const playerTitle = searchParams.get('title');
    const country = searchParams.get('country');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    // Build filters object
    if (status) filters.status = status;
    if (result) filters.result = result;
    if (openingEco) filters.opening_eco = openingEco;
    if (tournamentType) filters.tournament_type = tournamentType;
    if (compositionType) filters.composition_type = compositionType;
    if (hasAnnotations !== null) filters.has_annotations = hasAnnotations === 'true';
    if (hasYoutubeUrl !== null) filters.has_youtube_url = hasYoutubeUrl === 'true';
    if (playerTitle) filters.title = playerTitle;
    if (country) filters.country_code = country;

    // Date range filters
    if (dateFrom || dateTo) {
      const dateFilter = [];
      if (dateFrom) dateFilter.push(`created_at >= ${new Date(dateFrom).getTime()}`);
      if (dateTo) dateFilter.push(`created_at <= ${new Date(dateTo).getTime()}`);
      filters.date_range = dateFilter.join(' AND ');
    }

    // Perform search
    const results = await unifiedSearch(query, {
      indexes,
      limit,
      filters,
      hybrid,
    });

    return NextResponse.json({
      success: true,
      results,
      query,
      hybrid,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      },
      { status: 500 }
    );
  }
}
