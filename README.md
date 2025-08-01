# Comprehensive Financial Article Generator

A Next.js application that generates comprehensive financial news articles from source material, with intelligent market context and Benzinga API integration.

## Features

### 🎯 **News-First Approach**
- Starts with the news story, not market data
- Avoids plagiarism by rewriting in original language
- Includes direct quotes when appropriate
- Intelligent content analysis to determine relevant financial elements

### 🔗 **URL Integration**
- Paste URLs to scrape content automatically
- Manual text input option
- Hyperlink integration in generated articles

### 📊 **Market Context**
- Real-time market data from Benzinga API
- Intelligent selection of relevant market symbols
- Market volatility analysis
- Related articles from Benzinga

### 🎨 **Content Enhancement**
- **CTA Generation**: Automatic call-to-action lines
- **Subheadings**: AI-generated article subheadings
- **Hyperlinking**: Smart link integration
- **Market Analysis**: Content-aware financial context

### 📈 **Benzinga Integration**
- Real-time stock data
- Related news articles
- Market sentiment analysis
- Professional financial news formatting

## How It Works

1. **Input Source**: Paste text or provide a URL to scrape
2. **Content Analysis**: AI analyzes the content to determine:
   - Relevant market sectors
   - Market impact (bullish/bearish/neutral)
   - Suggested stock symbols
   - Financial context needed
3. **Market Data**: Fetches relevant market data and news
4. **Article Generation**: Creates a comprehensive financial article with:
   - News story as the lead
   - Market context and analysis
   - Related articles and market data
   - Optional CTA and subheadings

## Example Output

Instead of starting with ticker-focused content like:
> "SPDR S&P 500 ETF Trust (NYSE: SPY) traded lower on Friday..."

The generator now starts with the news:
> "President Donald Trump announced Friday that he has 'ordered two Nuclear Submarines to be positioned in the appropriate regions' following 'highly provocative statements' made by former Russian President Dmitry Medvedev. This development has significant implications for market stability and geopolitical risk..."

Then adds intelligent market context based on the story's implications.

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables**:
   Create a `.env.local` file with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   BENZINGA_API_KEY=your_benzinga_api_key
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Access the Application**:
   - Main page: `http://localhost:3000`
   - Dedicated comprehensive article page: `http://localhost:3000/comprehensive-article`

## Usage

1. **Enter Source Content**:
   - Paste text directly, or
   - Enter a URL and check "Scrape" to extract content

2. **Configure Options**:
   - **Ticker**: Optional specific stock focus
   - **Market Data**: Include real-time market context
   - **CTA**: Generate call-to-action lines
   - **Subheadings**: Add article subheadings

3. **Generate Article**:
   - Click "Generate Article"
   - Review the comprehensive output
   - Copy the formatted article

## API Endpoints

- `/api/generate/comprehensive-article` - Main article generation
- `/api/scrape` - URL content scraping
- `/api/bz/articles` - Benzinga news articles
- `/api/bz/priceaction` - Benzinga price data

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4
- **Market Data**: Benzinga API
- **Web Scraping**: Built-in fetch with content extraction

## Key Improvements

- **News-First Approach**: Prioritizes the story over market data
- **Intelligent Analysis**: Content-aware financial context
- **Comprehensive Features**: All WIIM generator features integrated
- **Better UX**: Cleaner interface with all options in one place
- **Flexible Input**: URL scraping or direct text input

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License. 