import { NextResponse } from 'next/server';
import CopyleaksService from '@/lib/copyleaks';

export async function POST(request: Request) {
  try {
    if (!process.env.COPYLEAKS_API_KEY) {
      return NextResponse.json(
        { error: 'Copyleaks API key not configured.' },
        { status: 500 }
      );
    }

    const { content, filename } = await request.json();

    if (!content || !filename) {
      return NextResponse.json(
        { error: 'Content and filename are required.' },
        { status: 400 }
      );
    }

    const copyleaksService = new CopyleaksService(process.env.COPYLEAKS_API_KEY);
    
    // Generate a unique scan ID
    const scanId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Testing Copyleaks scan submission...');
    const result = await copyleaksService.submitScan(content, filename, scanId);
    
    return NextResponse.json({
      success: true,
      message: 'Copyleaks scan submitted successfully',
      scanId: result.scanId,
      status: result.status,
    });

  } catch (error: any) {
    console.error('Copyleaks test scan error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Copyleaks test scan failed.',
        details: error.stack
      },
      { status: 500 }
    );
  }
}
