import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailData {
  member_id: string
  email: string
  first_name: string
  last_name: string
  created_at: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const siteUrl = Deno.env.get('SITE_URL') || 'https://ph2026.vercel.app'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Récupérer les données du nouveau membre depuis la requête
    const { member_id } = await req.json()

    // Récupérer les infos du membre
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('id', member_id)
      .single()

    if (memberError || !member) {
      throw new Error('Membre non trouvé')
    }

    // Récupérer tous les super_admins
    const { data: superAdmins, error: adminsError } = await supabase
      .from('members')
      .select('email, first_name, last_name')
      .eq('role', 'super_admin')

    if (adminsError || !superAdmins || superAdmins.length === 0) {
      console.log('Aucun super_admin trouvé pour envoyer les notifications')
      return new Response(
        JSON.stringify({ message: 'Pas de super_admin à notifier' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Préparer le contenu de l'email
    const moderationUrl = `${siteUrl}/admin/moderation`
    const memberFullName = `${member.first_name} ${member.last_name}`.trim()
    const memberInfo = memberFullName || member.email

    const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #fff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
          }
          .info-box strong {
            color: #667eea;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .button:hover {
            background: #5a67d8;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Nouvelle inscription</h1>
        </div>
        <div class="content">
          <p>Bonjour,</p>
          
          <p>Un nouveau membre vient de s'inscrire sur la plateforme PH2026 et attend votre validation.</p>
          
          <div class="info-box">
            <p><strong>Nom :</strong> ${memberFullName || 'Non renseigné'}</p>
            <p><strong>Email :</strong> ${member.email}</p>
            <p><strong>Date d'inscription :</strong> ${new Date(member.created_at).toLocaleString('fr-FR')}</p>
            ${member.photo_url ? `<p><strong>Photo :</strong> Profil Google importé</p>` : ''}
          </div>
          
          <p>Ce membre est actuellement en attente d'approbation. Vous pouvez consulter sa demande et l'approuver ou la rejeter depuis l'interface de modération.</p>
          
          <div style="text-align: center;">
            <a href="${moderationUrl}" class="button">
              Accéder à la modération
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            <strong>Rappel :</strong> Seuls les super-administrateurs peuvent valider les nouvelles inscriptions.
          </p>
        </div>
        
        <div class="footer">
          <p>Cet email a été envoyé automatiquement depuis la plateforme PH2026.</p>
          <p>Ne pas répondre à cet email.</p>
        </div>
      </body>
    </html>
    `

    // Envoyer un email à chaque super_admin
    const emailPromises = superAdmins.map(async (admin) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'PH2026 <notifications@ph2026.fr>',
          to: admin.email,
          subject: `[PH2026] Nouvelle inscription : ${memberInfo}`,
          html: emailHtml,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`Erreur envoi email à ${admin.email}:`, error)
        throw new Error(`Erreur envoi email: ${error}`)
      }

      return response.json()
    })

    const results = await Promise.allSettled(emailPromises)
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`Emails envoyés: ${successful} succès, ${failed} échecs`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications envoyées à ${successful} administrateurs`,
        details: { successful, failed }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur dans notify-new-member:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})