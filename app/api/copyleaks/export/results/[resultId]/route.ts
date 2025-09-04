import { NextResponse } from 'next/server';
import { storeExportedData } from '@/lib/copyleaks-storage';

export async function POST(request: Request, { params }: { params: Promise<{ resultId: string }> }) {
  try {
    const url = new URL(request.url);
    const scanId = url.pathname.split('/')[4]; // Extract scanId from path
    const { resultId } = await params;
    
    const exportData = await request.json();
    
    console.log(`Export result webhook received for scanId: ${scanId}, resultId: ${resultId}`);
    console.log('Result data keys:', Object.keys(exportData));
    
    // Store the result export data
    const key = `result-${scanId}-${resultId}`;
    storeExportedData(key, {
      scanId,
      resultId,
      data: exportData,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Export result webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Export result webhook processing failed.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ resultId: string }> }) {
  try {
    const url = new URL(request.url);
    const scanId = url.pathname.split('/')[4]; // Extract scanId from path
    const { resultId } = await params;
    
    const { getExportedData } = await import('@/lib/copyleaks-storage');
    const key = `result-${scanId}-${resultId}`;
    const data = getExportedData(key);
    
    if (!data) {
      return NextResponse.json({ 
        scanId,
        resultId,
        status: 'not_found',
        message: 'Result data not available yet'
      });
    }
    
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Export result retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve result data.' },
      { status: 500 }
    );
  }
}
