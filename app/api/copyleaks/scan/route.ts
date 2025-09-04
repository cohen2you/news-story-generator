import { NextResponse } from 'next/server';
import CopyleaksService from '@/lib/copyleaks';

export async function POST(request: Request) {
  try {
    const { sourceArticle, finalArticle } = await request.json();

    if (!sourceArticle || !finalArticle) {
      return NextResponse.json(
        { error: 'Both sourceArticle and finalArticle are required.' },
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
    
    const result = await copyleaksService.compareArticles(sourceArticle, finalArticle);

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Scans submitted successfully. Results will be available via webhook.',
    });

  } catch (error: any) {
    console.error('Copyleaks scan error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit Copyleaks scan.' },
      { status: 500 }
    );
  }
}
