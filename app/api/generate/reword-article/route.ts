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
    console.log('Prompt length:', prompt.length);
    console.log('Current article length:', currentArticle.length);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert financial journalist and editor with exceptional skills in rewriting content to avoid plagiarism while maintaining accuracy and readability. You excel at finding creative alternatives to common phrases and restructuring sentences to sound completely different while preserving all factual information. CRITICAL JOURNALISTIC INTEGRITY RULES: 1) You must NEVER modify, remove, or change any existing direct quotes (text within quotation marks) - they must be preserved exactly as they are. 2) You must NEVER create new quotes or add quotation marks to text that was not already quoted. 3) You must NEVER fabricate quotes or attribute words to people that they did not actually say.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Low temperature for minimal, conservative changes
      max_tokens: 5000,
    });

    let rewordedArticle = completion.choices[0].message.content?.trim();
    
    if (!rewordedArticle) {
      console.error('No reworded article returned from OpenAI');
      return NextResponse.json({ error: 'Failed to reword article' }, { status: 500 });
    }

    // Clean up any markdown formatting that might have been added
    rewordedArticle = rewordedArticle
      .replace(/^```html\s*/i, '')  // Remove ```html at the start
      .replace(/^```\s*/i, '')      // Remove ``` at the start
      .replace(/\s*```$/i, '')      // Remove ``` at the end
      .trim();

    // Check for potential quote fabrication
    const originalQuotes = (currentArticle.match(/"([^"]+)"/g) || []).length;
    const newQuotes = (rewordedArticle.match(/"([^"]+)"/g) || []).length;
    
    if (newQuotes > originalQuotes) {
      console.warn(`⚠️ WARNING: AI may have created new quotes. Original: ${originalQuotes}, New: ${newQuotes}`);
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
