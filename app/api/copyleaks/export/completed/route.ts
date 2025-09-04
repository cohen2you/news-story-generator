import { NextResponse } from 'next/server';

// Store exported data in memory (in production, use a database)
const exportedData = new Map<string, any>();

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.pathname.split('/')[4]; // Extract scanId from path
    
    const exportData = await request.json();
    
    console.log(`Export completed webhook received for scanId: ${scanId}`);
    console.log('Export data:', JSON.stringify(exportData, null, 2));
    
    // Store the completed export data
    exportedData.set(`completed-${scanId}`, {
      scanId,
      data: exportData,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Export completed webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Export completed webhook processing failed.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanId = url.pathname.split('/')[4]; // Extract scanId from path
    
    const data = exportedData.get(`completed-${scanId}`);
    
    if (!data) {
      return NextResponse.json({ 
        scanId,
        status: 'not_found',
        message: 'Export data not available yet'
      });
    }
    
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Export completed retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve export data.' },
      { status: 500 }
    );
  }
}
