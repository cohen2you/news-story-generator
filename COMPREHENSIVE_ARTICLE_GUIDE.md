# Comprehensive Financial Article Generator

## Overview

The Comprehensive Financial Article Generator transforms any news source into a professional financial news article with market context, avoiding plagiarism while preserving important quotes and adding market analysis.

## Features

### ✅ Plagiarism Avoidance
- Rewrites source content in original language
- Maintains factual accuracy while using different phrasing
- Preserves key information and context

### ✅ Direct Quotes
- Includes important quotes from the source material
- Uses proper quotation marks and attribution
- Maintains the authenticity of key statements

### ✅ Market Context
- Integrates real-time market data from Benzinga API
- Includes major indices (SPY, QQQ, VOO, VIX, GLD, TLT)
- Provides market volatility analysis

### ✅ Stock Details
- Lists specific stocks affected by the news
- Includes price movements and percentages
- Shows top market movers

### ✅ Professional Format
- Benzinga-style formatting and structure
- HTML formatting with proper tags
- Professional financial news tone

## How to Use

### Method 1: Main Page Integration
1. Go to the main page (`/`)
2. Click "Show Comprehensive Article Generator"
3. Paste your source text
4. Optionally specify a ticker symbol
5. Click "Generate Article"

### Method 2: Dedicated Page
1. Navigate to `/comprehensive-article`
2. Use the full-featured interface
3. Paste your source text
4. Configure options
5. Generate your article

## Example Usage

### Input Source (Trump Nuclear Submarines)
```
President Donald Trump announced Friday that he has "ordered two Nuclear Submarines to be positioned in the appropriate regions" following "highly provocative statements" made by former Russian President Dmitry Medvedev.

Medvedev said earlier this week that Trump's new deadline for Russia to end the conflict with Ukraine is an additional "step towards war."

"Based on the highly provocative statements of the Former President of Russia, Dmitry Medvedev, who is now the Deputy Chairman of the Security Council of the Russian Federation, I have ordered two Nuclear Submarines to be positioned in the appropriate regions, just in case these foolish and inflammatory statements are more than just that," Trump said in a post on Truth Social.
```

### Expected Output
The generator will create an article similar to:

```
If August is historically volatile due to light volumes and summer complacency, the first day of the month in 2025 has already set the stage for a nerve-wracking ride on Wall Street.

SPY ETF is moving fast. Check live prices here.

In less than 24 hours, investors were hit with three destabilizing headlines: new sweeping tariffs from President Donald Trump to countries not agreeing on a deal, a surprisingly weak U.S. jobs report, and escalating nuclear rhetoric with Russia.

Trump Moves Two Nuclear Submarines Over Medvedev Comments

"Based on the highly provocative statements of the Former President of Russia, Dmitry Medvedev… I have ordered two Nuclear Submarines to be positioned in the appropriate regions, just in case these foolish and inflammatory statements are more than just that," Trump wrote Friday on Truth social.

Markets Break Down: VIX Spikes, Stocks Drop Across the Board

Wall Street didn't take the headlines lightly.

By early afternoon in New York, the S&P 500—as tracked by the Vanguard S&P 500 ETF (VOO)—was down 1.8%, marking its worst day since April 21.

The CBOE Volatility Index (VIX), widely known as Wall Street's "fear gauge," surged 27%—the largest single-day spike since April 7.
```

## API Endpoint

### `/api/generate/comprehensive-article`

**Method:** POST

**Request Body:**
```json
{
  "sourceText": "Your source article text here",
  "ticker": "SPY", // Optional
  "includeMarketData": true // Optional, defaults to true
}
```

**Response:**
```json
{
  "article": "Generated HTML article",
  "marketData": { /* Market data from Benzinga */ },
  "topMovers": [ /* Top market movers */ ],
  "marketStatus": "open|premarket|afterhours|closed"
}
```

## Configuration

### Environment Variables Required
- `OPENAI_API_KEY`: Your OpenAI API key
- `BENZINGA_API_KEY`: Your Benzinga API key

### Market Data Sources
- **Major Indices:** SPY, QQQ, VOO, VIX, GLD, TLT
- **News Sources:** Benzinga API for market-moving news
- **Price Data:** Real-time quotes from Benzinga

## Best Practices

1. **Source Quality:** Use high-quality, factual source material
2. **Ticker Relevance:** Specify relevant ticker symbols when applicable
3. **Market Context:** Enable market data for comprehensive analysis
4. **Review Output:** Always review generated content for accuracy
5. **Quote Verification:** Verify important quotes are preserved correctly

## Troubleshooting

### Common Issues
- **API Errors:** Check your OpenAI and Benzinga API keys
- **Market Data Missing:** Verify Benzinga API access
- **Generation Fails:** Ensure source text is not empty
- **Format Issues:** Check HTML output for proper formatting

### Error Messages
- `Source text is required`: Add source material
- `OpenAI error`: Check OpenAI API key and quota
- `Benzinga API error`: Verify Benzinga API access

## Technical Details

### Dependencies
- Next.js 14+ with App Router
- OpenAI GPT-4o for content generation
- Benzinga API for market data
- Tailwind CSS for styling

### File Structure
```
app/
├── api/generate/comprehensive-article/route.ts
├── comprehensive-article/page.tsx
└── page.tsx (main page with integration)

components/
└── ComprehensiveArticleForm.tsx
```

## Future Enhancements

- [ ] Custom market data sources
- [ ] Multiple article templates
- [ ] Batch processing
- [ ] Export to various formats
- [ ] Advanced plagiarism detection
- [ ] Custom tone and style options 