import { NextResponse } from 'next/server';
import { getPrimaryPrompt } from '../../../../lib/prompts/primary';
import { MODEL_CONFIG } from '../../../../lib/api';
import { aiProvider } from '@/lib/aiProvider';

const MODEL = 'gpt-4o';

export async function POST(req: Request) {
  try {
    const { sourceUrl, articleText } = await req.json();

    if (!sourceUrl && !articleText) {
      return NextResponse.json({ error: 'Missing sourceUrl or articleText' }, { status: 400 });
    }

    // Construct a prompt - adjust this as you want
    const prompt = `Write a concise Lead and What Happened section based ONLY on this article content:\n\n${articleText}`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
    const maxTokens = currentProvider === 'gemini' ? 8192 : 800;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.5,
      }
    );

    const generatedText = response.content.trim();

    return NextResponse.json({ result: generatedText });
  } catch (error: any) {
    console.error('Error in /api/generate/primary:', error);
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}
