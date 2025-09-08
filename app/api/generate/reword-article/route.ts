import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== REWORD ARTICLE API CALLED ===');
    
    const { prompt, currentArticle } = await request.json();
    
    console.log('Current article length:', currentArticle?.length || 0);
    
    if (!prompt || !currentArticle) {
      console.log('ERROR: Missing prompt or current article');
      return NextResponse.json({ error: 'Prompt and current article are required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not set!');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    console.log('=== STARTING REWORD PROCESS ===');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent rewording
      max_tokens: 3000,
    });

    const rewordedArticle = completion.choices[0].message.content?.trim();
    
    if (!rewordedArticle) {
      console.error('No reworded article returned from OpenAI');
      return NextResponse.json({ error: 'Failed to reword article' }, { status: 500 });
    }

    console.log('=== REWORD COMPLETE ===');
    console.log('Reworded article length:', rewordedArticle.length);
    
    return NextResponse.json({
      success: true,
      rewordedArticle: rewordedArticle
    });
    
  } catch (error) {
    console.error('Error in reword-article API:', error);
    return NextResponse.json({ error: 'Failed to reword article' }, { status: 500 });
  }
}
