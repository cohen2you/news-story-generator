import { NextResponse } from 'next/server';
import CopyleaksService from '@/lib/copyleaks';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.searchParams.get('scanId');
    const resultId = url.searchParams.get('resultId');

    if (!scanId || !resultId) {
      return NextResponse.json(
        { error: 'Both scanId and resultId are required.' },
        { status: 400 }
      );
    }

    if (!process.env.COPYLEAKS_API_KEY) {
      return NextResponse.json(
        { error: 'Copyleaks API key not configured.' },
        { status: 500 }
      );
    }

    const copyleaksService = new CopyleaksService(process.env.COPYLEAKS_API_KEY);
    
    const detailedResult = await copyleaksService.getDetailedResult(scanId, resultId);

    return NextResponse.json({
      success: true,
      result: detailedResult,
    });

  } catch (error: any) {
    console.error('Copyleaks detailed result error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get detailed result.' },
      { status: 500 }
    );
  }
}
