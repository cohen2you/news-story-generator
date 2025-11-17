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
        // Validate article has required fields
        if (!article.url) {
          console.error(`Article "${article.headline}" is missing URL - skipping`);
          continue;
        }
        
        if (!article.headline || !article.body) {
          console.error(`Article is missing headline or body - skipping`);
          continue;
        }
        
        console.log(`Processing context for article ${i + 1}/${selectedArticles.length}: "${article.headline}"`);
        console.log(`Article URL: ${article.url}`);
        console.log(`Article content preview:`, article.body.substring(0, 200) + '...');
        
        // Get date context for the article
        const dateContext = getDateContext(article.created);
        
        // Create different prompts based on whether this is the first or subsequent article
        const isFirstArticle = i === 0;
        const isSubsequentArticle = i > 0;
        
        const prompt = `
You are a financial journalist. ${isSubsequentArticle ? 'You are now adding ADDITIONAL context to an article that already has some context added.' : 'Given the current article and a selected Benzinga news article, create 1 very concise paragraph that adds relevant context to the current article.'}

${isSubsequentArticle ? 'CRITICAL: This is additional context being added to an existing article. Make sure this new context is UNIQUE and does not repeat or overlap with any existing context already in the article.' : 'CRITICAL: Focus ONLY on the specific content of the "Selected Benzinga Article" below.'}

IMPORTANT EXAMPLE: If the main article refers to someone as "Johnson" and "Trump", then in your context paragraph, you MUST also say "Johnson" and "Trump" - NOT "Brandon Johnson" and "Donald Trump". The naming convention must match exactly.

Current Article (FULL TEXT - analyze completely):
${workingArticle}

Selected Benzinga Article to Add (FULL TEXT - analyze completely):
Headline: ${article.headline}
Content: ${article.body}
Date: ${dateContext}

Name Usage Patterns in Current Article:
${namePatterns}

**CRITICAL STEP 1: ANALYZE BOTH ARTICLES FOR INTEGRATION**

A. READ THE FULL CURRENT ARTICLE:
   - What is the main topic/theme?
   - What sections/themes are discussed?
   - What tone and style is used?
   - Where are there natural topic transitions?
   - What information would benefit from additional context?

B. READ THE FULL SELECTED BENZINGA ARTICLE:
   - What is the main point of this article?
   - What specific facts, numbers, and events does it contain?
   - How does this relate to the current article's themes?
   - What unique information does it add?

C. IDENTIFY THEMATIC CONNECTION:
   - Where in the current article does this context fit best thematically?
   - Which section would benefit most from this background?
   - How can this context enhance reader understanding?

**STEP 2: EXTRACT SPECIFIC FACTS FROM THE BENZINGA ARTICLE**

You MUST extract SPECIFIC, CONCRETE facts from the Selected Benzinga Article:

**A. NUMBERS & PERCENTAGES (Write down EXACT figures):**
   - Stock performance: ___% gain/loss
   - Comparison metrics: vs S&P 500's ___% 
   - Dollar amounts: $___ billion/million
   - Price levels: declined to $___, climbed ___% 
   - Time periods: over past ___ months/year

**B. DATES & TIMEFRAMES (Be specific):**
   - When did events occur? (Month/Year)
   - How long ago? (e.g., "in August", "since May")
   - Time comparisons: "first since ___"

**C. SPECIFIC EVENTS & ACTIONS:**
   - What technical pattern appeared? (Death Cross, Golden Cross, etc.)
   - What did someone DO? (announced, stepped down, purchased, sold)
   - What changed? (rating downgraded, shares declined, cash increased)

**D. PEOPLE & QUOTES:**
   - Who is named? What is their role/title?
   - What did they ACTUALLY SAY? (Only direct quotes in quotation marks)
   - CRITICAL: Distinguish between DIRECT QUOTES and PARAPHRASES
     * DIRECT QUOTE: "I am very confident in Greg," Buffett said. ← Use this with quotation marks
     * PARAPHRASE: saying it is designed to withstand any economic environment ← DO NOT put in quotes
     * PARAPHRASE: He noted that the company has durability ← DO NOT put in quotes

**E. ARTICLE TYPE:**
   - Is this current news or historical analysis?
   - Is this about past events or ongoing situations?

**CRITICAL RULES:**
- DO NOT reference facts from the Current Article above - ONLY use facts from the Selected Benzinga Article
- DO NOT make up numbers - use EXACT figures from the article
- DO NOT say "Buffett noted/said" unless there's a direct quote
- DO NOT write generic statements - extract SPECIFIC details

**CRITICAL - QUOTE vs PARAPHRASE DETECTION:**
- If the source says "saying X" or "noted that X" or "emphasized X" → This is a PARAPHRASE, NOT a quote
- Only text that appears INSIDE QUOTATION MARKS in the source is a real quote
- NEVER put paraphrased content inside quotation marks
- NEVER write: stating that the company is "designed to withstand..." ← This fabricates a quote
- CORRECT: In his letter, Buffett discussed Berkshire's durability in challenging economic conditions ← Paraphrase without quotes
- CORRECT: "Berkshire has less chance of a devastating disaster than any business I know," he said ← Real quote from source

**STEP 3: VERIFY YOUR EXTRACTION**
Before writing, confirm you have extracted:
- ✓ At least 3 specific numbers/percentages
- ✓ At least 2 specific dates/timeframes  
- ✓ At least 1 specific event or action
- ✓ The main subject/topic of the article
- ✓ How this context relates to the current article

If you haven't extracted these, GO BACK and re-read the Selected Benzinga Article.

**STEP 4: CRAFT SEAMLESS INTEGRATION**

Now that you understand BOTH articles completely:

1. **Write Context That Bridges**: Your paragraph should feel like a natural extension of the current article's narrative
2. **Use Transitional Flow**: Consider what topics come before and after in the current article
3. **Add Value**: Provide background that enhances the current story without repeating it
4. **Maintain Tone**: Match the style and tone of the current article

**STEP 5: WRITE YOUR PARAGRAPH**
Requirements:
1. Create EXACTLY 1 paragraph (2 sentences) using SPECIFIC FACTS from the Benzinga article
2. MANDATORY: Include at least 3-4 specific details (numbers, dates, events) from the Benzinga article
3. DO NOT reference facts from the Current Article - ONLY use facts from the Selected Benzinga Article
4. Make it feel like it BELONGS in the current story - seamless integration
5. Consider where this will be placed and how it connects to surrounding content
3. **CRITICAL TEMPORAL CONTEXT**: Since the context article was published ${dateContext}, you MUST use temporal markers to show this is historical/background information:
   - Use phrases like: "has previously discussed", "in past interviews", "historically noted", "in earlier statements"
   - If quoting or referencing past events, use past tense: "said", "called", "described", "labeled"
   - Make it clear this is background context, not current news happening simultaneously
   - Connect past context to current developments: "This historical perspective explains...", "This past decision may inform..."
4. Keep the paragraph to EXACTLY 2 sentences - no more, no less
4. **CRITICAL HYPERLINK INSTRUCTION - MANDATORY**: 
   - You MUST include a hyperlink in your paragraph. This is NOT optional.
   - The hyperlink format MUST be: <a href="${article.url}">YOUR_ACTUAL_PHRASE</a>
   - Replace "YOUR_ACTUAL_PHRASE" with an actual 3-4 word phrase from YOUR sentence
   - **CRITICAL**: The hyperlink MUST be embedded WITHIN your sentence text, NOT on its own line or as a separate element
   - Examples of good hyperlink phrases: "11.5% stock decline", "unexpected CEO announcement", "downgraded their rating", "Greg Abel succession"
   - The phrase you hyperlink should be words that ACTUALLY APPEAR in your sentence, not placeholder text
   - DO NOT skip the hyperlink - your output will be rejected if it doesn't include one
   - DO NOT put the hyperlink on its own line - it must be part of the sentence flow
5. FORBIDDEN PHRASES - Do NOT use any of these:
   - "in an earlier article" / "a recent article" / "according to reports"
   - "as detailed in" / "as outlined in" / "as mentioned in"
   - "publicly acknowledged" / "has discussed" / "has reflected on" (without specifics)
   - "teaching moments" / "adds depth" / "illustrating an approach"
   - Any phrase that ends with the same words/concept that started the sentence
9. **ABSOLUTELY CRITICAL - HYPERLINK CREATION**:
   - DO NOT write "actual three word phrase" or "REPLACE_WITH_REAL_PHRASE" or "three word phrase" in your output
   - These are PLACEHOLDERS that you must REPLACE with real words from your sentence
   - Example: If you write "Berkshire's B shares declined 11.5% after the unexpected CEO announcement in May"
   - You could hyperlink: <a href="url">unexpected CEO announcement</a> or <a href="url">declined 11.5% after</a>
   - The hyperlinked words MUST be actual words from your sentence, not placeholder text
10. CRITICAL: Format the output with proper HTML paragraph tags. The paragraph should be wrapped in <p> tags.
11. BANNED GENERIC STATEMENTS - Do NOT write:
   - "publicly acknowledged many missteps" (too vague - name a SPECIFIC misstep)
   - "has reflected on challenges" (too vague - give SPECIFIC challenge)
   - "maintains a cautious strategy" (too vague - give SPECIFIC action)
   - "teaching moments for others" (too vague - give SPECIFIC lesson/example)
   - "might create advantageous entry points" (too vague - use SPECIFIC numbers/facts)
   - "aligns with earlier observations" (too vague - what specific earlier observation?)
   - "influencing his decision-making amidst trends" (too vague and wordy)
12. CRITICAL - DO NOT FABRICATE QUOTES OR STATEMENTS:
   - Do NOT say "Buffett has noted" or "Buffett said" unless the article has a DIRECT QUOTE in quotation marks
   - If the article is analyzing markets/stocks, frame it as analysis, not as Buffett's statements
   - Example: If article says "Death Cross appeared", don't write "Buffett noted that Death Cross appeared"
   - Only attribute statements to people when they are DIRECTLY quoted in the article
   
   **FABRICATED QUOTE EXAMPLES - NEVER DO THIS:**
   ❌ BAD: According to CNBC, Buffett reassured shareholders of Berkshire's resilience, stating that the company is "designed to withstand nearly any economic environment."
   Why Bad: The phrase in quotes is a PARAPHRASE from the article, not Buffett's actual words
   
   ❌ BAD: Buffett noted the company is "maintaining strong fundamentals"
   Why Bad: If source says "noting the company's strong fundamentals" that's a paraphrase, NOT a quote
   
   ✓ CORRECT: According to CNBC, Buffett reassured shareholders of Berkshire's resilience and ability to weather challenging economic conditions.
   Why Good: Paraphrases without fabricating a quote
   
   ✓ CORRECT: "Berkshire has less chance of a devastating disaster than any business I know," Buffett said in his letter.
   Why Good: This uses actual quoted words from the source
   
   **DETECTION RULE:** If the source article says "saying X" or "noted X" or "emphasized X" without quotation marks around X, then X is a PARAPHRASE. Never put it in quotes.
13. MANDATORY EXTRACTION: Before writing, identify and extract from the article:
   - What SPECIFIC investment/company is mentioned?
   - What SPECIFIC number/amount/percentage is mentioned?
   - What SPECIFIC person is quoted and what did they say?
   - What SPECIFIC action or event occurred?
   Then use these specifics in your paragraph.
14. CRITICAL - NO WORD DUPLICATION: Do NOT repeat the same key phrases, terms, or concepts within the paragraph. Each sentence must introduce NEW information.
15. Use AP style and maintain a professional tone
16. NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
    * CRITICAL: You MUST follow the name usage patterns established in the current article above
    * If the current article uses only last names (e.g., "Johnson", "Trump", "Bowser"), use ONLY last names in context
    * If the current article uses full names, use full names in context
    * NEVER introduce a full name if the current article has already established the person by last name only
    * NEVER introduce a last name if the current article has already established the person by full name
    * This is a CRITICAL requirement - the context must match the naming convention already established
    * Examples: If the main article says "Johnson" and "Trump", then in context say "Johnson" and "Trump", NOT "Brandon Johnson" and "Donald Trump"
    * Examples: If the main article says "Brandon Johnson" and "Donald Trump", then in context say "Brandon Johnson" and "Donald Trump"
    * The goal is to maintain perfect consistency with how names are already referenced in the main article
17. TEMPORAL CONTEXT RULES: When the context article is from a different time period than the current story:
    * ALWAYS explicitly mention the time difference (e.g., "June announcement", "earlier this year", "last month")
    * Explain the logical connection between the historical event and current developments
    * Use specific temporal phrases like "comes after", "follows", "builds on", "may have contributed to", "could impact", "reflects ongoing challenges from"
    * Show how the earlier news provides context for understanding the current situation
    * If the context article is from months ago, explain how that historical event relates to current developments
    * Be specific about the timeline: "The August bankruptcy filing follows Southwest's June partnership announcement"
    * Explain causality: "This earlier development may have intensified competitive pressures"
    * Connect the dots: Show how the historical event led to or influenced the current situation

GOOD EXAMPLES (SPECIFIC FACTS, PROPER HYPERLINKS, CLEAR INTEGRATION):

**Example 1 - Technical Analysis:**
"A <a href="url">Death Cross pattern</a> appeared on Berkshire's chart in late October, marking the first such occurrence since August when the same signal preceded the stock's exact bottom before a 7.2% rally. The B shares have gained just 6% over the past year, significantly trailing the S&P 500's 19% surge, with the widest underperformance gap of the year."

**Example 2 - Historical Decision:**
"In past shareholder letters, Buffett described the original purchase of <a href="url">Berkshire Hathaway itself</a> as his 'dumbest' investment, estimating it cost him $200 billion in potential value over time. This admission came decades after the 1965 textile company acquisition, which Buffett later acknowledged was driven by spite rather than sound business judgment."

**Example 3 - Recent Performance:**
"Berkshire's shares dropped nearly 15% to $459 in August following Buffett's May announcement that he would <a href="url">step down as CEO</a> at year-end, though they have since climbed 7.2% as some investors bet the worst is over. Analyst downgrades from firms like Keefe, Bruyette & Woods cited 'historically unique succession risk' as the primary concern."

**Why These Work:**
- ✓ Multiple specific numbers (6%, 19%, 7.2%, 15%, $459)
- ✓ Specific dates/timeframes (October, August, May, 1965)
- ✓ Specific events (Death Cross appeared, shares dropped, announced step down)
- ✓ Real hyperlinks on actual phrases from the sentence
- ✓ Facts connect to current story without repeating current article facts

BAD EXAMPLES (DO NOT WRITE LIKE THIS):

❌ "Historically, the Death Cross pattern appearing on Berkshire Hathaway's chart has raised concerns among investors, yet it previously signaled potential recovery opportunities."
**Why Bad:** 
- No specific numbers (which %? when exactly?)
- No hyperlink visible
- "raised concerns" and "recovery opportunities" are vague
- No specific dates or timeframes

❌ "Buffett's decision to maintain a cautious approach comes after earlier reports indicated a $13.485 billion operating profit."
**Why Bad:**
- References facts from CURRENT article, not context article
- No hyperlink
- Confuses reader about what's historical vs current

❌ "This perspective aligns with earlier observations that market fluctuations might create entry points."
**Why Bad:**
- Completely vague - no specific facts
- "might create" is wishy-washy
- No numbers, dates, or events

❌ "This is highlighted in the <a href="url">actual three word phrase</a> regarding the company's strategy."
**Why Bad:**
- Used placeholder text instead of real phrase
- Too vague about what "this" refers to

EXAMPLES OF GOOD THREE-WORD PHRASES TO HYPERLINK:
- "Dexter Shoe Company"
- "Walmart stock early"
- "missed opportunity cost"
- "shareholder letter noted"
- "investment mistakes detailed"

**FINAL CHECKLIST BEFORE YOU WRITE:**
✓ Have you identified 2-3 specific facts from the article (numbers, names, dates, quotes)?
✓ Will your paragraph include these specific facts?
✓ Have you included temporal markers (has previously, in past interviews, historically)?
✓ Is it clear this is BACKGROUND context, not current simultaneous news?
✓ Have you chosen actual words from your sentence to hyperlink (NOT placeholder text)?
✓ Does your hyperlink phrase actually appear in your sentence?
✓ Is it exactly 2 sentences?

**CRITICAL REMINDERS:** 
- DO NOT use "actual three word phrase" or "three word phrase" or "REPLACE_WITH_REAL_PHRASE" in your output
- These are PLACEHOLDERS - replace them with real words from your sentence
- The hyperlink must be on actual words that appear in your paragraph
- Use temporal markers so readers know this is historical context, not current news

**CRITICAL**: You MUST include the hyperlink. Do not skip this requirement. The hyperlink format must be: <a href="${article.url}">YOUR_ACTUAL_PHRASE_HERE</a> where YOUR_ACTUAL_PHRASE_HERE is replaced with actual words from your sentence.

Write the context paragraph now (ONLY 1 PARAGRAPH with 2 sentences):`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.8,
        });

        const contextText = completion.choices[0].message?.content?.trim() || '';
        
        // Log token usage for this context generation
        if (completion.usage) {
          console.log(`\n📊 TOKEN USAGE for context article ${i + 1}/${selectedArticles.length}:`);
          console.log(`   - Prompt tokens: ${completion.usage.prompt_tokens}`);
          console.log(`   - Completion tokens: ${completion.usage.completion_tokens}`);
          console.log(`   - Total tokens: ${completion.usage.total_tokens}`);
          console.log(`   - Model: gpt-4o-mini\n`);
        }
        
        if (contextText) {
          console.log(`Generated context for "${article.headline}":`, contextText.substring(0, 200) + '...');
          
          // Ensure proper HTML paragraph formatting
          let formattedContext = contextText
            .replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks to double
            .replace(/\n([^<])/g, '\n\n$1') // Ensure paragraphs are separated by double line breaks
            .replace(/([^>])\n\n([^<])/g, '$1\n\n$2') // Ensure proper spacing around HTML tags
            .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
            .replace(/(<p>.*?<\/p>)\s*(<p>.*?<\/p>)/g, '$1\n\n$2'); // Ensure proper spacing between <p> tags
          
          // Fix hyperlinks that are on their own line or outside paragraphs
          // Only process hyperlinks that are NOT already inside a <p> tag
          // We'll do this by checking if the hyperlink appears between </p> and <p> or at boundaries
          
          // Pattern 1: Hyperlink between </p> and <p> tags (definitely outside) - merge into previous paragraph
          formattedContext = formattedContext.replace(/(<\/p>)\s*\n+\s*(<a href="[^"]+">[^<]+<\/a>)\s*\n+\s*(<p>)/g, (match, p1, link, p3) => {
            return p1.replace('</p>', ' ' + link + '</p>') + p3;
          });
          
          // Pattern 2: Hyperlink after </p> at end of string - merge into last paragraph
          formattedContext = formattedContext.replace(/(<\/p>)\s*\n+\s*(<a href="[^"]+">[^<]+<\/a>)\s*$/gm, (match, p1, link) => {
            return p1.replace('</p>', ' ' + link + '</p>');
          });
          
          // Pattern 3: Hyperlink at start of string before first <p> - wrap in paragraph
          if (formattedContext.match(/^\s*(<a href="[^"]+">[^<]+<\/a>)/)) {
            formattedContext = formattedContext.replace(/^\s*(<a href="[^"]+">[^<]+<\/a>)\s*\n+\s*(<p>)/, '<p>$1 ');
          }
          
          // Pattern 4: Standalone hyperlink surrounded by newlines (not inside any tag) - merge with previous paragraph
          formattedContext = formattedContext.replace(/(<\/p>)\s*\n+\s*(<a href="[^"]+">[^<]+<\/a>)\s*\n+\s*(?!<p>)/g, (match, p1, link) => {
            return p1.replace('</p>', ' ' + link + '</p>');
          });
          
          // Validate that hyperlink was generated
          if (!formattedContext.includes(`<a href="${article.url}">`)) {
            console.error(`CRITICAL ERROR: No hyperlink found in context for article "${article.headline}"`);
            console.error(`Expected URL: ${article.url}`);
            console.error(`Looking for pattern: <a href="${article.url}">`);
            console.error('Generated context text:', formattedContext);
            console.error('Context text length:', formattedContext.length);
            // Check if there's any hyperlink at all
            const hasAnyHyperlink = formattedContext.includes('<a href=');
            console.error('Has any hyperlink:', hasAnyHyperlink);
            if (hasAnyHyperlink) {
              // Extract any hyperlinks that were generated
              const hyperlinkMatches = formattedContext.match(/<a href="([^"]+)">/g);
              console.error('Found hyperlinks:', hyperlinkMatches);
            }
            // Skip this context if no hyperlink - it's invalid
            console.error('Skipping this context article due to missing hyperlink');
            continue;
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

// Function to add context to an article using hybrid insertion approach
async function addContextToArticle(article: string, contextText: string, isFirstArticle: boolean): Promise<string> {
  // For the first article, we need to generate a subhead and insert the context properly
  if (isFirstArticle) {
    // Find the optimal insertion point using hybrid approach
    const insertionResult = findOptimalInsertionPoint(article);
    const { insertionIndex, beforeContext, afterContext } = insertionResult;
    
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
    
    // Split article into paragraphs
    const paragraphs = article.split(/\n\n+/);
    
    // Insert the context at the calculated position
    paragraphs.splice(insertionIndex, 0, fullContextSection);
    
    return paragraphs.join('\n\n');
  } else {
    // For subsequent articles, space them out through the article (not back-to-back)
    // CRITICAL: Do NOT insert at the very end - distribute evenly through middle sections
    const paragraphs = article.split(/\n\n+/);
    
    // Find the "Read Next" or "Price Action" section
    const readNextIndex = paragraphs.findIndex(p => p.includes('Read Next:'));
    const priceActionIndex = paragraphs.findIndex(p => p.includes('Price Action:'));
    
    // Determine the content end (before Read Next/Price Action)
    let contentEndIndex = paragraphs.length;
    if (priceActionIndex !== -1) {
      contentEndIndex = priceActionIndex;
    } else if (readNextIndex !== -1) {
      contentEndIndex = readNextIndex;
    }
    
    // Find all existing context locations to avoid clustering
    const existingContextIndices = [];
    for (let i = 0; i < contentEndIndex; i++) {
      const para = paragraphs[i];
      // Look for context indicators: subheadings or paragraphs with hyperlinks discussing past events
      if ((para.length < 100 && para.length > 10 && !para.includes('<') && !para.includes('Read')) ||
          (para.includes('<a href=') && (para.includes('previously') || para.includes('has called') || para.includes('past')))) {
        existingContextIndices.push(i);
      }
    }
    
    // Space out subsequent context articles progressively through the article
    // First context at ~45%, second at ~65%, third at ~75%, etc. - but never at the end
    const contextCount = existingContextIndices.length > 0 ? existingContextIndices.length + 1 : 1;
    let targetPosition;
    
    if (contextCount === 2) {
      // Second context article: place at 65-70% through content
      targetPosition = Math.floor(contentEndIndex * 0.67);
    } else if (contextCount === 3) {
      // Third context article: place at 75-80% through content
      targetPosition = Math.floor(contentEndIndex * 0.77);
    } else {
      // Additional contexts: space further out
      targetPosition = Math.floor(contentEndIndex * (0.45 + (contextCount * 0.12)));
    }
    
    // Ensure we don't go too close to the end (leave at least 2 paragraphs)
    const maxPosition = Math.max(contentEndIndex - 2, 3);
    const insertionIndex = Math.min(targetPosition, maxPosition);
    
    // Also ensure we're not too close to existing context (at least 3 paragraphs away)
    let adjustedIndex = insertionIndex;
    for (const existingIndex of existingContextIndices) {
      if (Math.abs(adjustedIndex - existingIndex) < 3) {
        // Move it at least 3 paragraphs away
        adjustedIndex = existingIndex + 4;
        // But don't exceed max position
        if (adjustedIndex > maxPosition) {
          adjustedIndex = Math.max(existingIndex - 4, 3);
        }
      }
    }
    
    console.log(`Inserting context article #${contextCount} at paragraph ${adjustedIndex}, leaving ${contentEndIndex - adjustedIndex} paragraphs after to frame the story`);
    
    // Insert the additional context
    paragraphs.splice(adjustedIndex, 0, contextText);
    
    return paragraphs.join('\n\n');
  }
}

// Function to find optimal insertion point using hybrid approach
function findOptimalInsertionPoint(article: string): { 
  insertionIndex: number; 
  beforeContext: string; 
  afterContext: string; 
} {
  // Split article into paragraphs
  const paragraphs = article.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  // Find special sections that should come after context
  const priceActionIndex = paragraphs.findIndex(p => 
    p.includes('Price Action:') || 
    p.includes('Price Action')
  );
  const readNextIndex = paragraphs.findIndex(p => p.includes('Read Next:'));
  
  // Determine the content paragraphs (exclude Price Action and Read Next)
  let contentEndIndex = paragraphs.length;
  if (priceActionIndex !== -1) {
    contentEndIndex = priceActionIndex;
  } else if (readNextIndex !== -1) {
    contentEndIndex = readNextIndex;
  }
  
  // Calculate insertion point: 50-60% through content paragraphs, but at least after paragraph 3
  // CRITICAL: Never insert at the very end - leave at least 2 paragraphs after context to frame the story
  const minParagraphs = Math.min(3, contentEndIndex - 3);
  const idealPosition = Math.floor(contentEndIndex * 0.55); // 55% through content
  const maxPosition = Math.max(contentEndIndex - 2, minParagraphs + 1); // Leave at least 2 paragraphs at end
  const insertionIndex = Math.max(minParagraphs, Math.min(idealPosition, maxPosition));
  
  // Extract context before and after insertion point (for potential future use)
  const beforeContext = paragraphs.slice(Math.max(0, insertionIndex - 2), insertionIndex).join('\n\n');
  const afterContext = paragraphs.slice(insertionIndex, Math.min(insertionIndex + 2, contentEndIndex)).join('\n\n');
  
  console.log(`Article has ${paragraphs.length} total paragraphs, ${contentEndIndex} content paragraphs`);
  console.log(`Inserting context at paragraph ${insertionIndex} (${Math.round(insertionIndex/contentEndIndex*100)}% through content)`);
  console.log(`Leaving ${contentEndIndex - insertionIndex} paragraphs after context to frame the story`);
  
  return {
    insertionIndex,
    beforeContext,
    afterContext
  };
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
