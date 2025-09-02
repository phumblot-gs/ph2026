#!/usr/bin/env node

/**
 * Script pour réinitialiser les messages Slack et resynchroniser
 */

import { createClient } from '@supabase/supabase-js'

// Configuration
const SUPABASE_URL = 'https://nzdtnhdgekawwmjrpako.supabase.co'
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56ZHRuaGRnZWthd3dtanJwYWtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkxNDI2NywiZXhwIjoyMDcwNDkwMjY3fQ.CqgQcsudOviGDPxkaQacMft6wDg1DEfQcBhgAc7PYl0'

// Créer le client avec la clé service_role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetSlackMessages() {
  console.log('Réinitialisation des messages Slack...\n')
  
  try {
    // 1. Supprimer tous les messages Slack existants
    console.log('Suppression des messages Slack existants...')
    const { error: deleteError, count } = await supabase
      .from('chat_messages')
      .delete()
      .eq('is_from_slack', true)
    
    if (deleteError) {
      console.error('Erreur suppression:', deleteError)
    } else {
      console.log(`✅ ${count || 0} messages Slack supprimés`)
    }
    
    // 2. Réinitialiser les messages de bienvenue
    console.log('\nRéinitialisation des messages de bienvenue...')
    const { error: deleteWelcomeError } = await supabase
      .from('chat_messages')
      .delete()
      .like('text', '🎉 Bienvenue dans le nouveau système de chat natif%')
    
    if (deleteWelcomeError) {
      console.error('Erreur suppression messages bienvenue:', deleteWelcomeError)
    }
    
    // 3. Recréer les messages de bienvenue
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name')
    
    for (const group of groups || []) {
      // Récupérer un admin pour poster le message
      const { data: admin } = await supabase
        .from('members')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single()
      
      if (admin) {
        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            group_id: group.id,
            user_id: admin.user_id,
            text: `🎉 Bienvenue dans le nouveau système de chat natif !\n\nCe chat remplace progressivement l'intégration Slack et offre de nouvelles fonctionnalités :\n• 💬 Messages en temps réel\n• 👍 Réactions avec emojis\n• 💾 Partage de fichiers\n• 🔔 Notifications\n• 💬 Réponses en thread\n\nBon échanges !`,
            is_from_slack: false,
            slack_sync_status: 'none'
          })
        
        if (!insertError) {
          console.log(`  ✅ Message de bienvenue créé pour ${group.name}`)
        }
      }
    }
    
    console.log('\n✨ Réinitialisation terminée !')
    console.log('\nPour resynchroniser les messages Slack, rechargez la page du chat.')
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

resetSlackMessages()