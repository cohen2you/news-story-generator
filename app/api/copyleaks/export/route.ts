import { NextResponse } from 'next/server';
import CopyleaksService from '@/lib/copyleaks';

export async function POST(request: Request) {
  try {
    const { scanId, resultId, format = 'json' } = await request.json();

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
    
    const exportData = await copyleaksService.exportResult(scanId, resultId, format);

    return NextResponse.json({
      success: true,
      data: exportData,
      format,
    });

  } catch (error: any) {
    console.error('Copyleaks export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export Copyleaks result.' },
      { status: 500 }
    );
  }
}
