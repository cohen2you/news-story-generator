import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== SCAN ARTICLE API CALLED ===');
    
    const { articleType, text } = await request.json();
    
    console.log(`Scanning ${articleType} article`);
    console.log('Text length:', text?.length || 0);
    
    if (!text) {
      console.log('ERROR: Missing text');
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('=== STARTING ARTICLE SCAN ===');
    
    // Clean and normalize the text
    const cleanText = text
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const words = cleanText.split(' ').filter((word: string) => word.length > 0);
    
    console.log(`Article has ${words.length} words`);
    console.log('First 20 words:', words.slice(0, 20));
    
    // For now, we'll return empty segments since we need both articles to compare
    // This endpoint will be used to prepare the text for comparison
    const segments: Array<{start: number, end: number, words: string[]}> = [];
    
    console.log(`Scan completed for ${articleType} article`);
    console.log('=== ARTICLE SCAN COMPLETED ===');
    
    return NextResponse.json({
      success: true,
      segments: segments,
      totalSegments: segments.length,
      wordCount: words.length
    });
    
  } catch (error) {
    console.error('Error in scan-article API:', error);
    return NextResponse.json({ error: 'Failed to scan article' }, { status: 500 });
  }
}
