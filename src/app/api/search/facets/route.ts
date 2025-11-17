import { NextRequest, NextResponse } from 'next/server';
import { getFacets, INDEXES } from '@/lib/meilisearch';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const index = searchParams.get('index') || INDEXES.GAMES;

    // Define facets for each index
    const facetsByIndex: Record<string, string[]> = {
      [INDEXES.GAMES]: [
        'status',
        'result',
        'opening_eco',
        'has_annotations',
        'tournament_id',
      ],
      [INDEXES.VIDEOS]: [
        'status',
        'composition_type',
        'has_youtube_url',
      ],
      [INDEXES.TOURNAMENTS]: [
        'tournament_type',
        'country_code',
      ],
      [INDEXES.PLAYERS]: [
        'type',
        'title',
        'country_code',
        'platform',
      ],
    };

    const facets = facetsByIndex[index] || [];
    const facetDistribution = await getFacets(index, facets);

    return NextResponse.json({
      success: true,
      index,
      facets: facetDistribution,
    });
  } catch (error) {
    console.error('Facets error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get facets',
      },
      { status: 500 }
    );
  }
}
