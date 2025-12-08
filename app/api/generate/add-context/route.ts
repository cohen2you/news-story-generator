import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';
import { generateTopicUrl, MODEL_CONFIG } from '../../../../lib/api';
const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';

async function fetchContextArticle(currentArticle: string, excludeUrl?: string, previouslyUsedUrls: string[] = []): Promise<any | null> {
  try {
    // Extract key topics from the current article to find relevant context
    const topicPrompt = `
Extract 3-5 key topics or themes from this financial article that would be relevant for finding related news articles. Focus on:
- Company names, ticker symbols, or industry terms
- Key events, announcements, or market movements
- Regulatory or policy topics
- Technology or product-related terms

IMPORTANT: Prioritize the main company/ticker being discussed in the article. If the article is about a specific company (like Carvana, Apple, Tesla, etc.), that company name should be the primary topic.

Article: ${currentArticle.substring(0, 1000)}

Return only the topics as a comma-separated list, no explanations:`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
    const maxTokens = currentProvider === 'gemini' ? 8192 : 100;
    
    const topicResponse = await aiProvider.generateCompletion(
      [{ role: 'user', content: topicPrompt }],
      {
        model,
        maxTokens,
        temperature: 0.3,
      }
    );

    const topics = topicResponse.content.trim();
    if (!topics) return null;

    // Try each topic to find a relevant article
    const topicList = topics.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    for (const topic of topicList) {
      try {
        // Use the same logic as generateTopicUrl but for context articles
        const cleanTopic = topic.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleanTopic.length < 3) continue;

        const url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,created,body,url,channels&accept=application/json&displayOutput=full`;
        
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        
        if (!res.ok) continue;
        
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) continue;
        
        // Filter out press releases and the excluded URL
        const prChannelNames = ['press releases', 'press-releases', 'pressrelease', 'pr'];
        const normalize = (str: string) => str.toLowerCase().replace(/[-_]/g, ' ');
        
        const relevantArticles = data
          .filter(item => {
            // Exclude press releases
            if (Array.isArray(item.channels) && item.channels.some((ch: any) => 
              typeof ch.name === 'string' && prChannelNames.includes(normalize(ch.name))
            )) {
              return false;
            }
            
            // Exclude the current article URL if provided
            if (excludeUrl && item.url === excludeUrl) {
              return false;
            }
            
            // Exclude previously used URLs
            if (previouslyUsedUrls.includes(item.url)) {
              return false;
            }
            
            // Check if the article content is relevant to the topic
            const content = `${item.headline || ''} ${item.body || ''}`.toLowerCase();
            const headline = (item.headline || item.title || '').toLowerCase();
            
            // Enhanced relevance checking with industry context
            const topicWords = cleanTopic.split(' ');
            
            // Check for exact topic match first
            if (content.includes(cleanTopic)) {
              return true;
            }
            
            // Enhanced relevance scoring with industry context
            let relevanceScore = 0;
            
            // Check for exact topic matches
            if (content.includes(cleanTopic)) {
              relevanceScore += 100;
            }
            
            // Check for company-specific matches (higher weight for company names)
            const companyTerms = ['novo nordisk', 'wegovy', 'ozempic', 'eli lilly', 'zepbound', 'mounjaro', 'pfizer', 'moderna', 'johnson & johnson', 'j&j'];
            const foundCompany = companyTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundCompany) {
              relevanceScore += 80;
            }
            
            // Check for industry-specific terms (pharmaceutical, healthcare, etc.)
            const industryTerms = ['pharmaceutical', 'biotech', 'healthcare', 'fda', 'clinical trial', 'drug', 'medication', 'treatment', 'therapy', 'obesity', 'diabetes', 'weight loss'];
            const foundIndustry = industryTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundIndustry) {
              relevanceScore += 40;
            }
            
            // Check for word matches in headline and content
            const headlineMatches = topicWords.filter(word => 
              word.length > 2 && headline.includes(word)
            ).length;
            relevanceScore += headlineMatches * 15;
            
            const bodyMatches = topicWords.filter(word => 
              word.length > 2 && content.includes(word)
            ).length;
            relevanceScore += bodyMatches * 5;
            
            // Require minimum relevance score
            return relevanceScore >= 20;
          })
          .map((item: any) => {
            const content = `${item.headline || ''} ${item.body || ''}`.toLowerCase();
            const headline = (item.headline || item.title || '').toLowerCase();
            const topicWords = cleanTopic.split(' ');
            
            // Calculate enhanced relevance score
            let score = 0;
            
            // Exact topic match gets highest score
            if (content.includes(cleanTopic)) {
              score += 100;
            }
            
            // Company-specific matches get high priority
            const companyTerms = ['novo nordisk', 'wegovy', 'ozempic', 'eli lilly', 'zepbound', 'mounjaro', 'pfizer', 'moderna', 'johnson & johnson', 'j&j'];
            const foundCompany = companyTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundCompany) {
              score += 80;
            }
            
            // Industry-specific terms get medium priority
            const industryTerms = ['pharmaceutical', 'biotech', 'healthcare', 'fda', 'clinical trial', 'drug', 'medication', 'treatment', 'therapy', 'obesity', 'diabetes', 'weight loss'];
            const foundIndustry = industryTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundIndustry) {
              score += 40;
            }
            
            // Headline matches get higher score than body matches
            const headlineMatches = topicWords.filter(word => 
              word.length > 2 && headline.includes(word)
            ).length;
            score += headlineMatches * 20;
            
            const bodyMatches = topicWords.filter(word => 
              word.length > 2 && content.includes(word)
            ).length;
            score += bodyMatches * 5;
            
            // Penalize articles that seem unrelated to the industry
            const unrelatedTerms = ['web3', 'crypto', 'blockchain', 'gaming', 'sports', 'entertainment', 'fashion', 'food', 'travel'];
            const foundUnrelated = unrelatedTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundUnrelated) {
              score -= 50; // Significant penalty for unrelated content
            }
            
            return {
              headline: item.headline || item.title || '[No Headline]',
              body: item.body || '',
              url: item.url,
              created: item.created,
              score: score
            };
          })
          .filter(item => item.body && item.body.length > 100) // Ensure there's substantial content
          .sort((a, b) => b.score - a.score); // Sort by relevance score
        
        if (relevantArticles.length > 0) {
          return relevantArticles[0];
        }
      } catch (error) {
        console.error(`Error fetching article for topic "${topic}":`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching context article:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { currentArticle, excludeUrl, previouslyUsedUrls = [] } = await request.json();
    
    if (!currentArticle) {
      return NextResponse.json({ error: 'Current article is required.' }, { status: 400 });
    }

    // Fetch a relevant context article based on the current article's topics
    const contextArticle = await fetchContextArticle(currentArticle, excludeUrl, previouslyUsedUrls);
    
    if (!contextArticle) {
      return NextResponse.json({ error: 'No relevant context articles found.' }, { status: 404 });
    }

    // Generate condensed context using OpenAI
    const prompt = `
You are a financial journalist. Given the current article and a recent news article about the same ticker, create 1 very concise paragraph that adds relevant context to the current article.

Current Article (FULL TEXT - analyze completely):
${currentArticle}

Context News Article (FULL TEXT - analyze completely):
Headline: ${contextArticle.headline}
Content: ${contextArticle.body}

**CRITICAL STEP 1: ANALYZE BOTH ARTICLES FOR INTEGRATION**

A. READ THE FULL CURRENT ARTICLE:
   - What is the main topic/theme?
   - What sections/themes are discussed?
   - What tone and style is used?
   - Where are there natural topic transitions?
   - What information would benefit from additional context?

B. READ THE FULL CONTEXT NEWS ARTICLE:
   - What is the main point of this article?
   - What specific facts, numbers, and events does it contain?
   - How does this relate to the current article's themes?
   - What unique information does it add?

C. IDENTIFY THEMATIC CONNECTION:
   - Where in the current article does this context fit best thematically?
   - Which section would benefit most from this background?
   - How can this context enhance reader understanding?

**STEP 2: EXTRACT SPECIFIC FACTS FROM THE CONTEXT NEWS ARTICLE**

You MUST extract SPECIFIC, CONCRETE facts from the Context News Article:

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
- DO NOT reference facts from the Current Article above - ONLY use facts from the Context News Article
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

If you haven't extracted these, GO BACK and re-read the Context News Article.

**STEP 4: CRAFT SEAMLESS INTEGRATION**

Now that you understand BOTH articles completely:

1. **Write Context That Bridges**: Your paragraph should feel like a natural extension of the current article's narrative
2. **Use Transitional Flow**: Consider what topics come before and after in the current article
3. **Add Value**: Provide background that enhances the current story without repeating it
4. **Maintain Tone**: Match the style and tone of the current article

**STEP 5: WRITE YOUR PARAGRAPH**
Requirements:
1. Create EXACTLY 1 paragraph (2 sentences) using SPECIFIC FACTS from the Context News article
2. MANDATORY: Include at least 3-4 specific details (numbers, dates, events) from the Context News article
3. DO NOT reference facts from the Current Article - ONLY use facts from the Context News Article
4. Make it feel like it BELONGS in the current story - seamless integration
5. Consider where this will be placed and how it connects to surrounding content
3. **CRITICAL TEMPORAL CONTEXT**: The context article may be from a different time period than the current article. You MUST use temporal markers to show this is historical/background information:
   - Use phrases like: "has previously discussed", "in past interviews", "historically noted", "in earlier statements"
   - If quoting or referencing past events, use past tense: "said", "called", "described", "labeled"
   - Make it clear this is background context, not current news happening simultaneously
   - Connect past context to current developments: "This historical perspective may inform...", "This past decision reflects..."
4. Keep the paragraph to EXACTLY 2 sentences - no more, no less
4. **CRITICAL HYPERLINK INSTRUCTION**: 
   - You MUST replace the text "REPLACE_WITH_REAL_PHRASE" in this format: <a href="${contextArticle.url}">REPLACE_WITH_REAL_PHRASE</a>
   - "REPLACE_WITH_REAL_PHRASE" is a PLACEHOLDER - you must replace it with an actual 3-4 word phrase from YOUR sentence
   - Examples of good hyperlink phrases: "11.5% stock decline", "unexpected CEO announcement", "downgraded their rating", "Greg Abel succession"
   - The phrase you hyperlink should be words that ACTUALLY APPEAR in your sentence, not placeholder text
5. **FORBIDDEN PHRASES** - Do NOT use any of these:
   - "in an earlier article" / "a recent article" / "according to reports"
   - "as detailed in" / "as outlined in" / "as mentioned in"
   - "publicly acknowledged" / "has discussed" / "has reflected on" (without specifics)
   - "teaching moments" / "adds depth" / "illustrating an approach"
   - Any phrase that ends with the same words/concept that started the sentence
6. **ABSOLUTELY CRITICAL - HYPERLINK CREATION**:
   - DO NOT write "actual three word phrase" or "REPLACE_WITH_REAL_PHRASE" or "three word phrase" in your output
   - These are PLACEHOLDERS that you must REPLACE with real words from your sentence
   - Example: If you write "Berkshire's B shares declined 11.5% after the unexpected CEO announcement in May"
   - You could hyperlink: <a href="url">unexpected CEO announcement</a> or <a href="url">declined 11.5% after</a>
   - The hyperlinked words MUST be actual words from your sentence, not placeholder text
7. **CRITICAL**: Format the output with proper HTML paragraph tags. The paragraph should be wrapped in <p> tags.
8. **BANNED GENERIC STATEMENTS** - Do NOT write:
   - "publicly acknowledged many missteps" (too vague - name a SPECIFIC misstep)
   - "has reflected on challenges" (too vague - give SPECIFIC challenge)
   - "maintains a cautious strategy" (too vague - give SPECIFIC action)
   - "teaching moments for others" (too vague - give SPECIFIC lesson/example)
   - "might create advantageous entry points" (too vague - use SPECIFIC numbers/facts)
   - "aligns with earlier observations" (too vague - what specific earlier observation?)
   - "influencing his decision-making amidst trends" (too vague and wordy)
9. **CRITICAL - DO NOT FABRICATE QUOTES OR STATEMENTS**:
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
11. NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
    * First reference: Use the full name with the entire name in bold using HTML <strong> tags (e.g., "<strong>Bill Ackman</strong>" or "<strong>Warren Buffett</strong>")
    * Second and subsequent references: Use only the last name without bolding (e.g., "Ackman" or "Buffett")
    * This applies to all people mentioned in the context paragraph
12. **CRITICAL - NO WORD DUPLICATION**: Do NOT repeat the same key phrases, terms, or concepts within the paragraph. Each sentence must introduce NEW information.
13. Use AP style and maintain a professional tone

**GOOD EXAMPLES (SPECIFIC FACTS, PROPER HYPERLINKS, CLEAR INTEGRATION):**

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

**BAD EXAMPLES (DO NOT WRITE LIKE THIS):**

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

**CRITICAL**: You MUST include the hyperlink. Do not skip this requirement.

Write the 1 context paragraph now (ONLY 1 PARAGRAPH with 2 sentences):`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
    const maxTokens = currentProvider === 'gemini' ? 8192 : 1500;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.8,
      }
    );

    const contextParagraphs = response.content.trim();

    // Log provider info
    console.log(`\n📊 AI PROVIDER for context generation:`);
    console.log(`   - Provider: ${response.provider}`);
    console.log(`   - Model: ${model}\n`);

    // Debug: Log the generated context to see if hyperlinks are included
    console.log('Generated context paragraphs:', contextParagraphs);
    console.log('Contains hyperlink:', contextParagraphs.includes('<a href='));

    if (!contextParagraphs) {
      return NextResponse.json({ error: 'Failed to generate context.' }, { status: 500 });
    }

    // Ensure proper HTML paragraph formatting
    const formattedContextParagraphs = contextParagraphs
      .replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks to double
      .replace(/\n([^<])/g, '\n\n$1') // Ensure paragraphs are separated by double line breaks
      .replace(/([^>])\n\n([^<])/g, '$1\n\n$2') // Ensure proper spacing around HTML tags
      .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
      .replace(/(<p>.*?<\/p>)\s*(<p>.*?<\/p>)/g, '$1\n\n$2'); // Ensure proper spacing between <p> tags

    // Generate subhead first
    let contextSubhead = '';
    try {
      const contextSubheadPrompt = `
You are a top-tier financial journalist. Given the context that was just added to the article, create exactly 1 compelling subhead that introduces the context section.

The context section provides additional background information and relevant details about the ticker.

CONTEXT PARAGRAPHS TO BASE SUBHEAD ON:
${formattedContextParagraphs}

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

      const currentProvider = aiProvider.getCurrentProvider();
      const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
      const maxTokens = currentProvider === 'gemini' ? 8192 : 50;
      
      const contextSubheadResponse = await aiProvider.generateCompletion(
        [{ role: 'user', content: contextSubheadPrompt }],
        {
          model,
          maxTokens,
          temperature: 0.7,
        }
      );

      contextSubhead = contextSubheadResponse.content.trim();
      if (contextSubhead) {
        contextSubhead = contextSubhead.replace(/\*\*/g, '').replace(/^##\s*/, '').replace(/^["']|["']$/g, '').trim();
      }
    } catch (error) {
      console.error('Error generating context subhead:', error);
    }

    // Insert context and subhead together using hybrid approach
      const subheadSection = contextSubhead ? `${contextSubhead}\n\n\n${formattedContextParagraphs}` : formattedContextParagraphs;
    const updatedArticleWithSubheads = insertContextIntoArticle(currentArticle, subheadSection);
    
    return NextResponse.json({ 
      updatedArticle: updatedArticleWithSubheads,
      contextSource: {
        headline: contextArticle.headline,
        url: contextArticle.url
      }
    });
  } catch (error: any) {
    console.error('Error adding context:', error);
    return NextResponse.json({ error: error.message || 'Failed to add context.' }, { status: 500 });
  }
}

// Function to insert context into article using hybrid approach
function insertContextIntoArticle(article: string, contextSection: string): string {
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
  
  console.log(`Article has ${paragraphs.length} total paragraphs, ${contentEndIndex} content paragraphs`);
  console.log(`Inserting context at paragraph ${insertionIndex} (${Math.round(insertionIndex/contentEndIndex*100)}% through content)`);
  console.log(`Leaving ${contentEndIndex - insertionIndex} paragraphs after context to frame the story`);
  
  // Insert the context at the calculated position
  paragraphs.splice(insertionIndex, 0, contextSection);
  
  return paragraphs.join('\n\n');
}