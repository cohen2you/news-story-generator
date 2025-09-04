import { NextResponse } from 'next/server';
import CopyleaksService from '@/lib/copyleaks';

export async function GET(request: Request) {
  try {
    if (!process.env.COPYLEAKS_API_KEY) {
      return NextResponse.json(
        { error: 'Copyleaks API key not configured.' },
        { status: 500 }
      );
    }

    const copyleaksService = new CopyleaksService(process.env.COPYLEAKS_API_KEY);
    
    // Test authentication
    console.log('Testing Copyleaks authentication...');
    const token = await (copyleaksService as any).authenticate();
    
    return NextResponse.json({
      success: true,
      message: 'Copyleaks authentication successful',
      tokenLength: token.length,
      environment: {
        hasApiKey: !!process.env.COPYLEAKS_API_KEY,
        hasEmail: !!process.env.COPYLEAKS_EMAIL,
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        nodeEnv: process.env.NODE_ENV,
      }
    });

  } catch (error: any) {
    console.error('Copyleaks test error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Copyleaks test failed.',
        environment: {
          hasApiKey: !!process.env.COPYLEAKS_API_KEY,
          hasEmail: !!process.env.COPYLEAKS_EMAIL,
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          nodeEnv: process.env.NODE_ENV,
        }
      },
      { status: 500 }
    );
  }
}
