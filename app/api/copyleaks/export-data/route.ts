import { NextResponse } from 'next/server';
import { getExportedData } from '@/lib/copyleaks-storage';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.searchParams.get('scanId');
    const resultId = url.searchParams.get('resultId');

    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId parameter' }, { status: 400 });
    }

    const results: any = {};

    // Get completed export data
    const completedKey = `completed-${scanId}`;
    const completedData = getExportedData(completedKey);
    if (completedData) {
      results.completed = completedData.data;
    }

    // Get source export data
    const sourceKey = `source-${scanId}`;
    const sourceData = getExportedData(sourceKey);
    if (sourceData) {
      results.source = sourceData.data;
    }

    // Get specific result data if resultId is provided
    if (resultId) {
      const resultKey = `result-${scanId}-${resultId}`;
      const resultData = getExportedData(resultKey);
      if (resultData) {
        results.result = resultData.data;
      }
    }

    return NextResponse.json({
      scanId,
      resultId,
      hasData: Object.keys(results).length > 0,
      data: results,
    });

  } catch (error: any) {
    console.error('Export data retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve export data.' },
      { status: 500 }
    );
  }
}
