import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';

export async function POST(request: Request) {
  try {
    const { articleText, style } = await request.json();

    if (!articleText?.trim()) {
      return NextResponse.json({ lead: '', error: 'Article text is required.' });
    }

    // Sanitize style input and set defaults
    const styleOptions = ['longer', 'shorter', 'more narrative', 'more context'];
    const chosenStyle = styleOptions.includes(style?.toLowerCase()) ? style.toLowerCase() : 'normal';

    const prompt = `
You are a professional financial journalist writing for a high-traffic news site.

Based on the article below, generate a lead paragraph that is ${chosenStyle} in length and tone.

Article:
${articleText}

Lead paragraph:
`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
    const maxTokens = currentProvider === 'gemini' ? 8192 : 250;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.7,
      }
    );

    const lead = response.content.trim();

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Error generating lead:', error);
    return NextResponse.json({ lead: '', error: 'Failed to generate lead paragraph.' }, { status: 500 });
  }
}
