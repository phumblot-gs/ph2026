import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { slackBotClient } from '@/lib/slack/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer les infos du membre Slack avec nom et prénom
    const { data: member } = await supabase
      .from('members')
      .select('slack_user_id, slack_access_token, first_name, last_name')
      .eq('user_id', user.id)
      .single()

    if (!member?.slack_user_id) {
      return NextResponse.json(
        { error: 'Compte Slack non connecté' },
        { status: 400 }
      )
    }

    if (!slackBotClient) {
      return NextResponse.json(
        { error: 'Slack n\'est pas configuré' },
        { status: 500 }
      )
    }

    // Récupérer le FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const channel = formData.get('channel') as string
    const title = formData.get('title') as string || 'Fichier'
    const initialComment = formData.get('initial_comment') as string || ''

    if (!file || !channel) {
      return NextResponse.json(
        { error: 'Fichier et canal requis' },
        { status: 400 }
      )
    }

    // Convertir le File en Buffer pour Slack
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Préparer le commentaire initial avec la signature au format attendu
    // Format: _Envoyé par PRENOM NOM • slack_user_id_
    const fullName = `${member.first_name} ${member.last_name}`
    const commentWithSignature = `_Envoyé par ${fullName} • ${member.slack_user_id}_\n${initialComment}`

    // Utiliser l'API Slack pour uploader le fichier
    const result = await slackBotClient.files.uploadV2({
      channel_id: channel,
      file: buffer,
      filename: file.name,
      title: title,
      initial_comment: commentWithSignature
    })

    if (!result.ok) {
      throw new Error(result.error || 'Erreur Slack inconnue')
    }

    return NextResponse.json({ 
      ok: true, 
      file: (result as any).file 
    })
  } catch (error: any) {
    console.error('Erreur upload fichier Slack:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'upload du fichier' },
      { status: 500 }
    )
  }
}