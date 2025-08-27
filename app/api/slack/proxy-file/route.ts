import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { slackBotClient } from '@/lib/slack/client'

export async function GET(request: NextRequest) {
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

    // Récupérer l'URL du fichier à proxy
    const searchParams = request.nextUrl.searchParams
    const fileUrl = searchParams.get('url')
    
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'URL du fichier manquante' },
        { status: 400 }
      )
    }

    if (!slackBotClient) {
      return NextResponse.json(
        { error: 'Slack n\'est pas configuré' },
        { status: 500 }
      )
    }

    // Utiliser le bot token pour récupérer le fichier
    const response = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }

    // Récupérer le contenu du fichier
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Déterminer le type MIME
    const contentType = response.headers.get('content-type') || 'audio/mpeg'

    // Retourner le fichier audio
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache 1 heure
      }
    })
  } catch (error: any) {
    console.error('Error proxying Slack file:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération du fichier' },
      { status: 500 }
    )
  }
}