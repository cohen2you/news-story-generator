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
6. CRITICAL: Maintain all HTML paragraph tags (<p> and </p>) exactly as they appear
7. CRITICAL: Do NOT remove or modify any HTML formatting - preserve the structure

SOURCE MATERIAL (for similarity checking):
${sourceText || 'No source material provided'}

ARTICLE TO CONDENSE:
${articleWithoutLinks}

Please provide your response in this exact format:

CONDENSED ARTICLE:
[Your condensed article with ALL [HYPERLINK_X] placeholders preserved exactly]

CHANGES MADE:
• [Specific change 1 - describe exactly what was modified, e.g., "Shortened 'The company announced today that it will be implementing' to 'The company will implement'"]
• [Specific change 2 - describe exactly what was modified, e.g., "Removed redundant phrase 'in order to' from sentence about earnings"]
• [Specific change 3 - describe exactly what was modified, e.g., "Combined two sentences about market reaction into one concise statement"]
• [Specific change 4 - describe exactly what was modified, e.g., "Condensed 'as a result of the recent developments' to 'due to recent developments'"]
• [Specific change 5 - describe exactly what was modified, e.g., "Shortened paragraph about analyst expectations from 3 sentences to 2"]`;

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
    
    // Validate that paragraph tags are preserved
    const originalParagraphs = (article.match(/<p>/g) || []).length;
    const finalParagraphs = (finalArticle.match(/<p>/g) || []).length;
    
    if (finalLinks !== originalLinks || finalParagraphs !== originalParagraphs) {
      // If hyperlinks or paragraph structure were lost, return the original article with a warning
      return NextResponse.json({ 
        reviewedArticle: article,
        changes: ['Editorial review skipped - formatting preservation failed'],
        originalWordCount: article.split(/\s+/).length,
        newWordCount: article.split(/\s+/).length,
        warning: finalLinks !== originalLinks 
          ? 'Could not preserve all hyperlinks during condensation'
          : 'Could not preserve paragraph structure during condensation'
      });
    }

    const changes = changesMatch 
      ? changesMatch[1]
          .split('\n')
          .filter((line: string) => line.trim().startsWith('•'))
          .map((line: string) => line.replace('•', '').trim())
          .filter((change: string) => change.length > 0)
          .slice(0, 5) // Show up to 5 specific changes
      : [];

    // Add additional analysis if changes are too generic
    let enhancedChanges = changes;
    if (changes.length === 0 || changes.some((change: string) => 
      change.includes('Combined similar ideas') || 
      change.includes('Removed redundant phrases') || 
      change.includes('Shortened sentences')
    )) {
      // Generate more specific analysis
      const analysisPrompt = `Analyze the differences between these two versions of an article and provide specific, detailed changes made:

ORIGINAL ARTICLE:
${articleWithoutLinks}

CONDENSED ARTICLE:
${condensedArticle}

Provide 3-5 specific changes in this format:
• [Specific change with exact details]`;

      try {
        const analysisResult = await callOpenAI(analysisPrompt);
        const analysisMatch = analysisResult.match(/(?:•|\*)\s*(.+)/g);
        if (analysisMatch) {
          enhancedChanges = analysisMatch
            .map((line: string) => line.replace(/^[•*]\s*/, '').trim())
            .filter((change: string) => change.length > 0)
            .slice(0, 5);
        }
      } catch (error) {
        console.log('Could not generate enhanced analysis:', error);
      }
    }

    return NextResponse.json({ 
      reviewedArticle: finalArticle,
      changes: enhancedChanges,
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
