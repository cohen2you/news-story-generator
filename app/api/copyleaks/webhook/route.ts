import { NextResponse } from 'next/server';
import CopyleaksService, { CopyleaksWebhookData } from '@/lib/copyleaks';

// Store scan results in memory (in production, use a database)
const scanResults = new Map<string, any>();
const resultDetails = new Map<string, any>();

export async function POST(request: Request) {
  try {
    const webhookData: CopyleaksWebhookData = await request.json();
    
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

    const { scanId, status, alerts, results } = webhookData;

    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId' }, { status: 400 });
    }

    // Handle different webhook types
    if (status === 'completed') {
      // This is the completion webhook with AI detection and overview data
      const aiDetected = alerts?.some(alert => alert.type === 'ai-detection') || false;
      const aiProbability = alerts?.find(alert => alert.type === 'ai-detection')?.data?.probability || 0;

      scanResults.set(scanId, {
        scanId,
        status: 'completed',
        aiDetected,
        aiProbability,
        alerts,
        timestamp: new Date().toISOString(),
        plagiarismResults: results || [],
      });

      console.log('Scan completed for:', scanId, 'with', results?.length || 0, 'results');

    } else if (results && results.length > 0) {
      // This is a result webhook for individual plagiarism matches
      for (const result of results) {
        const resultKey = `${scanId}-${result.id}`;
        resultDetails.set(resultKey, {
          scanId,
          resultId: result.id,
          url: result.url,
          title: result.title,
          matchedWords: result.matchedWords,
          identicalWords: result.identicalWords,
          minorChangesWords: result.minorChangesWords,
          relatedMeaningWords: result.relatedMeaningWords,
          timestamp: new Date().toISOString(),
        });

        console.log('Result processed for:', scanId, 'result:', result.id);
      }

    } else if (status === 'export-completed') {
      // This is the export completed webhook
      console.log('Export completed for:', scanId);
      
    } else {
      // Other status updates
      scanResults.set(scanId, {
        scanId,
        status,
        timestamp: new Date().toISOString(),
      });
      console.log('Status update for:', scanId, 'status:', status);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    // Webhook error handled silently
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.searchParams.get('scanId');
    const resultId = url.searchParams.get('resultId');

    console.log('GET request for scanId:', scanId, 'resultId:', resultId);
    console.log('Available scan results:', Array.from(scanResults.keys()));
    console.log('Available result details:', Array.from(resultDetails.keys()));

    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId parameter' }, { status: 400 });
    }

    if (resultId) {
      // Get specific result details
      const resultKey = `${scanId}-${resultId}`;
      const result = resultDetails.get(resultKey);
      
      if (!result) {
        // Return 200 with empty result instead of 404 to avoid log spam
        return NextResponse.json({ 
          scanId,
          resultId,
          status: 'processing',
          message: 'Result is still being processed'
        });
      }

      return NextResponse.json(result);
    } else {
      // Get scan overview
      const scanResult = scanResults.get(scanId);
      
      if (!scanResult) {
        // Return 200 with empty result instead of 404 to avoid log spam
        return NextResponse.json({ 
          scanId,
          status: 'processing',
          message: 'Scan is still being processed'
        });
      }

      // Get all result details for this scan
      const allResults = Array.from(resultDetails.entries())
        .filter(([key]) => key.startsWith(`${scanId}-`))
        .map(([, value]) => value);

      // Calculate overall statistics
      const totalMatchedWords = allResults.reduce((sum, result) => sum + result.matchedWords, 0);
      const totalWords = scanResult.totalWords || 1000; // Default estimate if not available
      const overallSimilarityPercentage = totalWords > 0 ? Math.round((totalMatchedWords / totalWords) * 100) : 0;

      return NextResponse.json({
        ...scanResult,
        plagiarismResults: allResults,
        totalMatchedWords,
        totalWords,
        overallSimilarityPercentage,
      });
    }

  } catch (error: any) {
    // Error retrieving scan result handled silently
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve scan result.' },
      { status: 500 }
    );
  }
}
