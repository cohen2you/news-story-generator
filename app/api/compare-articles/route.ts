import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== CUSTOM COMPARISON API CALLED ===');
    
    const { sourceText, generatedText } = await request.json();
    
    console.log('Source text length:', sourceText?.length || 0);
    console.log('Generated text length:', generatedText?.length || 0);
    
    if (!sourceText || !generatedText) {
      console.log('ERROR: Missing source or generated text');
      return NextResponse.json({ error: 'Source and generated text are required' }, { status: 400 });
    }

    console.log('=== STARTING CUSTOM COMPARISON ===');
    
    // Custom string matching algorithm
    function findIdenticalSegments(source: string, generated: string) {
      console.log('Processing source text...');
      
      // Normalize text: decode HTML entities, normalize whitespace
      const normalizeText = (text: string) => {
        return text
          .replace(/&#x27;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      const normalizedSource = normalizeText(source);
      const normalizedGenerated = normalizeText(generated);
      
      console.log('Normalized source length:', normalizedSource.length);
      console.log('Normalized generated length:', normalizedGenerated.length);
      
      // Split into words (preserve punctuation and case for exact matching)
      const sourceWords = normalizedSource.split(/\s+/);
      const generatedWords = normalizedGenerated.split(/\s+/);
      
      console.log('Source words count:', sourceWords.length);
      console.log('Generated words count:', generatedWords.length);
      
      const matches: Array<{start: number, end: number, words: string[], text: string}> = [];
      
      // Extract direct quotes from generated text (text within quotation marks)
      const quoteRegex = /"([^"]+)"/g;
      const directQuotes: string[] = [];
      let quoteMatch;
      while ((quoteMatch = quoteRegex.exec(normalizedGenerated)) !== null) {
        directQuotes.push(quoteMatch[1].toLowerCase().trim());
      }
      
      console.log(`Found ${directQuotes.length} direct quotes in generated text:`, directQuotes);
      
      // Find all possible 4+ word sequences in source
      for (let i = 0; i <= sourceWords.length - 4; i++) {
        // Try sequences of increasing length (4, 5, 6, 7, 8, 9, 10 words)
        for (let length = 4; length <= Math.min(10, sourceWords.length - i); length++) {
          const sequence = sourceWords.slice(i, i + length);
          const sequenceText = sequence.join(' ');
          
          // Check if this exact sequence exists in generated text
          if (normalizedGenerated.includes(sequenceText)) {
            // Check if this sequence is part of a direct quote
            const isPartOfQuote = directQuotes.some(quote => 
              quote.includes(sequenceText.toLowerCase())
            );
            
            if (isPartOfQuote) {
              console.log(`Skipping match in direct quote: "${sequenceText}"`);
              continue; // Skip this match as it's part of a direct quote
            }
            
            // Verify it's not already covered by a longer match
            const isOverlapped = matches.some(match => 
              (i >= match.start && i <= match.end) || 
              (i + length - 1 >= match.start && i + length - 1 <= match.end)
            );
            
            if (!isOverlapped) {
              matches.push({
                start: i,
                end: i + length - 1,
                words: sequence,
                text: sequenceText
              });
              console.log(`Found match: "${sequenceText}" (${length} words, position ${i}-${i + length - 1})`);
            }
          }
        }
      }
      
      // Sort by start position
      matches.sort((a, b) => a.start - b.start);
      
      console.log(`\n=== COMPARISON COMPLETE ===`);
      console.log(`Total matches found: ${matches.length}`);
      matches.forEach((match, index) => {
        console.log(`${index + 1}. "${match.text}" (${match.words.length} words, position ${match.start}-${match.end})`);
      });
      
      return matches;
    }
    
    const segments = findIdenticalSegments(sourceText, generatedText);
    
    // Convert to the expected format with colors
    const coloredSegments = segments.map((segment, index) => {
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
      const color = colors[index % colors.length];
      
      return {
        start: segment.start,
        end: segment.end,
        words: segment.words,
        color: color
      };
    });
    
    return NextResponse.json({
      success: true,
      segments: coloredSegments,
      totalSegments: coloredSegments.length
    });
    
  } catch (error) {
    console.error('Error in compare-articles API:', error);
    return NextResponse.json({ error: 'Failed to compare articles' }, { status: 500 });
  }
}
