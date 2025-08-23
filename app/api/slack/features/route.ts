import { NextRequest, NextResponse } from 'next/server';
import { checkSlackFeatures } from '@/lib/slack/features';

export async function GET(request: NextRequest) {
  try {
    const features = await checkSlackFeatures();
    
    return NextResponse.json(features);
  } catch (error) {
    console.error('Error checking Slack features:', error);
    return NextResponse.json(
      { 
        hasAdminScopes: false,
        canManageChannels: false,
        canReadMessages: false,
        canInviteUsers: false,
        isPaidWorkspace: false
      },
      { status: 200 }
    );
  }
}