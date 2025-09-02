#!/usr/bin/env node

/**
 * Script pour initialiser le chat natif des groupes existants
 * avec un message de bienvenue
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

async function initGroupChats() {
  console.log('Initialisation du chat pour les groupes existants...\n')
  
  try {
    // Récupérer tous les groupes
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name')
    
    if (groupsError) {
      throw groupsError
    }
    
    console.log(`${groups.length} groupe(s) trouvé(s)\n`)
    
    // Pour chaque groupe, vérifier s'il a déjà des messages
    for (const group of groups) {
      console.log(`Vérification du groupe: ${group.name}`)
      
      // Vérifier s'il existe déjà des messages
      const { data: existingMessages, error: checkError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('group_id', group.id)
        .limit(1)
      
      if (checkError) {
        console.error(`  ❌ Erreur vérification: ${checkError.message}`)
        continue
      }
      
      if (existingMessages && existingMessages.length > 0) {
        console.log(`  ✓ Le groupe a déjà des messages`)
        continue
      }
      
      // Récupérer un admin du système pour poster le message de bienvenue
      const { data: systemUser } = await supabase
        .from('members')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single()
      
      const userId = systemUser?.user_id || '00000000-0000-0000-0000-000000000000' // UUID fictif si pas d'admin
      
      // Créer un message de bienvenue
      const welcomeMessage = {
        group_id: group.id,
        user_id: userId,
        text: `🎉 Bienvenue dans le nouveau système de chat natif !\n\nCe chat remplace progressivement l'intégration Slack et offre de nouvelles fonctionnalités :\n• 💬 Messages en temps réel\n• 👍 Réactions avec emojis\n• 💾 Partage de fichiers\n• 🔔 Notifications\n• 💬 Réponses en thread\n\nBon échanges !`,
        formatted_text: null,
        is_from_slack: false,
        slack_sync_status: 'none',
        metadata: {
          is_system_message: true
        }
      }
      
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert(welcomeMessage)
      
      if (insertError) {
        console.error(`  ❌ Erreur création message: ${insertError.message}`)
      } else {
        console.log(`  ✅ Message de bienvenue créé`)
      }
    }
    
    console.log('\n✨ Initialisation terminée !')
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

initGroupChats()