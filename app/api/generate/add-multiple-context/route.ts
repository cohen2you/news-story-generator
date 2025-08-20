import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { currentArticle, selectedArticles } = await request.json();
    
    if (!currentArticle) {
      return NextResponse.json({ error: 'Current article is required.' }, { status: 400 });
    }
    
    if (!selectedArticles || !Array.isArray(selectedArticles) || selectedArticles.length === 0) {
      return NextResponse.json({ error: 'At least one selected article is required.' }, { status: 400 });
    }
    
    if (selectedArticles.length > 3) {
      return NextResponse.json({ error: 'Maximum 3 articles can be selected.' }, { status: 400 });
    }

    // Generate context paragraphs for each selected article
    const contextParagraphs = [];
    const contextSources = [];
    
    for (const article of selectedArticles) {
      try {
        const prompt = `
You are a financial journalist. Given the current article and a selected Benzinga news article, create 1-2 very concise paragraphs that add relevant context to the current article.

Current Article:
${currentArticle.substring(0, 1000)}

Selected Benzinga Article:
Headline: ${article.headline}
Content: ${article.body.substring(0, 500)}

Requirements:
1. Create 1-2 paragraphs that provide additional context
2. Make the content relevant to the current article's topic
3. Keep each paragraph to EXACTLY 2 sentences maximum - no more, no less
4. You MUST include exactly one hyperlink ONLY in the FIRST paragraph using this exact format: <a href="${article.url}">three word phrase</a>
5. Any additional paragraphs should have NO hyperlinks
6. Make the content flow naturally with the current article
7. Focus on providing valuable context that enhances the reader's understanding
8. Use AP style and maintain a professional tone
9. Keep paragraphs short and impactful - aim for 1-2 sentences each
10. The hyperlink should be embedded within existing words in the text, not as "[source]" at the end
11. Choose relevant three-word phrases within the sentences to hyperlink, such as company names, key terms, or action phrases
12. CRITICAL: ONLY the first paragraph should contain exactly one hyperlink in the format specified above
13. Do NOT reference "a recent article" or similar phrases - just embed the hyperlink naturally in the existing sentence structure
14. CRITICAL: Format the output with proper HTML paragraph tags. Each paragraph should be wrapped in <p> tags.
15. CRITICAL: Ensure no paragraph has more than 2 sentences - break longer paragraphs into smaller ones
16. NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
    * First reference: Use the full name with the entire name in bold using HTML <strong> tags (e.g., "<strong>Bill Ackman</strong>" or "<strong>Warren Buffett</strong>")
    * Second and subsequent references: Use only the last name without bolding (e.g., "Ackman" or "Buffett")
    * This applies to all people mentioned in the context paragraphs

Example format:
<p>First paragraph with hyperlink <a href="url">three word phrase</a> and second sentence.</p>
<p>Second paragraph with no hyperlinks and second sentence.</p>

Write the context paragraphs now:`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.7,
        });

        const contextText = completion.choices[0].message?.content?.trim() || '';
        
        if (contextText) {
          // Ensure proper HTML paragraph formatting
          const formattedContext = contextText
            .replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks to double
            .replace(/\n([^<])/g, '\n\n$1') // Ensure paragraphs are separated by double line breaks
            .replace(/([^>])\n\n([^<])/g, '$1\n\n$2') // Ensure proper spacing around HTML tags
            .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
            .replace(/(<p>.*?<\/p>)\s*(<p>.*?<\/p>)/g, '$1\n\n$2'); // Ensure proper spacing between <p> tags
          
          contextParagraphs.push(formattedContext);
          contextSources.push({
            headline: article.headline,
            url: article.url
          });
        }
      } catch (error) {
        console.error(`Error generating context for article "${article.headline}":`, error);
        // Continue with other articles even if one fails
      }
    }

    if (contextParagraphs.length === 0) {
      return NextResponse.json({ error: 'Failed to generate context for any selected articles.' }, { status: 500 });
    }

    // Generate a subhead for the context section
    let contextSubhead = '';
    try {
      const allContextText = contextParagraphs.join('\n\n');
      const contextSubheadPrompt = `
You are a top-tier financial journalist. Given the context that was just added to the article, create exactly 1 compelling subhead that introduces the context section.

The context section provides additional background information and relevant details about the ticker.

CONTEXT PARAGRAPHS TO BASE SUBHEAD ON:
${allContextText}

Requirements:
- Create exactly 1 standalone mini headline
- Make it 4-8 words maximum for maximum impact
- Make it highly engaging and clickable
- Focus on the context/additional information aspect
- Use strong, active language that conveys authority
- Capitalize the first letter of every word
- Make it relevant to the context being added
- Do NOT include quotes around the subhead
- Make it specific to the actual context content, not generic
- Base it on the specific details in the context paragraphs above
- The subhead should directly relate to the main topic discussed in the context paragraphs

Examples of good context subheads:
- "Regulatory Compliance Strategy"
- "App Store Policy Changes"
- "Investor Confidence Factors"
- "Market Positioning Tactics"
- "Competitive Edge Measures"

Create 1 subhead for the context section:`;

      const contextSubheadCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: contextSubheadPrompt }],
        max_tokens: 50,
        temperature: 0.7,
      });

      contextSubhead = contextSubheadCompletion.choices[0].message?.content?.trim() || '';
      if (contextSubhead) {
        contextSubhead = contextSubhead.replace(/\*\*/g, '').replace(/^##\s*/, '').replace(/^["']|["']$/g, '').trim();
      }
    } catch (error) {
      console.error('Error generating context subhead:', error);
    }

    // Combine all context paragraphs
    const allContextText = contextParagraphs.join('\n\n');

    // Insert context and subhead together
    let updatedArticleWithSubheads = currentArticle;
    // Split the article into lines to find the price action section
    const lines = currentArticle.split('\n');
    const priceActionIndex = lines.findIndex((line: string) => 
      line.includes('Price Action:') || 
      line.includes('<strong>') && line.includes('Price Action:') ||
      line.includes('Price Action')
    );
    
    if (priceActionIndex !== -1) {
      // Insert context and subhead before the price action line
      const beforePriceAction = lines.slice(0, priceActionIndex).join('\n');
      const priceActionAndAfter = lines.slice(priceActionIndex).join('\n');
      const subheadSection = contextSubhead ? `${contextSubhead}\n\n\n${allContextText}` : allContextText;
      
      // Check if there's a "Read Next" section before price action that needs to be moved
      const readNextPattern = /Read Next:[\s\S]*?(?=\n\n|$)/;
      const readNextMatch = beforePriceAction.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from before price action
        const beforePriceActionWithoutReadNext = beforePriceAction.replace(readNextPattern, '').trim();
        // Insert context first, then "Read Next" after context
        updatedArticleWithSubheads = `${beforePriceActionWithoutReadNext}\n\n${subheadSection}\n\n${readNextMatch[0]}\n\n${priceActionAndAfter}`;
      } else {
        // No "Read Next" section to move, just insert context
        updatedArticleWithSubheads = `${beforePriceAction}\n\n${subheadSection}\n\n${priceActionAndAfter}`;
      }
    } else {
      // If no price action found, check if there's a "Read Next" section at the end to move
      const readNextPattern = /Read Next:[\s\S]*?(?=\n\n|$)/;
      const readNextMatch = currentArticle.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from the end
        const articleWithoutReadNext = currentArticle.replace(readNextPattern, '').trim();
        const subheadSection = contextSubhead ? `${contextSubhead}\n\n\n${allContextText}` : allContextText;
        // Insert context first, then "Read Next" after context
        updatedArticleWithSubheads = `${articleWithoutReadNext}\n\n${subheadSection}\n\n${readNextMatch[0]}`;
      } else {
        // No "Read Next" section to move, just add context to the end
        const subheadSection = contextSubhead ? `${contextSubhead}\n\n\n${allContextText}` : allContextText;
        updatedArticleWithSubheads = `${currentArticle}\n\n${subheadSection}`;
      }
    }
    
    return NextResponse.json({ 
      updatedArticle: updatedArticleWithSubheads,
      contextSources: contextSources,
      articlesAdded: contextParagraphs.length
    });
  } catch (error: any) {
    console.error('Error adding multiple context:', error);
    return NextResponse.json({ error: error.message || 'Failed to add context.' }, { status: 500 });
  }
}
