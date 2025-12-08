import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';

export async function POST(req: Request) {
  try {
    const { finalStory, narrativeOption } = await req.json();

    if (!finalStory || finalStory.trim() === '') {
      return NextResponse.json({ error: 'finalStory is required' }, { status: 400 });
    }
    if (!narrativeOption || narrativeOption.trim() === '') {
      return NextResponse.json({ error: 'narrativeOption is required' }, { status: 400 });
    }

    const prompt = `You are an expert financial journalist. Using the original news story below and the chosen narrative option, write a 300-400 word narrative story that expands on the news with insightful analysis, storytelling, and context.

Original News Story:
${finalStory}

Chosen Narrative Option:
${narrativeOption}

Narrative Story:
`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
    const maxTokens = currentProvider === 'gemini' ? 8192 : 700;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.75,
      }
    );

    const narrative = response.content;

    return NextResponse.json({ narrative });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unexpected error occurred' },
      { status: 500 }
    );
  }
}
