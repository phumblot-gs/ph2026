import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    // Récupérer les informations du membre
    const { data: member } = await supabase
      .from('members')
      .select('email, first_name, last_name, slack_user_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Vérifier si l'utilisateur est déjà connecté à Slack
    if (member.slack_user_id) {
      return NextResponse.json(
        { error: 'Already connected to Slack' },
        { status: 400 }
      );
    }

    // Vérifier s'il y a déjà une demande en cours
    const { data: existingInvite } = await supabase
      .from('slack_invitations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingInvite) {
      // Mettre à jour la demande existante
      const { error: updateError } = await supabase
        .from('slack_invitations')
        .update({
          requested_at: new Date().toISOString(),
          status: 'pending',
          completed_at: null,
          completed_by: null
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: 'Demande d\'invitation mise à jour',
        status: existingInvite.status
      });
    }

    // Créer une nouvelle demande d'invitation
    const { error: insertError } = await supabase
      .from('slack_invitations')
      .insert({
        user_id: user.id,
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        status: 'pending'
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: 'Demande d\'invitation envoyée'
    });
  } catch (error) {
    console.error('Error requesting Slack invitation:', error);
    return NextResponse.json(
      { error: 'Failed to request invitation' },
      { status: 500 }
    );
  }
}

// GET - Vérifier le statut de l'invitation
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const { data: invitation } = await supabase
      .from('slack_invitations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      invitation: invitation || null
    });
  } catch (error) {
    return NextResponse.json({
      invitation: null
    });
  }
}