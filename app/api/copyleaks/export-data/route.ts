import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.searchParams.get('scanId');
    const resultId = url.searchParams.get('resultId');

    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId parameter' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const results: any = {};

    // Get completed export data
    try {
      const completedResponse = await fetch(`${baseUrl}/api/copyleaks/export/${scanId}/completed`);
      if (completedResponse.ok) {
        const completedData = await completedResponse.json();
        if (completedData.status !== 'not_found') {
          results.completed = completedData.data;
        }
      }
    } catch (error) {
      console.error('Error fetching completed data:', error);
    }

    // Get source export data
    try {
      const sourceResponse = await fetch(`${baseUrl}/api/copyleaks/export/${scanId}/source`);
      if (sourceResponse.ok) {
        const sourceData = await sourceResponse.json();
        if (sourceData.status !== 'not_found') {
          results.source = sourceData.data;
        }
      }
    } catch (error) {
      console.error('Error fetching source data:', error);
    }

    // Get specific result data if resultId is provided
    if (resultId) {
      try {
        const resultResponse = await fetch(`${baseUrl}/api/copyleaks/export/${scanId}/results/${resultId}`);
        if (resultResponse.ok) {
          const resultData = await resultResponse.json();
          if (resultData.status !== 'not_found') {
            results.result = resultData.data;
          }
        }
      } catch (error) {
        console.error('Error fetching result data:', error);
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
