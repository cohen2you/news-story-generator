import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';

const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';
const MODEL = 'gpt-4o';

// Helper function to get current date in readable format
function getCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return now.toLocaleDateString('en-US', options);
}

// Helper function to get day name from a date string or Date object
function getDayName(dateInput?: string | Date): string {
  let date: Date;
  if (!dateInput) {
    date = new Date();
  } else if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else {
    date = dateInput;
  }
  
  const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
  return date.toLocaleDateString('en-US', options);
}

async function fetchRelatedArticles(ticker: string, excludeUrl?: string): Promise<any[]> {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    
    let url: string;
    
    if (ticker && ticker.trim() !== '') {
      // Fetch ticker-specific articles
      url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&tickers=${encodeURIComponent(ticker)}&items=20&fields=headline,title,created,url,channels&accept=application/json&displayOutput=full&dateFrom=${dateFromStr}`;
    } else {
      // Fetch general market news when no ticker is provided
      url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,created,url,channels&accept=application/json&displayOutput=full&dateFrom=${dateFromStr}`;
    }
    
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    
    if (!res.ok) {
      console.error('Benzinga API error:', await res.text());
      return [];
    }
    
    const data = await res.json();
    console.log('Benzinga API response type:', typeof data, Array.isArray(data) ? 'array' : 'not array');
    console.log('Benzinga API response length:', Array.isArray(data) ? data.length : 'N/A');
    if (!Array.isArray(data)) return [];
    
    // Filter out press releases and the current article URL
    const prChannelNames = ['press releases', 'press-releases', 'pressrelease', 'pr'];
    const normalize = (str: string) => str.toLowerCase().replace(/[-_]/g, ' ');
    
    const filteredArticles = data.filter(item => {
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
      
      return true;
    });
    
    console.log('Articles after filtering:', filteredArticles.length);
    
    const relatedArticles = filteredArticles
      .map((item: any) => ({
        headline: item.headline || item.title || '[No Headline]',
        url: item.url,
        created: item.created,
      }))
      .slice(0, 5);
    
    console.log('Final related articles:', relatedArticles.length);
    return relatedArticles;
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

function buildPRPrompt({ ticker, sourceText, priceSummary, sourceUrl, sourceDateFormatted, relatedArticles, includeCTA, ctaText, includeSubheads, subheadTexts }: { ticker: string; sourceText: string; priceSummary: string; sourceUrl?: string; sourceDateFormatted?: string; relatedArticles?: any[]; includeCTA?: boolean; ctaText?: string; includeSubheads?: boolean; subheadTexts?: string[] }) {
  
  console.log('buildPRPrompt called with sourceUrl:', sourceUrl);
  console.log('sourceUrl type:', typeof sourceUrl);
  console.log('sourceUrl length:', sourceUrl?.length);
  
  const ctaSection = includeCTA && ctaText ? `\n- CTA Integration: After the lead paragraph, insert the following CTA exactly as provided:\n  ${ctaText}` : '';
  
  const subheadsSection = includeSubheads && subheadTexts && subheadTexts.length > 0 ? `\n- Subhead Integration: Insert the following subheads at specific positions:\n  ${subheadTexts.map((subhead, index) => `${index + 1}. ${subhead}`).join('\n  ')}\n  
  CRITICAL SUBHEAD PLACEMENT RULES:
  - First subhead: If there's a CTA line, place the first subhead immediately after the CTA line. If there's no CTA line, place the first subhead after the first or second paragraph (whichever provides better flow).
  - Second subhead: Place after approximately 50% of the content, ensuring it covers at least 2 paragraphs.
  - Third subhead: Place after approximately 80% of the content, ensuring it covers at least 2 paragraphs.
  - Each subhead must cover at least 2 paragraphs of content - do not place subheads too close together.
  - CRITICAL FORMATTING: Each subhead MUST be formatted as an H2 HTML tag using this exact format: <h2>Subhead Text Here</h2>
  - Format each subhead as a standalone line with proper spacing before and after (one empty line before and after the H2 tag).
  - Do not place subheads in the lead paragraph or immediately after the lead paragraph.
  - Subheads should reflect factual sections (e.g., "IPO Timing," "Operational Drivers," "Market Context") - not generic topics.
  - Example format: <h2>Why This Move Changes Everything</h2>
` : '';

  const relatedArticlesSection = relatedArticles && relatedArticles.length > 0 ? `\n- CRITICAL "ALSO READ" PLACEMENT: You MUST insert the "Also Read:" section immediately after the SECOND paragraph (the paragraph that comes after the lead paragraph). This is NOT optional. The format must be exactly: <p>Also Read: <a href="${relatedArticles[0].url}">${relatedArticles[0].headline}</a></p>
  
  IMPORTANT: Count paragraphs starting from the lead paragraph:
  - Paragraph 1: Lead paragraph (the first paragraph)
  - Paragraph 2: First additional paragraph (after the lead)
  - Paragraph 3: "Also Read" section MUST go here (after paragraph 2)
  - Paragraph 4+: Continue with remaining content
  
  DO NOT place "Also Read" at the end of the article. It MUST come after the second paragraph.` : '';
  
  return `${sourceUrl ? `🚨🚨🚨 CRITICAL HYPERLINK REQUIREMENT - READ THIS FIRST 🚨🚨🚨
You MUST include a THREE-WORD hyperlink in the lead paragraph. This is MANDATORY and your output will be REJECTED without it.
- The hyperlink MUST be: <a href="${sourceUrl}">three word phrase</a>
- Replace "three word phrase" with EXACTLY THREE WORDS from the actual news content (e.g., "announced on Wednesday", "successfully launched the", "completed the orbital")
- The hyperlink MUST be embedded WITHIN the lead paragraph sentence, NOT on its own line
- **VERIFY**: Before submitting, check that your output contains: <a href="${sourceUrl}">
- **YOUR OUTPUT WILL BE REJECTED IF THE HYPERLINK IS MISSING FROM THE LEAD PARAGRAPH**

` : ''}You are a professional financial news writer for Benzinga. Transform the provided press release into a concise, tight Benzinga-style financial news article.

CRITICAL QUOTE REQUIREMENT: 
You MUST include at least one direct quote from the source material. Look for text that appears in quotation marks in the source and include it exactly as written. This is MANDATORY and takes priority over other instructions.

**BENZINGA NEWS STYLE - MANDATORY:**
Write the story in a tight, data-driven Benzinga news style. Follow these rules:

**STRUCTURE - Keep it clean and linear:**
Lead → Confirmation + Details → Market Context → Operational Drivers → Forward-Looking Statements.

**CRITICAL CONTENT RULES:**
- Do NOT repeat facts, themes, or quotes anywhere in the story. Each piece of information should appear only once.
- Do NOT broaden the narrative beyond the core topic. Avoid side tangents (e.g., unrelated industry shifts, consumer deals, secondary partnerships) unless they directly support the valuation or market impact.
- Keep paragraphs short and focused. Each paragraph should deliver ONE idea only.
- Use specific financial details, metrics, subscriber counts, revenue figures, contract information, or valuation numbers to ground the story. Avoid vague statements.
- Avoid generic or motivational framing. Do NOT restate the same point in different wording.
- Do NOT over-explain or add background unrelated to the core valuation/IPO/news story.
- Maintain a crisp, newsroom tone — fast pacing, clean transitions, no filler.
- No narrative drift. If a fact cannot be tied directly to valuation, market relevance, or growth engines, exclude it.

Write a concise, fact-based news article (about 350 words)${ticker && ticker.trim() !== '' ? ` about the stock with ticker: ${ticker}` : ''}. Use the provided press release text as your main source${ticker && ticker.trim() !== '' ? `. 

CRITICAL COMPANY INCLUSION RULES:
- PRIMARY FOCUS: ${ticker} is the primary company - lead with this company and make it the main focus of the article
- OTHER COMPANIES: You MUST include details, quotes, and context from OTHER companies mentioned in the source text (even if they have different tickers)
- Include specific information about other companies such as: company names, tickers, quotes from their executives, product launches, financial results, partnerships, or strategic moves
- When other companies are mentioned in the source, include their ticker symbols in the format: Company Name (NYSE: TICKER) or (NASDAQ: TICKER)
- Use other companies to provide market context, competitive landscape, or industry trends that relate to ${ticker}
- Do NOT ignore other companies - they provide valuable context and should be included in the article
- Example: If the source mentions "Doseology Sciences Inc. (CSE:MOOD)" and "Philip Morris International (NYSE:PM)", include their details, quotes, and context in your article` : ''}.

CRITICAL FORMATTING RULES:
- NO paragraph should be longer than 2 sentences
- Break up any long paragraphs into multiple shorter ones
- Use HTML tags for formatting, not markdown

Structure your article as follows:
- CRITICAL: Do NOT include a headline in your output. Start directly with the lead paragraph. The headline will be handled separately.

- Lead paragraph: Start with the most important news event or development from the press release. Focus on what happened, not on stock price movement. Use the full company name and ticker in this format: <strong>Company Name</strong> (NYSE: TICKER) if a specific company is involved, or focus on the news event itself if it's broader market news. The company name should be bolded using HTML <strong> tags. Do not use markdown bold (**) or asterisks elsewhere. State what happened and why it matters in exactly 2 concise sentences.

🚨 CRITICAL PRESS RELEASE HYPERLINK RULE - MANDATORY: 
You MUST include a THREE-WORD hyperlink to the press release source in the lead paragraph. ${sourceUrl ? `The lead paragraph MUST contain exactly one hyperlink using this exact format: <a href="${sourceUrl}">three word phrase</a> - where "three word phrase" is EXACTLY THREE WORDS (not two, not four, EXACTLY THREE) from the actual news content in your sentence. 

CRITICAL: Do NOT use phrases that reference the source itself like "press release states", "announcement reveals", "statement indicates", or any meta-references to the press release. Instead, use three words from the actual news story itself.

Examples of GOOD three-word phrases (from the news content):
- "announced today that"
- "plans to expand"
- "reported strong earnings"
- "will launch new"
- "has completed the"
- "expects revenue to"
- "intends to acquire"

Examples of BAD phrases (avoid these - they reference the source):
- "press release states" ❌
- "announcement reveals that" ❌
- "statement indicates the" ❌
- "company announcement says" ❌

The hyperlink MUST span exactly three consecutive words from the natural news content. Do NOT use two words or four words - it MUST be three words. Embed this hyperlink naturally within the sentence flow, NOT at the beginning or end. The hyperlink should be part of the natural news text, not a reference to the source.` : 'If a source URL is provided, the lead paragraph MUST contain a THREE-WORD hyperlink (exactly three words, not two or four) from the actual news content, embedded naturally in the text.'}

CRITICAL PRESS RELEASE FORMATTING: 
- This is an internal press release, so do NOT include any external source attributions like "reports" or "according to [publication]"
- Do NOT reference the source by name (e.g., "The company reports" or "According to the press release")
- Do NOT use phrases like "press release states", "announcement reveals", "statement indicates" - these are meta-references to the source
- The press release is the primary source - write as if you are reporting the news directly
- Simply include the THREE-WORD hyperlink (exactly three words, not two or four) in the lead paragraph using words from the actual news content itself, not words that reference the source

CRITICAL LEAD PARAGRAPH RULES:
- The lead paragraph MUST be exactly 2 concise sentences maximum. Keep it tight and focused. If you have more information, create additional paragraphs.
- ALWAYS identify the specific day when the news occurred using ONLY the day name (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday). 
- If the source text mentions a specific date, convert it to ONLY the day name (e.g., "December 23" becomes "Tuesday" or "Wednesday" depending on the actual day).
- CRITICAL: When mentioning the day, use ONLY the day name. NEVER include both the day name AND the date together (e.g., "on Tuesday, December 23" is WRONG - use only "on Tuesday").
- NEVER write "on Tuesday, December 23" or "on Wednesday, Dec 23" - use ONLY the day name: "on Tuesday" or "on Wednesday".
- If the source mentions both an announcement date and an event date, use the event date (when the actual news happened) for the lead, not the announcement date.
- If no specific date is mentioned, use the current day name: ${getDayName()}.
- NEVER use "today", "yesterday", "tomorrow", or "recently" - always specify the actual day name.
- NEVER use date formats like "December 23", "Dec 23", or any month/day combination - always use ONLY the day name instead.
- Do not force price movement timing if the news is not about stock price changes.

- NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
  * First reference: Use the full name with the entire name in bold using HTML <strong> tags (e.g., "President <strong>Donald Trump</strong>" or "CEO <strong>Tim Cook</strong>")
  * Second and subsequent references: Use only the last name without bolding (e.g., "Trump" or "Cook")
  * This applies to all people mentioned in the article, including politicians, executives, etc.

- DATE FORMATTING: NEVER include dates with month names (e.g., "December 23", "January 15"). Use ONLY day names (Monday, Tuesday, etc.) throughout the entire article. Do not include any date formats anywhere in the article.

- Additional paragraphs: Provide factual details, context, and any relevant quotes${ticker && ticker.trim() !== '' ? ` about ${ticker}` : ''}. MANDATORY: Include at least one direct quote from the source material using quotation marks. If multiple relevant quotes exist, include up to two quotes. Look for text in the source that is already in quotation marks and use those exact quotes. When referencing dates in additional paragraphs, use day names (Monday, Tuesday, etc.) instead of date formats. NEVER use "today", "yesterday", "tomorrow", or "recently" - always specify the actual day name.

CRITICAL: You MUST include information about OTHER companies mentioned in the source text. If the source mentions multiple companies (e.g., Doseology, Philip Morris, Zevia, Lifeway, etc.), include their:
- Company names with ticker symbols (e.g., "Doseology Sciences Inc. (CSE:MOOD)" or "Philip Morris International (NYSE:PM)")
- Specific quotes from their executives
- Product launches, financial results, partnerships, or strategic announcements
- How they relate to or provide context for ${ticker && ticker.trim() !== '' ? `the primary company (${ticker})` : 'the main story'}
- Market trends or industry context they represent

Do NOT write an article that only mentions the primary company. The source text contains multiple companies for a reason - include them to provide comprehensive market context.

CRITICAL: Each paragraph must be no longer than 2 sentences. If you have more information, create additional paragraphs.

${ctaSection}

${subheadsSection}

${relatedArticlesSection}

${ticker && ticker.trim() !== '' ? `- At the very bottom, include the following price action summary for ${ticker} exactly as provided, but with these modifications:
  - Bold the ticker and "Price Action:" part using HTML <strong> tags (e.g., <strong>AA Price Action:</strong>)
  - Hyperlink "according to Benzinga Pro." to https://pro.benzinga.com/ using <a href="https://pro.benzinga.com/">according to Benzinga Pro.</a>
${priceSummary}` : ''}

${relatedArticles && relatedArticles.length > 0 ? `
- After the price action, add a "Read Next:" section in its own separate paragraph with the following format:
  <p>Read Next: <a href="${relatedArticles[1]?.url || relatedArticles[0].url}">${relatedArticles[1]?.headline || relatedArticles[0].headline}</a></p>
  CRITICAL: The "Read Next" section MUST be in its own paragraph, separate from the main article content.
` : ''}

WRITING STYLE: Write in a direct, conversational tone that sounds natural and engaging. Avoid overly formal or AI-like language such as "garnered attention," "expressed a favorable outlook," or "emphasized that." Instead, use simple, clear language that flows naturally.

Examples of what to avoid:
- "garnered attention from" → "caught the eye of" or "drew comments from"
- "expressed a favorable outlook" → "said he likes" or "is bullish on"
- "emphasized that" → "noted" or "said"
- "encounter volatility" → "face ups and downs" or "see price swings"

**BENZINGA STYLE ENFORCEMENT:**
- Maintain a crisp, newsroom tone with fast pacing and clean transitions
- No filler words or unnecessary explanations
- Each sentence must advance the story - no repetition or restatement
- Focus on data, metrics, and specific financial details
- If information doesn't directly relate to valuation, market impact, or growth drivers, exclude it
- Keep the narrative tight and focused on the core topic

Keep the tone neutral and informative, suitable for a financial news audience. Do not include speculation or personal opinion. 

CRITICAL HTML FORMATTING: You MUST wrap each paragraph in <p> tags. The output should be properly formatted HTML with each paragraph separated by <p> tags. Example:
<p>First paragraph content.</p>
<p>Second paragraph content.</p>
<p>Third paragraph content.</p>

REMEMBER: 
- NO paragraph should exceed 2 sentences. Break up longer content into multiple paragraphs.
- The THREE-WORD hyperlink (exactly three words, not two or four) MUST appear in the lead paragraph, embedded naturally in the text.
- Do NOT include source attributions like "reports" or "according to [publication]".
- Write as if reporting the news directly from the press release.
- CRITICAL: The hyperlink text MUST be exactly three words. Count the words: word1 word2 word3 = 3 words. Do NOT use two words or four words.

Source Text (Press Release):
${sourceText}

Write the article now.`;
}

export async function POST(req: Request) {
  try {
    const requestBody = await req.json();
    let { ticker, sourceText, priceSummary, sourceUrl, sourceDateFormatted, includeCTA, ctaText, includeSubheads, subheadTexts, provider: requestedProvider } = requestBody;
    if (!sourceText) return NextResponse.json({ error: 'Source text is required.' }, { status: 400 });
    
    console.log(`\n🔍 PR STORY PROVIDER DEBUG:`);
    console.log(`   - Provider value received: "${requestedProvider}"`);
    console.log(`   - Current singleton provider: ${aiProvider.getCurrentProvider()}`);
    
    console.log('Source text length:', sourceText.length);
    console.log('Source text preview:', sourceText.substring(0, 200));
    console.log('Ticker provided:', ticker);
    console.log('includeSubheads:', includeSubheads);
    console.log('subheadTexts provided:', subheadTexts ? subheadTexts.length : 0);
    
    // If subheads are requested but not provided, generate them automatically
    if (includeSubheads && (!subheadTexts || subheadTexts.length === 0)) {
      console.log('⚠️ Subheads requested but not provided. Generating subheads automatically...');
      try {
        // Generate a basic story first to use for subhead generation
        const basicPrompt = buildPRPrompt({ 
          ticker, 
          sourceText, 
          priceSummary: priceSummary || '', 
          sourceUrl, 
          sourceDateFormatted, 
          relatedArticles: [], 
          includeCTA: false, 
          ctaText: '', 
          includeSubheads: false, 
          subheadTexts: [] 
        });
        
        // Use requested provider if provided, otherwise get current
        let currentProvider: 'openai' | 'gemini';
        if (requestedProvider && (requestedProvider === 'openai' || requestedProvider === 'gemini')) {
          const current = aiProvider.getCurrentProvider();
          if (current !== requestedProvider) {
            await aiProvider.setProvider(requestedProvider);
          }
          currentProvider = requestedProvider;
        } else {
          currentProvider = aiProvider.getCurrentProvider();
        }
        
        const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
        const maxTokens = currentProvider === 'gemini' ? 8192 : 900;
        
        const basicStoryResponse = await aiProvider.generateCompletion(
          [
            {
              role: 'system',
              content: 'You are a professional financial journalist for Benzinga. You MUST include at least one direct quote from the source material in every article you write.'
            },
            { role: 'user', content: basicPrompt }
          ],
          {
            model,
            maxTokens,
            temperature: 0.5,
          }
        );
        
        const basicStory = basicStoryResponse.content.trim();
        
        if (basicStory) {
          // Now generate subheads from the basic story
          const subheadPrompt = `
          You Are A Top-Tier Financial Journalist Writing For A Leading Financial News Website.
          
          Given The Article Below, Generate Exactly 3 Standalone Mini Headlines (H2s) That Serve As Compelling Section Introductions.
          
          CRITICAL REQUIREMENTS:
          - Generate EXACTLY 3 standalone mini headlines - no more, no less.
          - Each H2 must be a standalone mini headline that provides specific perspective on the content that follows.
          - H2s should be 4-8 words maximum for maximum impact.
          - Each H2 must be unique in structure and style - use variety:
            * One could be a bold statement or insight
            * One could be a question that creates curiosity
            * One could be a "How to" or "Why" format
            * One could be a data-driven observation
            * One could be a trend or pattern identifier
          - Make each H2 highly engaging and clickable - they should make readers want to continue reading.
          - Focus on specific insights, trends, or actionable information rather than generic topics.
          - Use strong, active language that conveys authority and expertise.
          - Avoid bland, obvious, or generic headings like "Market Analysis" or "Technical Insights".
          - Each H2 should preview a specific angle or insight that will be explored in that section.
          - Capitalize the first letter of every word in each H2 heading.
          - Ensure each H2 provides a unique perspective that adds value to the reader's understanding.
          
          Article:
          ${basicStory}
          
          Generate 3 Standalone Subheads:
          `.trim();
          
          const subheadResponse = await aiProvider.generateCompletion(
            [{ role: 'user', content: subheadPrompt }],
            {
              model: currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini',
              maxTokens: currentProvider === 'gemini' ? 8192 : 200,
              temperature: 0.8,
            }
          );
          
          const h2Headings = subheadResponse.content.trim();
          const lines = h2Headings.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          
          // Extract the first 3 valid H2 headings
          const extractedH2s: string[] = [];
          for (const line of lines) {
            if (extractedH2s.length >= 3) break;
            
            // Clean the line
            const cleanedLine = line.replace(/\*\*/g, '').replace(/^##\s*/, '').trim()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            if (
              cleanedLine &&
              cleanedLine.length >= 10 &&
              cleanedLine.length <= 60 &&
              !cleanedLine.includes('Article:') &&
              !cleanedLine.includes('Generate') &&
              !cleanedLine.includes('Examples') &&
              !cleanedLine.includes('CRITICAL') &&
              !cleanedLine.includes('REQUIREMENTS')
            ) {
              extractedH2s.push(cleanedLine);
            }
          }
          
          // If we don't have exactly 3 H2s, use fallbacks
          const fallbackH2s = [
            'Why This Move Changes Everything',
            'The Hidden Signal Smart Money Sees',
            'Three Catalysts Driving This Action',
            'How Wall Street Is Positioning Now',
            'The Technical Pattern That Reveals All',
            'Why Analysts Are Suddenly Bullish',
            'The Volume Surge That Changes Everything',
            'Three Reasons This Rally Is Different'
          ];
          
          const finalH2s = [...extractedH2s];
          for (let i = finalH2s.length; i < 3; i++) {
            const fallbackIndex = (i - extractedH2s.length) % fallbackH2s.length;
            finalH2s.push(fallbackH2s[fallbackIndex]);
          }
          
          subheadTexts = finalH2s.slice(0, 3);
          console.log('✅ Generated subheads automatically:', subheadTexts);
        }
      } catch (subheadError) {
        console.error('❌ Error generating subheads automatically:', subheadError);
        // Continue without subheads if generation fails
        includeSubheads = false;
      }
    }
    
    // Fetch related articles
    const relatedArticles = await fetchRelatedArticles(ticker, sourceUrl);
    console.log('Related articles fetched:', relatedArticles.length, 'articles');
    
    console.log('Building PR prompt with sourceUrl:', sourceUrl);
    const prompt = buildPRPrompt({ ticker, sourceText, priceSummary: priceSummary || '', sourceUrl, sourceDateFormatted, relatedArticles, includeCTA, ctaText, includeSubheads, subheadTexts });
    console.log('Related articles in prompt:', relatedArticles.length);
    console.log('First related article:', relatedArticles[0]?.headline);
    console.log('Prompt preview (first 500 chars):', prompt.substring(0, 500));
    
    // Use requested provider if provided, otherwise get current provider
    let currentProvider: 'openai' | 'gemini';
    if (requestedProvider && (requestedProvider === 'openai' || requestedProvider === 'gemini')) {
      // Set the provider if it's different from current
      const current = aiProvider.getCurrentProvider();
      if (current !== requestedProvider) {
        await aiProvider.setProvider(requestedProvider);
      }
      currentProvider = requestedProvider;
    } else {
      currentProvider = aiProvider.getCurrentProvider();
    }
    
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
    const maxTokens = currentProvider === 'gemini' ? 8192 : 900;
    
    console.log(`\n📊 AI PROVIDER for PR story generation:`);
    console.log(`   - Provider: ${currentProvider}`);
    console.log(`   - Model: ${model}`);
    console.log(`   - Max Tokens: ${maxTokens}\n`);
    
    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a professional financial journalist for Benzinga. You MUST include at least one direct quote from the source material in every article you write. Look for text that appears in quotation marks in the source and include it exactly as written. This is MANDATORY for journalistic integrity and credibility.'
        },
        { role: 'user', content: prompt }
      ],
      {
        model,
        maxTokens,
        temperature: 0.5,
      }
    );
    
    let story = response.content.trim();
    
    console.log('\n📝 PR STORY GENERATION DEBUG:');
    console.log(`   - Response provider: ${response.provider}`);
    console.log(`   - Response content length: ${response.content ? response.content.length : 0}`);
    console.log(`   - Story after trim length: ${story.length}`);
    console.log(`   - Story preview (first 500 chars):`, story.substring(0, 500));
    
    if (story.length === 0) {
      console.error('❌ ERROR: Story content is empty!');
      return NextResponse.json({ 
        error: 'Story generation returned empty content. Please try again or check the source material.',
        provider: response.provider,
        model: model
      }, { status: 500 });
    }
    
    console.log('Source URL provided:', sourceUrl);
    
    // CRITICAL: Ensure the three-word hyperlink is in the lead paragraph - retry if missing
    if (sourceUrl && !story.includes(`href="${sourceUrl}"`)) {
      console.log('⚠️ WARNING: Three-word hyperlink not found in story. Retrying with explicit hyperlink requirement...');
      
      // Extract the first paragraph (lead) to check
      const firstParagraphMatch = story.match(/<p>(.*?)<\/p>/);
      const leadParagraph = firstParagraphMatch ? firstParagraphMatch[1] : story.split('</p>')[0];
      
      // Create a retry prompt with ultra-explicit hyperlink instructions
      const retryPrompt = `${prompt}

🚨🚨🚨 CRITICAL RETRY - HYPERLINK WAS MISSING 🚨🚨🚨
Your previous output was REJECTED because it did not include the required hyperlink in the lead paragraph.

CURRENT LEAD PARAGRAPH (MISSING HYPERLINK):
${leadParagraph}

YOU MUST REGENERATE THE LEAD PARAGRAPH WITH THE HYPERLINK INCLUDED.

The lead paragraph MUST contain: <a href="${sourceUrl}">three word phrase</a>

Where "three word phrase" is EXACTLY THREE WORDS from the news content (e.g., "announced on Wednesday", "successfully launched the", "completed the orbital").

The hyperlink MUST be embedded naturally within the sentence, not at the beginning or end.

Example format:
<strong>AST SpaceMobile</strong> (NASDAQ: ASTS) <a href="${sourceUrl}">announced on Wednesday</a> the successful orbital launch of BlueBird 6, marking a significant milestone in space-based cellular communications.

REGENERATE THE ENTIRE ARTICLE NOW WITH THE HYPERLINK IN THE LEAD PARAGRAPH.`;

      try {
        const retryResponse = await aiProvider.generateCompletion(
          [
            {
              role: 'system',
              content: 'You are a professional financial journalist for Benzinga. You MUST include at least one direct quote from the source material in every article you write. Look for text that appears in quotation marks in the source and include it exactly as written. This is MANDATORY for journalistic integrity and credibility.'
            },
            { role: 'user', content: retryPrompt }
          ],
          {
            model,
            maxTokens,
            temperature: 0.5,
          }
        );
        
        const retryStory = retryResponse.content.trim();
        
        if (retryStory.includes(`href="${sourceUrl}"`)) {
          console.log('✅ SUCCESS: Hyperlink included in retry');
          story = retryStory;
        } else {
          console.error('❌ ERROR: Hyperlink still missing after retry. Manually inserting hyperlink...');
          // Last resort: manually insert hyperlink in the lead paragraph
          if (firstParagraphMatch) {
            const leadContent = firstParagraphMatch[1];
            // Find a three-word phrase to hyperlink (preferably near the beginning)
            const words = leadContent.replace(/<[^>]*>/g, '').split(/\s+/);
            if (words.length >= 3) {
              // Use first three words that make sense
              const threeWords = words.slice(0, 3).join(' ');
              const hyperlinkedLead = leadContent.replace(
                new RegExp(threeWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
                `<a href="${sourceUrl}">${threeWords}</a>`
              );
              story = story.replace(firstParagraphMatch[0], `<p>${hyperlinkedLead}</p>`);
              console.log('✅ Manually inserted hyperlink in lead paragraph');
            }
          }
        }
      } catch (retryError) {
        console.error('❌ ERROR during retry:', retryError);
        // Continue with original story even if retry fails
      }
    } else if (sourceUrl && story.includes(`href="${sourceUrl}"`)) {
      console.log('✅ Hyperlink found in story');
    }
    
    // Ensure "Also Read" and "Read Next" sections are included if related articles are available
    console.log('Processing related articles sections...');
    if (relatedArticles && relatedArticles.length > 0) {
      console.log('Related articles available:', relatedArticles.length);
      
      // Check if "Also Read" section exists and is in the correct position
      const alsoReadPattern = /<p>Also Read:.*?<\/p>/i;
      const alsoReadMatch = story.match(alsoReadPattern);
      const alsoReadExists = !!alsoReadMatch;
      
      // Find where "Also Read" currently is
      const paragraphs = story.split('</p>').filter(p => p.trim().length > 0);
      const alsoReadIndex = alsoReadMatch ? paragraphs.findIndex(p => p.includes('Also Read:')) : -1;
      
      // Target position: after the second paragraph (index 2, which is the 3rd element: lead, para1, Also Read)
      const targetIndex = 2;
      
      if (alsoReadExists && alsoReadIndex === targetIndex) {
        console.log('"Also Read" section already exists in correct position');
      } else {
        // Remove existing "Also Read" if it's in the wrong place
        if (alsoReadExists && alsoReadIndex !== -1) {
          console.log(`Moving "Also Read" from position ${alsoReadIndex} to position ${targetIndex}`);
          paragraphs.splice(alsoReadIndex, 1);
        } else if (!alsoReadExists) {
          console.log('Adding "Also Read" section');
        }
        
        // Insert "Also Read" at the correct position (after second paragraph)
        if (paragraphs.length >= 2) {
          const alsoReadSection = `<p>Also Read: <a href="${relatedArticles[0].url}">${relatedArticles[0].headline}</a></p>`;
          paragraphs.splice(targetIndex, 0, alsoReadSection);
          story = paragraphs.join('</p>');
          console.log('✅ "Also Read" section placed after second paragraph');
        }
      }
      
      // Check if "Read Next" section exists, if not add it after context but before price action
      if (!story.includes('Read Next:')) {
        console.log('Adding "Read Next" section');
        const readNextSection = `<p>Read Next: <a href="${relatedArticles[1]?.url || relatedArticles[0].url}">${relatedArticles[1]?.headline || relatedArticles[0].headline}</a></p>`;
        
        // Find the price action section to insert before it
        const priceActionIndex = story.indexOf('Price Action:');
        if (priceActionIndex !== -1) {
          // Insert before price action
          const beforePriceAction = story.substring(0, priceActionIndex);
          const priceActionAndAfter = story.substring(priceActionIndex);
          story = `${beforePriceAction}\n\n${readNextSection}\n\n${priceActionAndAfter}`;
        } else {
          // If no price action found, add to the end
          story += readNextSection;
        }
      } else {
        console.log('"Read Next" section already exists');
      }
    } else {
      console.log('No related articles available');
    }
    
    console.log('Final story preview:', story.substring(0, 500));
    console.log(`✅ PR Story generated successfully using ${currentProvider.toUpperCase()} (${model})`);
    return NextResponse.json({ 
      story,
      provider: currentProvider,
      model: model
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate PR story.' }, { status: 500 });
  }
}

