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

    // Analyze the current article for name patterns
    const namePatterns = analyzeNamePatterns(currentArticle);
    
    // Process articles sequentially - start with the first article
    let workingArticle = currentArticle;
    const contextSources = [];
    
    for (let i = 0; i < selectedArticles.length; i++) {
      const article = selectedArticles[i];
      
      try {
        console.log(`Processing context for article ${i + 1}/${selectedArticles.length}: "${article.headline}"`);
        console.log(`Article content preview:`, article.body.substring(0, 200) + '...');
        
        // Get date context for the article
        const dateContext = getDateContext(article.created);
        
        // Create different prompts based on whether this is the first or subsequent article
        const isFirstArticle = i === 0;
        const isSubsequentArticle = i > 0;
        
        const prompt = `
You are a financial journalist. ${isSubsequentArticle ? 'You are now adding ADDITIONAL context to an article that already has some context added.' : 'Given the current article and a selected Benzinga news article, create 1-2 very concise paragraphs that add relevant context to the current article.'}

${isSubsequentArticle ? 'CRITICAL: This is additional context being added to an existing article. Make sure this new context is UNIQUE and does not repeat or overlap with any existing context already in the article.' : 'CRITICAL: Focus ONLY on the specific content of the "Selected Benzinga Article" below.'}

IMPORTANT EXAMPLE: If the main article refers to someone as "Johnson" and "Trump", then in your context paragraphs, you MUST also say "Johnson" and "Trump" - NOT "Brandon Johnson" and "Donald Trump". The naming convention must match exactly.

Current Article (with any existing context):
${workingArticle.substring(0, 1500)}

Selected Benzinga Article to Add:
Headline: ${article.headline}
Content: ${article.body.substring(0, 500)}
Date: ${dateContext}

Name Usage Patterns in Current Article:
${namePatterns}

Requirements:
1. Create 1-2 paragraphs that provide additional context SPECIFICALLY from this article's content
2. Make the content relevant to the current article's topic but UNIQUE to this specific Benzinga article
3. Keep each paragraph to EXACTLY 2 sentences maximum - no more, no less
4. You MUST include exactly one hyperlink ONLY in the FIRST paragraph using this exact format: <a href="${article.url}">actual three word phrase</a>
4a. CRITICAL: The hyperlink MUST be present in your response - this is mandatory for each article
5. Any additional paragraphs should have NO hyperlinks
6. Make the content flow naturally with the current article
7. Focus on providing valuable context that enhances the reader's understanding
8. Use AP style and maintain a professional tone
9. Keep paragraphs short and impactful - aim for 1-2 sentences each
10. The hyperlink should be embedded within existing words in the text, not as "[source]" at the end
11. Choose relevant three-word phrases within the sentences to hyperlink, such as company names, key terms, or action phrases
12. CRITICAL: ONLY the first paragraph should contain exactly one hyperlink in the format specified above
13. CRITICAL: Do NOT use phrases like "in an earlier article", "a recent article", "according to reports", or similar references - just embed the hyperlink naturally in the existing sentence structure
14. CRITICAL: Replace "actual three word phrase" with a real three-word phrase from the sentence, such as "executive order signed", "federal immigration raids", "Democratic leaders resisting", etc.
14. CRITICAL: Format the output with proper HTML paragraph tags. Each paragraph should be wrapped in <p> tags.
15. CRITICAL: Ensure no paragraph has more than 2 sentences - break longer paragraphs into smaller ones
16. UNIQUENESS REQUIREMENT: Make sure this context is SPECIFIC to this article's content and not generic. Focus on the unique details, facts, or insights from this specific Benzinga article.
17. CRITICAL: You MUST use specific facts, numbers, quotes, or details from the article content above. Do NOT generate generic statements that could apply to any article about the same person/company.
18. MANDATORY: Include at least one specific detail from the article (e.g., a number, quote, specific event, or unique fact) in your context paragraphs.
19. FORBIDDEN: Do NOT write generic statements like "this follows Buffett's strategy" or "this aligns with company goals" unless you can connect it to a specific detail from the article.
17. NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
    * CRITICAL: You MUST follow the name usage patterns established in the current article above
    * If the current article uses only last names (e.g., "Johnson", "Trump", "Bowser"), use ONLY last names in context
    * If the current article uses full names, use full names in context
    * NEVER introduce a full name if the current article has already established the person by last name only
    * NEVER introduce a last name if the current article has already established the person by full name
    * This is a CRITICAL requirement - the context must match the naming convention already established
    * Examples: If the main article says "Johnson" and "Trump", then in context say "Johnson" and "Trump", NOT "Brandon Johnson" and "Donald Trump"
    * Examples: If the main article says "Brandon Johnson" and "Donald Trump", then in context say "Brandon Johnson" and "Donald Trump"
    * The goal is to maintain perfect consistency with how names are already referenced in the main article
18. TEMPORAL CONTEXT RULES: When the context article is from a different time period than the current story:
    * ALWAYS explicitly mention the time difference (e.g., "June announcement", "earlier this year", "last month")
    * Explain the logical connection between the historical event and current developments
    * Use specific temporal phrases like "comes after", "follows", "builds on", "may have contributed to", "could impact", "reflects ongoing challenges from"
    * Show how the earlier news provides context for understanding the current situation
    * If the context article is from months ago, explain how that historical event relates to current developments
    * Be specific about the timeline: "The August bankruptcy filing follows Southwest's June partnership announcement"
    * Explain causality: "This earlier development may have intensified competitive pressures"
    * Connect the dots: Show how the historical event led to or influenced the current situation

Example format:
<p>First paragraph with hyperlink <a href="url">executive order signed</a> and second sentence.</p>
<p>Second paragraph with no hyperlinks and second sentence.</p>

EXAMPLES OF GOOD TEMPORAL CONTEXT:
- "Spirit Airlines' August bankruptcy filing follows Southwest Airlines' <a href="url">June trans-Pacific partnership</a> announcement, which may have intensified competitive pressures in the discount airline sector."
- "This development comes after Southwest's <a href="url">strategic expansion earlier</a> this year, suggesting that Spirit's struggles reflect broader industry challenges."
- "The timing of Spirit's bankruptcy filing, occurring months after Southwest's <a href="url">partnership announcement</a>, indicates how strategic alliances are reshaping the competitive landscape."

EXAMPLES OF GOOD THREE-WORD PHRASES TO HYPERLINK:
- "executive order signed"
- "federal immigration raids" 
- "Democratic leaders resisting"
- "trans-Pacific partnership"
- "strategic expansion earlier"
- "partnership announcement"
- "bankruptcy filing follows"
- "competitive pressures intensified"

EXAMPLES OF GOOD SPECIFIC DETAILS TO INCLUDE:
- If the article mentions "41 million viewers watched", include that specific number
- If the article quotes someone saying "I'm a huge fan", include that quote
- If the article mentions "stayed up until after midnight", include that specific detail
- If the article mentions specific events like "Canelo Alvarez vs Terence Crawford", include those names
- If the article mentions "six or seven fights attended", include that specific number

EXAMPLES OF BAD GENERIC CONTENT TO AVOID:
- "This follows Buffett's investment strategy" (too generic)
- "This aligns with company goals" (too generic)
- "The move comes amid competitive pressures" (too generic)
- "This underscores his commitment" (too generic)

Write the context paragraphs now:`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.7,
        });

        const contextText = completion.choices[0].message?.content?.trim() || '';
        
        if (contextText) {
          console.log(`Generated context for "${article.headline}":`, contextText.substring(0, 200) + '...');
          
          // Ensure proper HTML paragraph formatting
          const formattedContext = contextText
            .replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks to double
            .replace(/\n([^<])/g, '\n\n$1') // Ensure paragraphs are separated by double line breaks
            .replace(/([^>])\n\n([^<])/g, '$1\n\n$2') // Ensure proper spacing around HTML tags
            .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
            .replace(/(<p>.*?<\/p>)\s*(<p>.*?<\/p>)/g, '$1\n\n$2'); // Ensure proper spacing between <p> tags
          
          // Validate that hyperlink was generated
          if (!formattedContext.includes(`<a href="${article.url}">`)) {
            console.warn(`Warning: No hyperlink found in context for article "${article.headline}". URL: ${article.url}`);
            console.log('Generated context text:', formattedContext);
          }
          
          // Add this context to the working article immediately
          workingArticle = await addContextToArticle(workingArticle, formattedContext, isFirstArticle);
          
          contextSources.push({
            headline: article.headline,
            url: article.url
          });
          
          console.log(`Successfully added context for "${article.headline}"`);
          console.log(`Working article now has ${workingArticle.length} characters`);
        } else {
          console.warn(`No context generated for article "${article.headline}"`);
        }
      } catch (error) {
        console.error(`Error generating context for article "${article.headline}":`, error);
        // Continue with other articles even if one fails
      }
    }

    if (contextSources.length === 0) {
      return NextResponse.json({ error: 'Failed to generate context for any selected articles.' }, { status: 500 });
    }

    console.log(`Successfully processed ${contextSources.length} context articles`);
    console.log(`Final article length: ${workingArticle.length} characters`);
    
    return NextResponse.json({ 
      updatedArticle: workingArticle,
      contextSources: contextSources,
      articlesAdded: contextSources.length
    });
  } catch (error: any) {
    console.error('Error adding multiple context:', error);
    return NextResponse.json({ error: error.message || 'Failed to add context.' }, { status: 500 });
  }
}

// Function to add context to an article
async function addContextToArticle(article: string, contextText: string, isFirstArticle: boolean): Promise<string> {
  // For the first article, we need to generate a subhead and insert the context properly
  if (isFirstArticle) {
    // Generate a subhead for the context section
    let contextSubhead = '';
    try {
      const contextSubheadPrompt = `
You are a top-tier financial journalist. Given the context that was just added to the article, create exactly 1 compelling subhead that introduces the context section.

The context section provides additional background information and relevant details about the ticker.

CONTEXT PARAGRAPHS TO BASE SUBHEAD ON:
${contextText}

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

    // Create the full context section with subhead
    const fullContextSection = contextSubhead ? `${contextSubhead}\n\n\n${contextText}` : contextText;
    
    // Split the article into lines to find the price action section
    const lines = article.split('\n');
    const priceActionIndex = lines.findIndex((line: string) => 
      line.includes('Price Action:') || 
      line.includes('<strong>') && line.includes('Price Action:') ||
      line.includes('Price Action')
    );
    
    if (priceActionIndex !== -1) {
      // Insert context before the price action line
      const beforePriceAction = lines.slice(0, priceActionIndex).join('\n');
      const priceActionAndAfter = lines.slice(priceActionIndex).join('\n');
      
      // Check if there's a "Read Next" section before price action that needs to be moved
      const readNextPattern = /Read Next:[\s\S]*?(?=\n\n|$)/;
      const readNextMatch = beforePriceAction.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from before price action
        const beforePriceActionWithoutReadNext = beforePriceAction.replace(readNextPattern, '').trim();
        // Insert context first, then "Read Next" after context
        return `${beforePriceActionWithoutReadNext}\n\n${fullContextSection}\n\n${readNextMatch[0]}\n\n${priceActionAndAfter}`;
      } else {
        // No "Read Next" section to move, just insert context
        return `${beforePriceAction}\n\n${fullContextSection}\n\n${priceActionAndAfter}`;
      }
    } else {
      // If no price action found, check if there's a "Read Next" section at the end to move
      const readNextPattern = /Read Next:[\s\S]*?(?=\n\n|$)/;
      const readNextMatch = article.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from the end
        const articleWithoutReadNext = article.replace(readNextPattern, '').trim();
        // Insert context first, then "Read Next" after context
        return `${articleWithoutReadNext}\n\n${fullContextSection}\n\n${readNextMatch[0]}`;
      } else {
        // No "Read Next" section to move, just add context to the end
        return `${article}\n\n${fullContextSection}`;
      }
    }
  } else {
    // For subsequent articles, we need to insert them BEFORE the "Read Next" section
    const readNextPattern = /Read Next:[\s\S]*?(?=\n\n|$)/;
    const readNextMatch = article.match(readNextPattern);
    
    if (readNextMatch) {
      // Remove the "Read Next" section from the end
      const articleWithoutReadNext = article.replace(readNextPattern, '').trim();
      // Insert context first, then "Read Next" after context
      return `${articleWithoutReadNext}\n\n${contextText}\n\n${readNextMatch[0]}`;
    } else {
      // No "Read Next" section to move, just add context to the end
      return `${article}\n\n${contextText}`;
    }
  }
}

// Function to analyze name patterns in the current article
function analyzeNamePatterns(articleText: string): string {
  const patterns: string[] = [];
  
  // Common name patterns to look for
  const namePatterns = [
    // Political figures
    { full: 'Donald Trump', short: 'Trump' },
    { full: 'Joe Biden', short: 'Biden' },
    { full: 'Brandon Johnson', short: 'Johnson' },
    { full: 'Muriel Bowser', short: 'Bowser' },
    { full: 'JB Pritzker', short: 'Pritzker' },
    { full: 'Zohran Mamdani', short: 'Mamdani' },
    { full: 'Elon Musk', short: 'Musk' },
    { full: 'Warren Buffett', short: 'Buffett' },
    { full: 'Bill Ackman', short: 'Ackman' },
    { full: 'Tim Cook', short: 'Cook' },
    { full: 'Satya Nadella', short: 'Nadella' },
    { full: 'Jensen Huang', short: 'Huang' },
    { full: 'Lisa Cook', short: 'Cook' },
    { full: 'Jerome Powell', short: 'Powell' },
    { full: 'Christopher Waller', short: 'Waller' },
    { full: 'Elizabeth Warren', short: 'Warren' },
    { full: 'Joni Ernst', short: 'Ernst' },
    { full: 'Rich Logis', short: 'Logis' },
    { full: 'Grant Cardone', short: 'Cardone' },
    { full: 'Tom Lee', short: 'Lee' },
    { full: 'Martin Shkreli', short: 'Shkreli' },
    { full: 'Scott Bessent', short: 'Bessent' },
    { full: 'Jamie Dimon', short: 'Dimon' }
  ];
  
  // Check which names are used and how
  namePatterns.forEach(pattern => {
    const fullNameCount = (articleText.match(new RegExp(pattern.full.replace(/\s+/g, '\\s+'), 'gi')) || []).length;
    const shortNameCount = (articleText.match(new RegExp(`\\b${pattern.short}\\b`, 'gi')) || []).length;
    
    if (fullNameCount > 0 || shortNameCount > 0) {
      if (fullNameCount > 0 && shortNameCount > 0) {
        patterns.push(`- ${pattern.full} is mentioned ${fullNameCount} times, then referred to as ${pattern.short} ${shortNameCount} times`);
      } else if (fullNameCount > 0) {
        patterns.push(`- ${pattern.full} is used ${fullNameCount} times (use full name)`);
      } else if (shortNameCount > 0) {
        patterns.push(`- ${pattern.short} is used ${shortNameCount} times (use last name only)`);
      }
    }
  });
  
  // Also check for any other names that might be used consistently
  const allWords = articleText.split(/\s+/);
  const wordFrequency: { [key: string]: number } = {};
  
  allWords.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    if (cleanWord.length > 2 && /^[a-z]+$/i.test(cleanWord)) {
      wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
    }
  });
  
  // Look for potential last names that appear multiple times
  Object.entries(wordFrequency).forEach(([word, count]) => {
    if (count >= 2 && word.length >= 4 && /^[A-Z]/.test(word)) {
      // Check if this might be a last name by looking for it in the article
      const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = articleText.match(wordRegex) || [];
      if (matches.length >= 2) {
        // Check if it's not already covered by our name patterns
        const isCovered = namePatterns.some(pattern => 
          pattern.short.toLowerCase() === word.toLowerCase() || 
          pattern.full.toLowerCase().includes(word.toLowerCase())
        );
        if (!isCovered) {
          patterns.push(`- "${word}" appears ${count} times (likely a last name - use last name only)`);
        }
      }
    }
  });
  
  if (patterns.length === 0) {
    return 'No specific name patterns detected. Use standard AP style (full name first, then last name).';
  }
  
  return patterns.join('\n');
}

// Function to get human-readable date context
function getDateContext(createdDate?: string): string {
  if (!createdDate) return 'Unknown date';
  
  const now = new Date();
  const articleDate = new Date(createdDate);
  
  if (isNaN(articleDate.getTime())) return 'Unknown date';
  
  const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
  const daysDiff = hoursDiff / 24;
  
  if (hoursDiff <= 1) {
    return 'within the last hour';
  } else if (hoursDiff <= 24) {
    return 'today';
  } else if (daysDiff <= 2) {
    return 'yesterday';
  } else if (daysDiff <= 7) {
    return 'this week';
  } else if (daysDiff <= 14) {
    return 'last week';
  } else if (daysDiff <= 30) {
    return 'this month';
  } else if (daysDiff <= 60) {
    return 'last month';
  } else if (daysDiff <= 90) {
    return 'earlier this year';
  } else {
    return 'earlier this year';
  }
}
