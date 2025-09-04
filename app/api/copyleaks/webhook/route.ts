import { NextResponse } from 'next/server';
import CopyleaksService, { CopyleaksWebhookData } from '@/lib/copyleaks';

// Store scan results in memory (in production, use a database)
const scanResults = new Map<string, any>();
const resultDetails = new Map<string, any>();

// Function to request export for detailed text segments
async function requestExport(scanId: string) {
  if (!process.env.COPYLEAKS_API_KEY) {
    console.log('Copyleaks API key not configured, skipping export request');
    return;
  }

  const copyleaksService = new CopyleaksService(process.env.COPYLEAKS_API_KEY);
  
  try {
    console.log(`=== REQUESTING EXPORT FOR SCANID: ${scanId} ===`);
    const exportResult = await copyleaksService.requestExport(scanId);
    console.log('=== EXPORT REQUESTED SUCCESSFULLY ===', exportResult);
  } catch (error: any) {
    console.error(`=== FAILED TO REQUEST EXPORT FOR ${scanId} ===`, error.message);
    console.error('Full error:', error);
  }
}

// Function to check for exported data
async function checkForExportedData(scanId: string): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // Check if we have completed export data
    const completedResponse = await fetch(`${baseUrl}/api/copyleaks/export/${scanId}/completed`);
    if (completedResponse.ok) {
      const completedData = await completedResponse.json();
      if (completedData.status !== 'not_found') {
        console.log(`Found exported data for scanId: ${scanId}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking for exported data for ${scanId}:`, error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const webhookData: CopyleaksWebhookData = await request.json();
    
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

    // Handle the actual Copyleaks webhook format
    const scanId = webhookData.scannedDocument?.scanId;
    const results = webhookData.results;
    const score = results?.score;
    const internetResults = results?.internet || [];
    const totalWords = webhookData.scannedDocument?.totalWords || 0;

    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId' }, { status: 400 });
    }

    // Process the scan results
    if (results && internetResults.length > 0) {
      // Store the main scan result
      scanResults.set(scanId, {
        scanId,
        status: 'completed',
        aiDetected: false, // AI detection not enabled in this scan
        aiProbability: 0,
        totalWords,
        timestamp: new Date().toISOString(),
        plagiarismResults: internetResults.map(result => ({
          resultId: result.id,
          url: result.url,
          title: result.title,
          matchedWords: result.matchedWords,
          identicalWords: result.identicalWords,
          minorChangesWords: result.similarWords || 0,
          relatedMeaningWords: result.paraphrasedWords || 0,
          totalWords: result.totalWords,
          similarityPercentage: result.totalWords > 0 ? Math.round((result.matchedWords / result.totalWords) * 100) : 0,
        })),
      });

      // Store individual result details
      for (const result of internetResults) {
        const resultKey = `${scanId}-${result.id}`;
        resultDetails.set(resultKey, {
          scanId,
          resultId: result.id,
          url: result.url,
          title: result.title,
          matchedWords: result.matchedWords,
          identicalWords: result.identicalWords,
          minorChangesWords: result.similarWords || 0,
          relatedMeaningWords: result.paraphrasedWords || 0,
          totalWords: result.totalWords,
          similarityPercentage: result.totalWords > 0 ? Math.round((result.matchedWords / result.totalWords) * 100) : 0,
          timestamp: new Date().toISOString(),
        });
      }

      console.log('Scan completed for:', scanId, 'with', internetResults.length, 'results');
      console.log('Overall score:', score?.aggregatedScore || 0, '%');

      // Request export to get detailed text segments
      console.log('=== ABOUT TO REQUEST EXPORT ===');
      await requestExport(scanId);
      console.log('=== EXPORT REQUEST COMPLETED ===');

    } else {
      // No results found
      scanResults.set(scanId, {
        scanId,
        status: 'completed',
        aiDetected: false,
        aiProbability: 0,
        totalWords,
        timestamp: new Date().toISOString(),
        plagiarismResults: [],
      });
      console.log('Scan completed for:', scanId, 'with no plagiarism results');
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

      // Check for exported data
      const hasExportedData = await checkForExportedData(scanId);

      return NextResponse.json({
        ...scanResult,
        plagiarismResults: allResults,
        totalMatchedWords,
        totalWords,
        overallSimilarityPercentage,
        hasDetailedText: allResults.some(result => result.detailedFetched),
        hasExportedData,
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
