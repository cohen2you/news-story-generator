import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { article, sourceText } = body;

    if (!article) {
      return NextResponse.json(
        { error: 'Article content is required.' },
        { status: 400 }
      );
    }

    // Step 1: Extract and preserve all hyperlinks
    const hyperlinkRegex = /<a[^>]+>.*?<\/a>/g;
    const hyperlinks = article.match(hyperlinkRegex) || [];
    const hyperlinkPlaceholders = hyperlinks.map((_: string, index: number) => `[HYPERLINK_${index}]`);
    
    // Replace hyperlinks with placeholders
    let articleWithoutLinks = article;
    hyperlinks.forEach((link: string, index: number) => {
      articleWithoutLinks = articleWithoutLinks.replace(link, `[HYPERLINK_${index}]`);
    });

    // Step 2: Condense the content without hyperlinks
    const condensePrompt = `You are an expert financial editor. Condense the following article to less than 600 words (target 500-550) by:

1. Shortening sentences and paragraphs while keeping the same meaning
2. Removing redundant phrases and unnecessary words  
3. Combining similar ideas into single, more concise statements
4. NEVER remove or modify any [HYPERLINK_X] placeholders - they are sacred
5. NEVER remove the "Read Next" section

SOURCE MATERIAL (for similarity checking):
${sourceText || 'No source material provided'}

ARTICLE TO CONDENSE:
${articleWithoutLinks}

Please provide your response in this exact format:

CONDENSED ARTICLE:
[Your condensed article with ALL [HYPERLINK_X] placeholders preserved exactly]

CHANGES MADE:
• [First change - max 15 words]
• [Second change - max 15 words] 
• [Third change - max 15 words]`;

    const condensedResult = await callOpenAI(condensePrompt);
    const condensedMatch = condensedResult.match(/CONDENSED ARTICLE:\s*([\s\S]*?)(?=CHANGES MADE:|$)/);
    const changesMatch = condensedResult.match(/CHANGES MADE:\s*([\s\S]*?)(?=\n\n|$)/);
    
    let condensedArticle = condensedMatch ? condensedMatch[1].trim() : condensedResult;

    // Step 3: Restore hyperlinks to their original positions
    let finalArticle = condensedArticle;
    hyperlinks.forEach((link: string, index: number) => {
      const placeholder = `[HYPERLINK_${index}]`;
      if (finalArticle.includes(placeholder)) {
        finalArticle = finalArticle.replace(placeholder, link);
      }
    });

    // Validate that all hyperlinks were restored
    const finalLinks = (finalArticle.match(/<a[^>]+>.*?<\/a>/g) || []).length;
    const originalLinks = hyperlinks.length;
    
    if (finalLinks !== originalLinks) {
      // If hyperlinks were lost, return the original article with a warning
      return NextResponse.json({ 
        reviewedArticle: article,
        changes: ['Editorial review skipped - hyperlink preservation failed'],
        originalWordCount: article.split(/\s+/).length,
        newWordCount: article.split(/\s+/).length,
        warning: 'Could not preserve all hyperlinks during condensation'
      });
    }

    const changes = changesMatch 
      ? changesMatch[1]
          .split('\n')
          .filter((line: string) => line.trim().startsWith('•'))
          .map((line: string) => line.replace('•', '').trim())
          .filter((change: string) => change.length > 0)
          .slice(0, 3)
      : [];

    return NextResponse.json({ 
      reviewedArticle: finalArticle,
      changes,
      originalWordCount: article.split(/\s+/).length,
      newWordCount: finalArticle.split(/\s+/).length
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unexpected error occurred' },
      { status: 500 }
    );
  }
}
