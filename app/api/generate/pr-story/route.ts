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

// Helper function to get current day name for price action
// Markets are closed on weekends, so return Friday for Saturday/Sunday
function getCurrentDayName(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();
  const currentDay = today.getDay();
  
  // If it's a weekend, return Friday as the last trading day
  if (currentDay === 0) { // Sunday
    return 'Friday';
  } else if (currentDay === 6) { // Saturday
    return 'Friday';
  } else {
    return days[currentDay];
  }
}

// Helper function to determine market session
function getMarketSession(): 'premarket' | 'regular' | 'afterhours' | 'closed' {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();
  const time = hour * 100 + minute;
  const day = nyTime.getDay();
  
  // Weekend
  if (day === 0 || day === 6) {
    return 'closed';
  }
  
  // Pre-market (4:00 AM - 9:30 AM ET)
  if (time >= 400 && time < 930) {
    return 'premarket';
  }
  
  // Regular trading (9:30 AM - 4:00 PM ET)
  if (time >= 930 && time < 1600) {
    return 'regular';
  }
  
  // After-hours (4:00 PM - 8:00 PM ET)
  if (time >= 1600 && time < 2000) {
    return 'afterhours';
  }
  
  // Closed (8:00 PM - 4:00 AM ET)
  return 'closed';
}

// Helper function to fetch price data
async function fetchPriceData(ticker: string) {
  try {
    const response = await fetch(`https://api.benzinga.com/api/v2/quoteDelayed?token=${BENZINGA_API_KEY}&symbols=${encodeURIComponent(ticker)}`);
    
    if (!response.ok) {
      console.error('Failed to fetch price data');
      return null;
    }
    
    const data = await response.json();
    
    if (data && typeof data === 'object') {
      const quote = data[ticker.toUpperCase()];
      if (quote && typeof quote === 'object') {
        const priceData = {
          last: quote.lastTradePrice || 0,
          change: quote.change || 0,
          change_percent: quote.changePercent || quote.change_percent || 0,
          volume: quote.volume || 0,
          high: quote.high || 0,
          low: quote.low || 0,
          open: quote.open || 0,
          close: quote.close || quote.lastTradePrice || 0,
          previousClose: quote.previousClosePrice || quote.previousClose || 0,
          companyName: quote.companyStandardName || quote.name || ticker.toUpperCase(),
          // Extended hours data with multiple field name support
          extendedHoursPrice: quote.ethPrice || quote.extendedHoursPrice || quote.afterHoursPrice || quote.ahPrice || quote.extendedPrice || null,
          extendedHoursChange: quote.ethChange || quote.extendedHoursChange || quote.afterHoursChange || quote.ahChange || quote.extendedChange || null,
          extendedHoursChangePercent: quote.ethChangePercent || quote.extendedHoursChangePercent || quote.afterHoursChangePercent || quote.ahChangePercent || quote.extendedChangePercent || null,
          extendedHoursTime: quote.ethTime || quote.extendedHoursTime || quote.afterHoursTime || quote.ahTime || quote.extendedTime || null,
          extendedHoursVolume: quote.ethVolume || null
        };
        
        return priceData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching price data:', error);
    return null;
  }
}

// Helper function to generate price action line
function generatePriceActionLine(ticker: string, priceData: any): string {
  const prefix = `${ticker} Price Action:`;
  
  if (!priceData) {
    return `<strong>${prefix}</strong> Price data unavailable, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
  }

  const marketSession = getMarketSession();
  const dayName = getCurrentDayName();
  const companyName = priceData.companyName || ticker.toUpperCase();
  
  // Regular session data
  // Use 'close' for regular trading hours close price (not lastTradePrice which may be extended hours)
  const regularLast = parseFloat(priceData.close || priceData.last || 0).toFixed(2);
  
  // Calculate regular trading hours change percent from close and previousClose
  let regularChangePercent: string;
  if (priceData.previousClose && priceData.previousClose > 0 && priceData.close) {
    // Calculate from regular hours close vs previous close
    const regularChange = parseFloat(priceData.close) - parseFloat(priceData.previousClose);
    const calculatedChangePercent = (regularChange / parseFloat(priceData.previousClose) * 100).toFixed(2);
    regularChangePercent = calculatedChangePercent;
  } else if (priceData.change && priceData.previousClose && priceData.previousClose > 0) {
    // Fallback: calculate from change amount if close is not available
    const calculatedChangePercent = (parseFloat(priceData.change.toString()) / parseFloat(priceData.previousClose.toString()) * 100).toFixed(2);
    regularChangePercent = calculatedChangePercent;
  } else {
    // Last resort: use API field directly (but this may be extended hours)
    const apiChangePercent = parseFloat(priceData.change_percent || 0);
    regularChangePercent = apiChangePercent.toFixed(2);
  }
  
  const regularDisplayChangePercent = regularChangePercent.startsWith('-') ? regularChangePercent.substring(1) : regularChangePercent;
  
  // Extended hours data
  const hasExtendedHours = priceData.extendedHoursPrice;
  const extPrice = hasExtendedHours ? parseFloat(priceData.extendedHoursPrice || 0).toFixed(2) : null;
  const extChangePercent = priceData.extendedHoursChangePercent ? parseFloat(priceData.extendedHoursChangePercent || 0).toFixed(2) : null;
  const extDisplayChangePercent = extChangePercent && extChangePercent.startsWith('-') ? extChangePercent.substring(1) : extChangePercent;
  
  // Calculate extended hours change if we have the price but not the change percentage
  const regularClose = parseFloat(priceData.close || priceData.last || 0);
  const calculatedExtChangePercent = priceData.extendedHoursPrice && !priceData.extendedHoursChangePercent ? 
    ((parseFloat(priceData.extendedHoursPrice) - regularClose) / regularClose * 100).toFixed(2) : null;
  
  const finalExtChangePercent = extChangePercent || calculatedExtChangePercent;
  const finalHasExtendedHours = priceData.extendedHoursPrice && finalExtChangePercent;
  const finalExtDisplayChangePercent = finalExtChangePercent && finalExtChangePercent.startsWith('-') ? finalExtChangePercent.substring(1) : finalExtChangePercent;
  
  if (marketSession === 'regular') {
    return `<strong>${prefix}</strong> ${companyName} shares were ${regularChangePercent.startsWith('-') ? 'down' : 'up'} ${regularDisplayChangePercent}% at $${regularLast} during regular trading hours on ${dayName}, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
  } else if (marketSession === 'premarket') {
    // For premarket, use the change_percent field directly if available
    if (priceData.change_percent && priceData.change_percent !== 0) {
      const premarketChangePercent = parseFloat(priceData.change_percent).toFixed(2);
      const premarketDisplayChangePercent = premarketChangePercent.startsWith('-') ? premarketChangePercent.substring(1) : premarketChangePercent;
      const premarketPrice = priceData.extendedHoursPrice ? parseFloat(priceData.extendedHoursPrice).toFixed(2) : parseFloat(priceData.last).toFixed(2);
      return `<strong>${prefix}</strong> ${companyName} shares were ${premarketChangePercent.startsWith('-') ? 'down' : 'up'} ${premarketDisplayChangePercent}% at $${premarketPrice} during pre-market trading on ${dayName}, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
    } else if (finalHasExtendedHours && finalExtChangePercent && finalExtDisplayChangePercent) {
      return `<strong>${prefix}</strong> ${companyName} shares were ${finalExtChangePercent.startsWith('-') ? 'down' : 'up'} ${finalExtDisplayChangePercent}% at $${extPrice} during pre-market trading on ${dayName}, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
    } else if (priceData.extendedHoursPrice) {
      // We have premarket price but no change percentage, calculate it manually
      const previousClose = parseFloat(priceData.previousClose || priceData.close || priceData.last || 0);
      const premarketPrice = parseFloat(priceData.extendedHoursPrice);
      if (previousClose > 0 && premarketPrice > 0) {
        const manualChangePercent = ((premarketPrice - previousClose) / previousClose * 100).toFixed(2);
        const manualDisplayChangePercent = manualChangePercent.startsWith('-') ? manualChangePercent.substring(1) : manualChangePercent;
        return `<strong>${prefix}</strong> ${companyName} shares were ${manualChangePercent.startsWith('-') ? 'down' : 'up'} ${manualDisplayChangePercent}% at $${premarketPrice.toFixed(2)} during pre-market trading on ${dayName}, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
      }
    }
    return `<strong>${prefix}</strong> ${companyName} shares were trading during pre-market hours on ${dayName}, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
  } else if (marketSession === 'afterhours') {
    if (finalHasExtendedHours && finalExtChangePercent && finalExtDisplayChangePercent) {
      // Show both regular session and after-hours changes
      const regularDirection = regularChangePercent.startsWith('-') ? 'fell' : 'rose';
      const extDirection = finalExtChangePercent.startsWith('-') ? 'down' : 'up';
      
      return `<strong>${prefix}</strong> ${companyName} shares ${regularDirection} ${regularDisplayChangePercent}% to $${regularLast} during regular trading hours, and were ${extDirection} ${finalExtDisplayChangePercent}% at $${extPrice} during after-hours trading on ${dayName}, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
    } else {
      // Show regular session data with after-hours indication
      const regularDirection = regularChangePercent.startsWith('-') ? 'fell' : 'rose';
      return `<strong>${prefix}</strong> ${companyName} shares ${regularDirection} ${regularDisplayChangePercent}% to $${regularLast} during regular trading hours on ${dayName}. The stock is currently trading in after-hours session, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
    }
  } else {
    // Market is closed, use last regular session data
    return `<strong>${prefix}</strong> ${companyName} shares ${regularChangePercent.startsWith('-') ? 'fell' : 'rose'} ${regularDisplayChangePercent}% to $${regularLast} during regular trading hours on ${dayName}, according to <a href="https://pro.benzinga.com">Benzinga Pro</a>.`;
  }
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
    
    // Score articles for relevance based on channels and headline keywords
    // For banking/finance articles, prioritize: Macroeconomics, Federal Reserve, Consumer Sentiment, Banking Earnings
    const relevantChannelKeywords = [
      'banking', 'finance', 'financial', 'economy', 'economic', 'macro', 'federal reserve', 
      'consumer', 'sentiment', 'earnings', 'deposits', 'interest rate', 'monetary policy'
    ];
    
    const scoredArticles = filteredArticles.map((item: any) => {
      let score = 0;
      const headline = (item.headline || item.title || '').toLowerCase();
      const channels = Array.isArray(item.channels) ? item.channels : [];
      
      // Check headline for relevant keywords
      relevantChannelKeywords.forEach(keyword => {
        if (headline.includes(keyword)) {
          score += 2;
        }
      });
      
      // Check channels for relevant topics
      channels.forEach((ch: any) => {
        const channelName = (ch.name || '').toLowerCase();
        if (relevantChannelKeywords.some(keyword => channelName.includes(keyword))) {
          score += 3; // Channels are more reliable indicators
        }
      });
      
      return {
        headline: item.headline || item.title || '[No Headline]',
        url: item.url,
        created: item.created,
        score: score
      };
    });
    
    // Sort by relevance score (highest first), then by date (newest first)
    const sortedArticles = scoredArticles.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Higher score first
      }
      // If scores are equal, prefer newer articles
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    });
    
    const relatedArticles = sortedArticles.slice(0, 5);
    
    console.log('Final related articles:', relatedArticles.length);
    console.log('Top related article:', relatedArticles[0]?.headline, 'Score:', relatedArticles[0]?.score);
    return relatedArticles;
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

function buildPRPrompt({ ticker, sourceText, sourceUrl, sourceDateFormatted, relatedArticles, includeCTA, ctaText, includeSubheads, subheadTexts, narrative }: { ticker: string; sourceText: string; sourceUrl?: string; sourceDateFormatted?: string; relatedArticles?: any[]; includeCTA?: boolean; ctaText?: string; includeSubheads?: boolean; subheadTexts?: string[]; narrative?: { title: string; angle_type: 'competitive' | 'industry' | 'market_dynamics'; description: string; key_points: string[]; why_relevant: string; peer_companies?: string[]; peer_market_data?: Array<{ ticker: string; price_action?: any }>; company_articles?: Array<{ headline: string; url: string }>; peer_articles?: Array<{ headline: string; url: string }>; } }) {
  
  console.log('buildPRPrompt called with sourceUrl:', sourceUrl);
  console.log('sourceUrl type:', typeof sourceUrl);
  console.log('sourceUrl length:', sourceUrl?.length);
  console.log('Narrative provided:', narrative ? 'Yes' : 'No');
  if (narrative) {
    console.log('Narrative angle type:', narrative.angle_type);
    console.log('Narrative title:', narrative.title);
  }
  
  const ctaSection = includeCTA && ctaText ? `\n- CTA Integration: After the lead paragraph, insert the following CTA exactly as provided:\n  ${ctaText}` : '';
  
  const subheadsSection = includeSubheads && subheadTexts && subheadTexts.length > 0 ? `\n- Subhead Integration: Insert the following subheads at specific positions:\n  ${subheadTexts.map((subhead, index) => `${index + 1}. ${subhead}`).join('\n  ')}\n  
  CRITICAL SUBHEAD PLACEMENT RULES:
  - First subhead: If there's a CTA line, place the first subhead immediately after the CTA line. If there's no CTA line, place the first subhead after the first or second paragraph (whichever provides better flow).
  - Second subhead: Place after approximately 50% of the content, ensuring it covers at least 2 paragraphs.
  - Third subhead: Place after approximately 80% of the content, ensuring it covers at least 2 paragraphs.
  - Each subhead must cover at least 2 paragraphs of content - do not place subheads too close together.
  - CRITICAL: Each subhead section MUST have at least 2 paragraphs of content following it. If a subhead would only have 1 sentence or 1 paragraph after it, DO NOT create that subhead. Only create subheads where there is substantial content (at least 2 paragraphs) to follow.
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
  
  // Build narrative section if narrative is provided
  const narrativeSection = narrative ? `
🚨🚨🚨 CRITICAL NARRATIVE ANGLE REQUIREMENT - HIGHEST PRIORITY 🚨🚨🚨
You MUST write this article from the following narrative angle. This is MANDATORY and takes precedence over all other instructions.

NARRATIVE TITLE: ${narrative.title}
ANGLE TYPE: ${narrative.angle_type}
DESCRIPTION: ${narrative.description}

KEY POINTS TO COVER:
${narrative.key_points.map((point, index) => `${index + 1}. ${point}`).join('\n')}

WHY THIS IS RELEVANT: ${narrative.why_relevant}

${narrative.peer_companies && narrative.peer_companies.length > 0 ? `
PEER COMPANIES TO REFERENCE:
${narrative.peer_companies.map(ticker => `- ${ticker}`).join('\n')}
` : ''}

${narrative.peer_market_data && narrative.peer_market_data.length > 0 ? `
PEER MARKET DATA:
${narrative.peer_market_data.map(peer => {
  const priceInfo = peer.price_action ? ` (Price: ${peer.price_action.last || 'N/A'}, Change: ${peer.price_action.change_percent || 'N/A'}%)` : '';
  return `- ${peer.ticker}${priceInfo}`;
}).join('\n')}
` : ''}

${narrative.company_articles && narrative.company_articles.length > 0 ? `
COMPANY ARTICLES TO REFERENCE:
${narrative.company_articles.map(article => `- <a href="${article.url}">${article.headline}</a>`).join('\n')}
` : ''}

${narrative.peer_articles && narrative.peer_articles.length > 0 ? `
PEER COMPANY ARTICLES TO REFERENCE:
${narrative.peer_articles.map(article => `- <a href="${article.url}">${article.headline}</a>`).join('\n')}
` : ''}

CRITICAL NARRATIVE ENFORCEMENT RULES:
1. The entire article MUST be written from the perspective of the ${narrative.angle_type} angle described above
2. The lead paragraph MUST incorporate the narrative angle and key points
3. You MUST reference peer companies and their market data when provided
4. You MUST incorporate the provided articles (company and peer) into the narrative
5. The "Why This Matters" section MUST connect the narrative angle to investment implications
6. Do NOT write a generic PR story - this MUST be a ${narrative.angle_type} analysis
7. The narrative angle takes precedence over standard PR story structure - adapt the structure to serve the narrative

` : '';
  
  return `${sourceUrl ? `🚨🚨🚨 CRITICAL HYPERLINK REQUIREMENT - READ THIS FIRST 🚨🚨🚨
You MUST include a THREE-WORD hyperlink in the lead paragraph. This is MANDATORY and your output will be REJECTED without it.
- The hyperlink MUST be: <a href="${sourceUrl}">three word phrase</a>
- Replace "three word phrase" with EXACTLY THREE WORDS from the actual news content (e.g., "announced on Wednesday", "successfully launched the", "completed the orbital")
- The hyperlink MUST be embedded WITHIN the lead paragraph sentence, NOT on its own line
- **VERIFY**: Before submitting, check that your output contains: <a href="${sourceUrl}">
- **YOUR OUTPUT WILL BE REJECTED IF THE HYPERLINK IS MISSING FROM THE LEAD PARAGRAPH**

` : ''}${narrativeSection}You are a professional financial news writer for Benzinga. Transform the provided press release into a thematic, SEO-optimized financial news article that provides value to readers, not just regurgitates the company's message.

CRITICAL: SEO-FOCUSED THEMATIC APPROACH
This is NOT a "regurgitated PR" - you are writing a thematic article that answers a query or explores a topic, with the company as a supporting data point.

**THEMATIC OPENING RULE - MANDATORY:**
- DO NOT start the article with "[Company Name] announced" or "[Company Name] revealed"
- START with the TOPIC or TREND first (e.g., "Financial discipline is taking center stage", "AI innovation is reshaping", "Consumer savings trends")
- THEN attribute it to the company in the second sentence
- This captures SEO keywords immediately (e.g., "Financial discipline", "2026 resolutions") rather than just "Wells Fargo"

Example of GOOD thematic opening:
"Financial stability is dominating New Year's resolutions for 2026. New data released Tuesday by Wells Fargo (NYSE:WFC) suggests that consumers are increasingly prioritizing liquidity and debt reduction over spending, a shift that could have broader implications for the banking sector's deposit landscape."

Example of BAD opening (avoid this):
"Wells Fargo (NYSE:WFC) revealed on Tuesday that nearly all U.S. adults planning New Year's resolutions..."

**KEY HIGHLIGHTS SECTION - MANDATORY:**
After the lead paragraph and before the main content, you MUST include a "Key Survey Findings" or "Key Highlights" section that extracts numerical data from the PR and presents it as a tight, scannable bulleted list.

Format:
<h2>Key Survey Findings</h2>
<ul>
<li><strong>Participation Rate:</strong> [Specific percentage or number] of [demographic] are [action/trend].</li>
<li><strong>The Top Priority:</strong> [Specific finding with data point, e.g., "70% of respondents explicitly listed 'saving more money' as their primary goal"].</li>
<li><strong>Demographic Split:</strong> [Specific data about who this affects most, e.g., "The trend is most visible in the 'middle bracket'—Americans aged 25+ with household incomes under $100,000"].</li>
</ul>

CRITICAL FORMATTING RULES:
- Use clear, scannable labels like "Participation Rate:", "The Top Priority:", "Demographic Split:", "Confidence & The 'Control' Factor:"
- Extract ALL numerical data, percentages, survey results, and key metrics from the source text
- Present them in this tight bulleted format - NO introductory paragraph before the bullets
- Make each bullet point concise and data-driven
- This makes the data scannable and SEO-friendly

**THE INVESTOR BRIDGE SECTION - MANDATORY:**
After presenting the facts and key highlights, you MUST include a section titled "Why This Matters for ${ticker ? ticker : '[TICKER]'} Investors" that bridges the soft news (surveys, awards, CSR) with hard stock implications.

This section should:
- Connect the PR content to the company's business model (e.g., "Survey = Deposits", "Award = Brand Value", "Partnership = Revenue Stream")
- Explain how this news supports fundamental analysis
- Use bullet points to break down the investment implications
- Answer: "I'm an investor, why do I care about this survey/award/announcement?"

CRITICAL FORMATTING RULE - NO REDUNDANT INTRO PARAGRAPH:
- DO NOT include an introductory paragraph before the bullets that summarizes what the bullets will say
- Go STRAIGHT to the H2 heading, then ONE brief contextual sentence (if needed), then the bullets
- The bullets should stand on their own - they don't need a summary paragraph before them

Format:
<h2>Why This Matters for ${ticker ? ticker : '[TICKER]'} Investors</h2>
<p>Beyond the [consumer advice/survey findings/announcement], this data highlights a potential fundamental tailwind for ${ticker ? ticker : '[TICKER]'}'s core [business type].</p>
<ul>
<li><strong>Business Metric:</strong> [How this PR relates to the metric, e.g., "Higher consumer savings rates directly translate to increased Customer Deposits, which are the bank's primary source of funding."]</li>
<li><strong>Profit Impact:</strong> [Specific business implication, e.g., "Robust deposit inflows provide banks with a stable capital base, potentially lowering the cost of funds even as interest rates fluctuate."]</li>
<li><strong>Market Position:</strong> [How this positions the company competitively or in the market, e.g., "By aligning its digital tools with this 'self-care' savings trend, Wells Fargo positions itself to capture a larger share of wallet from the middle-income demographic."]</li>
</ul>

CRITICAL: 
- If the PR is "Soft News" (Awards, Surveys, CSR, Partnerships), you MUST generate this "Why This Matters" section to explain how it supports the company's core business model
- Do NOT skip this section - it's what transforms a PR regurgitation into valuable investor content
- Do NOT include a redundant intro paragraph that echoes what the bullets say - go straight to the heading and bullets

CRITICAL QUOTE REQUIREMENT: 
You MUST include at least one direct quote from the source material. Look for text that appears in quotation marks in the source and include it exactly as written. This is MANDATORY and takes priority over other instructions.

**BENZINGA NEWS STYLE - MANDATORY:**
Write the story in a thematic, SEO-optimized Benzinga news style that provides value to readers. Follow these rules:

**STRUCTURE - Thematic PR Story Format (CRITICAL ORDER):**
1. Thematic Lead (Topic First, Company Second) → 
2. Key Highlights/Key Survey Findings (Bulleted Data) → 
3. Executive Perspective/Quotes & General Advice (Soft News) → 
4. Why This Matters for [TICKER] Investors (Hard News / Conclusion) → 
5. Price Action → 
6. Read Next

CRITICAL STRUCTURAL RULES:
- The "Why This Matters for [TICKER] Investors" section is the CLIMAX and CONCLUSION of the article
- DO NOT add any sections, subheads, or content AFTER the "Why This Matters" section (except Price Action and Read Next)
- Once you tell the reader "Why this matters for the stock," the story is effectively over for an investor
- Adding generic advice, repetitive sections, or weak content after the Investor section causes drop-off - this is called a "False Ending"
- The flow should be: Soft News (General Advice/Quotes) → Hard News (Investor Impact) → END

This structure is DISTINCT from WGO (What's Going On) stories:
- WGO Focus: Urgency & Price Action ("Why is the stock moving now?")
- PR Focus: Thematic & Fundamental ("What does this tell us about the company's business/market?")

**CRITICAL CONTENT RULES:**
- Do NOT repeat facts, themes, or quotes anywhere in the story. Each piece of information should appear only once.
- MERGE redundant data points: If the same theme appears multiple times (e.g., "Control/Confidence" mentioned in Key Findings, Quotes, and later sections), consolidate them into ONE section. Do NOT repeat the same theme in multiple places.
- Do NOT create multiple sections covering the same topic with different subheads - merge similar data points into a single, comprehensive section.
- Do NOT broaden the narrative beyond the core topic. Avoid side tangents (e.g., unrelated industry shifts, consumer deals, secondary partnerships) unless they directly support the valuation or market impact.
- Keep paragraphs short and focused. Each paragraph should deliver ONE idea only.
- Use specific financial details, metrics, subscriber counts, revenue figures, contract information, or valuation numbers to ground the story. Avoid vague statements.
- Avoid generic or motivational framing. Do NOT restate the same point in different wording.
- Do NOT over-explain or add background unrelated to the core valuation/IPO/news story.
- Maintain a crisp, newsroom tone — fast pacing, clean transitions, no filler.
- No narrative drift. If a fact cannot be tied directly to valuation, market relevance, or growth engines, exclude it.
- CRITICAL: Do NOT add weak, repetitive sections after the "Why This Matters for [TICKER] Investors" section. That section is the conclusion - end the article there (except for Price Action and Read Next).

**CRITICAL: EXPLAIN WHY THIS MATTERS**
- Every article must answer: "Why should readers care about this news?"
- Explain the implications, impact, or importance of the announcement
- Connect the news to broader market trends, competitive dynamics, or industry shifts
- Highlight what makes this newsworthy beyond just reporting the facts
- Include context about why this is important for investors, the market, or the industry
- Explain the "so what" - what does this mean for the company, competitors, or market?
- Use phrases like "This marks...", "This positions...", "This reflects...", "This comes as..." to explain importance
- Don't just report what happened - explain why it matters and what it means
- AVOID generic words like "significant", "important", "notable" - be specific about what makes it noteworthy

Write a comprehensive, fact-based news article (approximately 400-500 words)${ticker && ticker.trim() !== '' ? ` about the stock with ticker: ${ticker}` : ''}. Use the provided press release text as your main source${ticker && ticker.trim() !== '' ? `. 

CRITICAL ARTICLE LENGTH REQUIREMENT:
- The article MUST be comprehensive and detailed (approximately 400-500 words)
- Include multiple paragraphs with substantial content (at least 6-8 paragraphs beyond the lead)
- Do NOT write a short or abbreviated article
- Include all relevant details, quotes, and context from the source material
- The article should be thorough and complete, not a summary

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

- **Lead paragraph (Thematic Opening):** 
  - START with the TOPIC or TREND, NOT the company name (e.g., "Financial discipline is taking center stage", "AI innovation is reshaping", "Consumer savings trends")
  - THEN attribute to the company in the second sentence
  - Use the full company name and ticker in this format: <strong>Company Name</strong> (NYSE: TICKER) when you first mention the company
  - The company name should be bolded using HTML <strong> tags. Do not use markdown bold (**) or asterisks elsewhere
  - State what happened and why it matters in exactly 2 concise sentences
  - Focus on the thematic significance, not just "Company X announced Y"
  - Capture SEO keywords immediately (e.g., "Financial discipline", "2026 resolutions") rather than just the company name

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

- **Key Highlights/Key Survey Findings Section (MANDATORY):** 
  - Immediately after the lead paragraph, include a section with the H2 heading "Key Survey Findings" or "Key Highlights"
  - Extract ALL numerical data, percentages, survey results, and key metrics from the source text
  - Present them as a tight, scannable bulleted list using HTML <ul> and <li> tags
  - Use clear labels like "Participation Rate:", "The Top Priority:", "Demographic Split:", "Confidence & The 'Control' Factor:"
  - Format: <h2>Key Survey Findings</h2><ul><li><strong>Participation Rate:</strong> [Data point].</li><li><strong>The Top Priority:</strong> [Data point].</li><li><strong>Demographic Split:</strong> [Data point].</li></ul>
  - NO introductory paragraph before the bullets - go straight to the H2 heading and bullets
  - Make the data scannable and SEO-friendly

- **Executive Perspective/Quotes & General Advice Section (BEFORE Investor Section):**
  - This section comes AFTER Key Findings but BEFORE "Why This Matters for [TICKER] Investors"
  - Include at least one direct quote from the source material using quotation marks
  - If multiple relevant quotes exist, include up to two quotes
  - Look for text in the source that is already in quotation marks and use those exact quotes
  - Format executive quotes with proper attribution (e.g., "Quote text," said Name, Title of Company)
  - Include actionable advice, practical steps, or general insights from the source
  - MERGE similar themes: If quotes mention the same theme as data in Key Findings (e.g., "Control/Confidence"), include the quote AND merge any related data points into this section rather than creating a separate redundant section
  - You can include quotes within paragraphs or create a dedicated section with an H2 heading if the quotes are substantial
  - This is the "Soft News" section - it provides general value before transitioning to the "Hard News" (Investor Impact)

- **Why This Matters for [TICKER] Investors Section (MANDATORY):**
  - After presenting facts and quotes, include this section with H2 heading: "Why This Matters for ${ticker ? ticker : '[TICKER]'} Investors"
  - Bridge the soft news (surveys, awards, CSR) with hard stock implications
  - Connect the PR content to the company's business model using bullet points
  - Explain how this news supports fundamental analysis
  - Answer: "I'm an investor, why do I care about this?"
  ${narrative ? `- CRITICAL: This section MUST connect the ${narrative.angle_type} narrative angle to investment implications. Reference peer companies and market data when provided in the narrative.` : ''}
  - CRITICAL: NO redundant intro paragraph that summarizes the bullets - go straight to the H2 heading, ONE brief contextual sentence (if needed), then the bullets
  - Format: <h2>Why This Matters for ${ticker ? ticker : '[TICKER]'} Investors</h2><p>Beyond the [context], this data highlights a potential fundamental tailwind for ${ticker ? ticker : '[TICKER]'}'s core [business type].</p><ul><li><strong>Business Metric:</strong> [Explanation].</li><li><strong>Profit Impact:</strong> [Explanation].</li><li><strong>Market Position:</strong> [Explanation].</li></ul>

- **Additional paragraphs:** Provide market context, competitive dynamics, industry trends, and any other relevant details${ticker && ticker.trim() !== '' ? ` about ${ticker}` : ''}. When referencing dates in additional paragraphs, use day names (Monday, Tuesday, etc.) instead of date formats. NEVER use "today", "yesterday", "tomorrow", or "recently" - always specify the actual day name.

CRITICAL: THEMATIC VALUE, NOT PR REGURGITATION
- This article must provide VALUE to readers, not just repeat the company's message
- Focus on the THEME or TREND first, then use the company as supporting data
- The "Why This Matters for [TICKER] Investors" section is where you explain business implications
- Connect the PR content to fundamental analysis: How does this survey/award/announcement relate to revenue, margins, market share, or competitive position?
- Use specific business metrics: deposit growth, customer acquisition, brand value, cost of capital, etc.
- Don't just report what the company said - explain what it MEANS for investors
- Answer the "so what" question: Why should readers care about this news beyond just knowing the company made an announcement?
- AVOID generic words like "significant", "important", "notable" - be specific and concrete about what makes it noteworthy
- Think: "What does this tell us about the company's business/market?" not "What did the company announce?"

${narrative && narrative.peer_companies && narrative.peer_companies.length > 0 ? `
CRITICAL NARRATIVE COMPANY INCLUSION:
- You MUST prioritize and prominently feature the peer companies provided in the narrative: ${narrative.peer_companies.join(', ')}
- Include their market data, price action, and relevant articles when provided
- Connect these peer companies to the ${narrative.angle_type} narrative angle
- Use peer companies to provide competitive, industry, or market dynamics context as specified in the narrative
` : `
CRITICAL: You MUST include information about OTHER companies mentioned in the source text. If the source mentions multiple companies (e.g., Doseology, Philip Morris, Zevia, Lifeway, etc.), include their:
- Company names with ticker symbols (e.g., "Doseology Sciences Inc. (CSE:MOOD)" or "Philip Morris International (NYSE:PM)")
- Specific quotes from their executives
- Product launches, financial results, partnerships, or strategic announcements
- How they relate to or provide context for ${ticker && ticker.trim() !== '' ? `the primary company (${ticker})` : 'the main story'}
- Market trends or industry context they represent

Do NOT write an article that only mentions the primary company. The source text contains multiple companies for a reason - include them to provide comprehensive market context.
`}

CRITICAL: Each paragraph must be no longer than 2 sentences. If you have more information, create additional paragraphs.

${ctaSection}

${subheadsSection}

${relatedArticlesSection}

${ticker && ticker.trim() !== '' ? `- At the very bottom, include a price action summary for ${ticker}. The price action will be automatically generated and added after the article is written, so do NOT include it in your output.` : ''}

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

CRITICAL ARTICLE COMPLETENESS REQUIREMENTS:
- The article MUST include all required sections: lead paragraph, Key Findings, Executive Perspective/Quotes, "Why This Matters for [TICKER] Investors", and price action (if ticker provided)
- Include at least 6-8 substantial paragraphs beyond the lead paragraph
- Each paragraph should be informative and add value - do NOT write short, superficial paragraphs
- Include multiple quotes from different executives when available
- Provide comprehensive details about partnerships, products, financial results, or strategic moves
- Include market context and industry trends when relevant
- The article must be complete and thorough - do NOT end abruptly or leave out important information
- Do NOT include "Read the full source article" or similar lines at the end
- CRITICAL: The "Why This Matters for [TICKER] Investors" section is the CLIMAX and CONCLUSION
- After the "Why This Matters" section, ONLY include Price Action and Read Next - do NOT add any additional sections, subheads, or content
- Do NOT create a "False Ending" by adding weak, repetitive sections after the Investor analysis
- MERGE redundant themes: If the same topic appears in multiple places (e.g., "Control/Confidence" in Key Findings, Quotes, and later), consolidate into ONE section
- Do NOT add redundant or repetitive content at the end of the article. If a topic has already been covered in detail earlier, do NOT repeat it with a subhead and new paragraph at the end

REMEMBER: 
- NO paragraph should exceed 2 sentences. Break up longer content into multiple paragraphs.
- The THREE-WORD hyperlink (exactly three words, not two or four) MUST appear in the lead paragraph, embedded naturally in the text.
- Do NOT include source attributions like "reports" or "according to [publication]".
- Write as if reporting the news directly from the press release.
- CRITICAL: The hyperlink text MUST be exactly three words. Count the words: word1 word2 word3 = 3 words. Do NOT use two words or four words.
- Do NOT include "Read the full source article" or similar lines at the end

Source Text (Press Release):
${sourceText}

Write the article now.`;
}

export async function POST(req: Request) {
  try {
    const requestBody = await req.json();
    let { ticker, sourceText, sourceUrl, sourceDateFormatted, includeCTA, ctaText, includeSubheads, subheadTexts, provider: requestedProvider, narrative } = requestBody;
    if (!sourceText) return NextResponse.json({ error: 'Source text is required.' }, { status: 400 });
    
    console.log(`\n🔍 PR STORY PROVIDER DEBUG:`);
    console.log(`   - Provider value received: "${requestedProvider}"`);
    console.log(`   - Current singleton provider: ${aiProvider.getCurrentProvider()}`);
    
    console.log('Source text length:', sourceText.length);
    console.log('Source text preview:', sourceText.substring(0, 200));
    console.log('Ticker provided:', ticker);
    console.log('includeSubheads:', includeSubheads);
    console.log('subheadTexts provided:', subheadTexts ? subheadTexts.length : 0);
    console.log('Narrative provided:', narrative ? 'Yes' : 'No');
    if (narrative) {
      console.log('Narrative angle type:', narrative.angle_type);
      console.log('Narrative title:', narrative.title);
      console.log('Peer companies:', narrative.peer_companies?.length || 0);
      console.log('Peer market data:', narrative.peer_market_data?.length || 0);
      console.log('Company articles:', narrative.company_articles?.length || 0);
      console.log('Peer articles:', narrative.peer_articles?.length || 0);
    }
    
    // Note: Subheads will be generated AFTER the final story is created
    // This ensures subheads match the actual content structure
    
    // Fetch price data if ticker is provided
    let priceData = null;
    if (ticker && ticker.trim() !== '') {
      console.log('Fetching price data for ticker:', ticker);
      priceData = await fetchPriceData(ticker);
      console.log('Price data fetched:', priceData ? 'Success' : 'Failed');
    }
    
    // Fetch related articles
    const relatedArticles = await fetchRelatedArticles(ticker, sourceUrl);
    console.log('Related articles fetched:', relatedArticles.length, 'articles');
    
    console.log('Building PR prompt with sourceUrl:', sourceUrl);
    const prompt = buildPRPrompt({ ticker, sourceText, sourceUrl, sourceDateFormatted, relatedArticles, includeCTA, ctaText, includeSubheads, subheadTexts, narrative });
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
    const maxTokens = currentProvider === 'gemini' ? 8192 : 2000; // Increased for more comprehensive articles
    
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
    
    // Remove "Read the full source article" if it appears (not part of the article)
    story = story.replace(/Read the full source article:.*?$/gim, '');
    story = story.replace(/Read the full source article.*?$/gim, '');
    
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
    
    // If subheads are requested but not provided, generate them from the final story
    if (includeSubheads && (!subheadTexts || subheadTexts.length === 0)) {
      console.log('⚠️ Subheads requested but not provided. Generating subheads from final story...');
      try {
        // Remove existing subheads from story if any (to get clean content for subhead generation)
        const storyWithoutSubheads = story.replace(/<h2>.*?<\/h2>/gi, '');
        
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
        - IMPORTANT: Base your subheads on the ACTUAL content structure of the article below. Analyze what topics are covered in each section and create subheads that accurately reflect those topics.
        - The subheads should match the content that follows them - read the article carefully to understand its structure.
        - CRITICAL: Do NOT create subheads that duplicate or repeat topics already covered in previous sections. Each subhead must introduce a NEW or DISTINCT topic/angle.
        - If you see content about partnerships already covered earlier, do NOT create another subhead about partnerships - find a different angle or topic.
        - Do NOT create a subhead near the end of the article that would lead to repetitive content. The last subhead should introduce genuinely new information, not rehash what's already been said.
        - If the article already covers a company's strategy, partnerships, or global expansion in detail, do NOT create a final subhead about "Global Strategy" or "Expanding Influence" that would just repeat that information.
        - CRITICAL: Each subhead MUST have at least 2 paragraphs of content following it. If a subhead would only have 1 sentence or 1 paragraph after it, DO NOT create that subhead. Only generate subheads where there is substantial content (at least 2 paragraphs) available to follow the subhead.
        
        Article:
        ${storyWithoutSubheads}
        
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
        console.log('✅ Generated subheads from final story:', subheadTexts);
        
        // Remove "Read the full source article" if it appears (not part of the article)
        story = story.replace(/Read the full source article:.*?$/gim, '');
        
        // Now insert the subheads into the story at appropriate positions
        // Remove any existing H2 tags to get clean content
        let cleanStory = story.replace(/<h2>.*?<\/h2>/gi, '');
        
        // Split into paragraphs, keeping "Also Read", "Read Next", and "Price Action" sections
        const allParagraphs = cleanStory.split('</p>').map(p => p.trim()).filter(p => p.length > 0);
        const paragraphs: string[] = [];
        let alsoReadIndex = -1;
        let readNextIndex = -1;
        let readNextText = '';
        let priceActionText = '';
        
        for (let i = 0; i < allParagraphs.length; i++) {
          const text = allParagraphs[i].replace(/<[^>]*>/g, '').trim();
          
          if (text.includes('Also Read:')) {
            alsoReadIndex = paragraphs.length; // Track where "Also Read" should be
            paragraphs.push(allParagraphs[i] + '</p>');
          } else if (text.includes('Read Next:')) {
            readNextIndex = paragraphs.length; // Track where "Read Next" should be
            readNextText = allParagraphs[i] + '</p>'; // Save it to re-insert later
            // Don't add it to paragraphs array yet - we'll add it back at the end
          } else if (text.includes('Price Action:')) {
            priceActionText = allParagraphs[i] + '</p>'; // Save it to re-insert later
            // Don't add it to paragraphs array yet - we'll add it back at the end
          } else if (text.length > 0) {
            paragraphs.push(allParagraphs[i] + '</p>');
          }
        }
        
        // Calculate positions for subheads
        const totalParagraphs = paragraphs.length;
        
        // First subhead: After "Also Read" if it exists (which is after paragraph 2), otherwise after ~25% of content
        const firstSubheadPos = alsoReadIndex > -1 ? 
          alsoReadIndex + 1 : // Right after "Also Read"
          Math.max(2, Math.floor(totalParagraphs * 0.25));
        
        const h2Positions = [
          firstSubheadPos,
          Math.max(firstSubheadPos + 2, Math.floor(totalParagraphs * 0.55)), // At least 2 paragraphs after first subhead
          Math.max(firstSubheadPos + 4, Math.floor(totalParagraphs * 0.80))  // At least 4 paragraphs after first subhead
        ];
        
        console.log(`Subhead positions calculated: ${h2Positions.join(', ')} out of ${totalParagraphs} paragraphs`);
        
        // Insert subheads
        const storyWithSubheads: string[] = [];
        let h2Index = 0;
        
        for (let i = 0; i < paragraphs.length; i++) {
          storyWithSubheads.push(paragraphs[i]);
          
          // Insert subhead if we're at a position and have subheads left
          if (h2Index < subheadTexts.length && i === h2Positions[h2Index] - 1) {
            storyWithSubheads.push(`<h2>${subheadTexts[h2Index]}</h2>`);
            console.log(`Inserted subhead ${h2Index + 1} at position ${i}: "${subheadTexts[h2Index]}"`);
            h2Index++;
          }
        }
        
        // Re-insert "Price Action" and "Read Next" at the end if they were removed
        if (priceActionText) {
          storyWithSubheads.push(priceActionText);
          console.log('✅ Re-inserted "Price Action" section at the end');
        }
        if (readNextText) {
          storyWithSubheads.push(readNextText);
          console.log('✅ Re-inserted "Read Next" section at the end');
        }
        
        story = storyWithSubheads.join('\n\n');
        
        // Remove subhead sections that only have 1 sentence/paragraph
        const h2Pattern = /<h2>(.*?)<\/h2>/g;
        let match;
        const subheadSections: Array<{subhead: string, startIndex: number, endIndex: number, paragraphCount: number}> = [];
        
        while ((match = h2Pattern.exec(story)) !== null) {
          const subheadStart = match.index;
          const subheadEnd = match.index + match[0].length;
          
          // Find the next subhead or end of story
          const nextH2Match = story.substring(subheadEnd).match(/<h2>/);
          const nextSubheadStart = nextH2Match && nextH2Match.index !== undefined ? subheadEnd + nextH2Match.index : story.length;
          
          // Get content after this subhead
          const contentAfter = story.substring(subheadEnd, nextSubheadStart);
          const paragraphs = contentAfter.split('</p>').filter(p => {
            const text = p.replace(/<[^>]*>/g, '').trim();
            return text.length > 0 && !text.includes('Price Action:') && !text.includes('Read Next:');
          });
          
          subheadSections.push({
            subhead: match[1],
            startIndex: subheadStart,
            endIndex: nextSubheadStart,
            paragraphCount: paragraphs.length
          });
        }
        
        // Remove subheads that only have 1 paragraph after them (work backwards to preserve indices)
        let removedCount = 0;
        for (let i = subheadSections.length - 1; i >= 0; i--) {
          const section = subheadSections[i];
          if (section.paragraphCount < 2) {
            // Remove this subhead and its content
            const beforeSubhead = story.substring(0, section.startIndex);
            const afterSection = story.substring(section.endIndex);
            story = beforeSubhead + afterSection;
            removedCount++;
            console.log(`✅ Removed subhead "${section.subhead}" - only had ${section.paragraphCount} paragraph(s)`);
          }
        }
        
        if (removedCount > 0) {
          console.log(`✅ Removed ${removedCount} subhead(s) with insufficient content`);
        }
        
        // Remove redundant sections at the end - if the last subhead is followed by content that's repetitive
        // Check if the last subhead and its content are redundant
        const storyParts = story.split('<h2>');
        if (storyParts.length > 1) {
          const lastSection = storyParts[storyParts.length - 1];
          const lastSubheadMatch = lastSection.match(/^(.*?)<\/h2>/);
          if (lastSubheadMatch) {
            const lastSubhead = lastSubheadMatch[1].toLowerCase();
            const contentAfterLastSubhead = lastSection.substring(lastSubheadMatch[0].length);
            
            // Check if this subhead is about strategy/partnerships/expansion and the content is very short or repetitive
            const redundantKeywords = ['strategy', 'partnership', 'expansion', 'influence', 'global', 'collaboration'];
            const isRedundantSubhead = redundantKeywords.some(keyword => lastSubhead.includes(keyword));
            const isShortContent = contentAfterLastSubhead.replace(/<[^>]*>/g, '').trim().length < 200;
            
            // If it's a redundant subhead with short/repetitive content, and there's already a price action section, remove it
            if (isRedundantSubhead && isShortContent && story.includes('Price Action:')) {
              const priceActionIndex = story.indexOf('Price Action:');
              const beforeLastSubhead = story.substring(0, story.lastIndexOf('<h2>'));
              const priceActionAndAfter = story.substring(priceActionIndex);
              story = beforeLastSubhead + '\n\n' + priceActionAndAfter;
              console.log('✅ Removed redundant final subhead section');
            }
          }
        }
        
        console.log(`✅ Inserted ${h2Index} subheads into story at appropriate positions`);
      } catch (subheadError) {
        console.error('❌ Error generating subheads from final story:', subheadError);
        // Continue without subheads if generation fails
      }
    }
    
    // Extract ticker from story if not provided
    let finalTicker = ticker;
    if (!finalTicker || finalTicker.trim() === '') {
      // Try to extract ticker from story (look for patterns like "(NYSE: TICKER)" or "(NASDAQ: TICKER)")
      const tickerMatch = story.match(/\((?:NYSE|NASDAQ|CSE|TSX|OTC|OTCPK|AMEX):\s*([A-Z0-9]+)\)/i);
      if (tickerMatch && tickerMatch[1]) {
        finalTicker = tickerMatch[1].toUpperCase();
        console.log(`✅ Extracted ticker from story: ${finalTicker}`);
      }
    }
    
    // Fetch price data if we have a ticker (either provided or extracted)
    let finalPriceData = priceData;
    if (finalTicker && finalTicker.trim() !== '' && !finalPriceData) {
      console.log('Fetching price data for extracted ticker:', finalTicker);
      finalPriceData = await fetchPriceData(finalTicker);
      console.log('Price data fetched:', finalPriceData ? 'Success' : 'Failed');
    }
    
    // Add price action line if we have a ticker and price data
    if (finalTicker && finalTicker.trim() !== '' && finalPriceData) {
      const priceActionLine = generatePriceActionLine(finalTicker, finalPriceData);
      
      // Remove any existing price action lines
      story = story.replace(/<p>.*?Price Action:.*?<\/p>/gi, '');
      story = story.replace(/.*?Price Action:.*?(?=\n\n|\n<p>|$)/gi, '');
      
      // Find where to insert price action (before Read Next if it exists, otherwise at the end)
      const readNextIndex = story.indexOf('Read Next:');
      if (readNextIndex !== -1) {
        // Insert before Read Next
        const beforeReadNext = story.substring(0, readNextIndex).trim();
        const readNextAndAfter = story.substring(readNextIndex);
        story = `${beforeReadNext}\n\n<p>${priceActionLine}</p>\n\n${readNextAndAfter}`;
      } else {
        // Add at the end
        story = `${story}\n\n<p>${priceActionLine}</p>`;
      }
      
      console.log('✅ Added price action line to story');
    } else if (finalTicker && finalTicker.trim() !== '') {
      console.log('⚠️ Ticker found but price data unavailable - skipping price action');
    } else {
      console.log('⚠️ No ticker found in story or request - skipping price action');
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

