import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Récupérer les infos du membre qui vient de s'inscrire
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!member || member.role !== 'pending') {
      return NextResponse.json(
        { error: 'Membre non trouvé ou déjà approuvé' },
        { status: 400 }
      )
    }

    // Récupérer tous les super_admins
    const { data: superAdmins } = await supabase
      .from('members')
      .select('email, first_name, last_name')
      .eq('role', 'super_admin')

    if (!superAdmins || superAdmins.length === 0) {
      console.log('Aucun super_admin trouvé')
      return NextResponse.json(
        { message: 'Pas de super_admin à notifier' },
        { status: 200 }
      )
    }

    const memberFullName = `${member.first_name} ${member.last_name}`.trim()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Template email simplifié
    const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4A5568; color: white; padding: 20px; text-align: center; }
          .content { background: #fff; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; padding: 10px 20px; background: #4A5568; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Nouvelle inscription - PH2026</h2>
          </div>
          <div class="content">
            <p>Un nouveau membre attend votre validation :</p>
            <ul>
              <li><strong>Nom :</strong> ${memberFullName || 'Non renseigné'}</li>
              <li><strong>Email :</strong> ${member.email}</li>
              <li><strong>Date :</strong> ${new Date(member.created_at).toLocaleString('fr-FR')}</li>
            </ul>
            <p style="margin-top: 20px;">
              <a href="${siteUrl}/admin/moderation" class="button">
                Accéder à la modération
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
    `

    // Si Resend n'est pas configuré, on log simplement
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      console.log('RESEND_API_KEY non configuré - Notification email simulée')
      console.log(`Nouveaux membre à valider : ${memberFullName} (${member.email})`)
      console.log(`${superAdmins.length} super_admins auraient été notifiés`)
      
      return NextResponse.json({
        success: true,
        message: 'Notification simulée (Resend non configuré)',
        adminsToNotify: superAdmins.length
      })
    }

    // Envoyer les emails via Resend
    const emailPromises = superAdmins.map(async (admin) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'PH2026 <onboarding@resend.dev>', // Utiliser onboarding@resend.dev en dev
          to: admin.email,
          subject: `[PH2026] Nouvelle inscription : ${memberFullName || member.email}`,
          html: emailHtml,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`Erreur envoi email à ${admin.email}:`, error)
        return { error }
      }

      return response.json()
    })

    const results = await Promise.allSettled(emailPromises)
    const successful = results.filter(r => r.status === 'fulfilled').length

    return NextResponse.json({
      success: true,
      message: `Notifications envoyées à ${successful} administrateurs`,
      adminsNotified: successful
    })

  } catch (error: any) {
    console.error('Erreur notification admin:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}