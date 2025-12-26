import { NextRequest, NextResponse } from 'next/server';

// Google Apps Script Web App URL for feedback (same as analytics)
const FEEDBACK_SCRIPT_URL = process.env.NEXT_PUBLIC_FEEDBACK_SCRIPT_URL || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rating, comment, feature, timestamp, userCode } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating is required (1-5 stars)' },
        { status: 400 }
      );
    }

    // Send to Google Apps Script
    const response = await fetch(FEEDBACK_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        rating: rating,
        comment: comment?.trim() || '',
        feature: feature?.trim() || '',
        timestamp: timestamp || new Date().toISOString(),
        userCode: userCode || 'anonymous',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit feedback to Google Apps Script');
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      result
    });

  } catch (error) {
    console.error('Feedback API Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
