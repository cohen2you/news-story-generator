import { NextRequest, NextResponse } from 'next/server';
import { aiProvider, AIProvider } from '@/lib/aiProvider';

export async function GET() {
  try {
    return NextResponse.json({
      provider: aiProvider.getCurrentProvider(),
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasGemini: !!process.env.GEMINI_API_KEY, // Show option if API key is configured
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get AI provider' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body;
    
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      await aiProvider.setProvider(provider);
      return NextResponse.json({
        success: true,
        provider: aiProvider.getCurrentProvider(),
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "openai" or "gemini"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to set AI provider' },
      { status: 500 }
    );
  }
}

