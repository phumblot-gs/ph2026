#!/usr/bin/env node

/**
 * Script pour créer un utilisateur système pour les messages Slack
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

// UUID fixe pour l'utilisateur système Slack
const SLACK_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'

async function createSlackSystemUser() {
  console.log('Création de l\'utilisateur système pour Slack...')
  
  try {
    // Vérifier si l'utilisateur existe déjà
    const { data: existingMember } = await supabase
      .from('members')
      .select('user_id')
      .eq('user_id', SLACK_SYSTEM_USER_ID)
      .single()
    
    if (existingMember) {
      console.log('✅ L\'utilisateur système Slack existe déjà')
      return SLACK_SYSTEM_USER_ID
    }
    
    // Créer le profil membre système
    const { error: memberError } = await supabase
      .from('members')
      .insert({
        user_id: SLACK_SYSTEM_USER_ID,
        email: 'slack-system@nousparisiens.fr',
        first_name: 'Slack',
        last_name: 'User',
        role: 'member'
      })
    
    if (memberError) {
      throw memberError
    }
    
    console.log('✅ Utilisateur système Slack créé avec ID:', SLACK_SYSTEM_USER_ID)
    
    // Ajouter l'utilisateur système à tous les groupes
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name')
    
    for (const group of groups || []) {
      const { error: groupError } = await supabase
        .from('user_groups')
        .insert({
          user_id: SLACK_SYSTEM_USER_ID,
          group_id: group.id
        })
      
      if (groupError && !groupError.message.includes('duplicate')) {
        console.error(`Erreur ajout au groupe ${group.name}:`, groupError.message)
      } else {
        console.log(`  ✅ Ajouté au groupe ${group.name}`)
      }
    }
    
    console.log('\n✨ Utilisateur système Slack prêt !')
    return SLACK_SYSTEM_USER_ID
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

createSlackSystemUser()