import { NextResponse } from 'next/server';

// Store exported data in memory (in production, use a database)
const exportedData = new Map<string, any>();

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.pathname.split('/')[4]; // Extract scanId from path
    
    const exportData = await request.json();
    
    console.log(`Export source webhook received for scanId: ${scanId}`);
    console.log('Source data length:', JSON.stringify(exportData).length);
    
    // Store the source export data
    exportedData.set(`source-${scanId}`, {
      scanId,
      data: exportData,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Export source webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Export source webhook processing failed.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.pathname.split('/')[4]; // Extract scanId from path
    
    const data = exportedData.get(`source-${scanId}`);
    
    if (!data) {
      return NextResponse.json({ 
        scanId,
        status: 'not_found',
        message: 'Source data not available yet'
      });
    }
    
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Export source retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve source data.' },
      { status: 500 }
    );
  }
}
