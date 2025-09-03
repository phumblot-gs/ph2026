#!/usr/bin/env node

/**
 * Script pour tester la synchronisation Slack
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import https from 'https'

// Agent HTTPS pour ignorer les certificats auto-signés
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// Configuration depuis .env.local
const SUPABASE_URL = 'https://nzdtnhdgekawwmjrpako.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56ZHRuaGRnZWthd3dtanJwYWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTQyNjcsImV4cCI6MjA3MDQ5MDI2N30.vHnepyNrEJ2fAHG4BjwrCZoqgd9z12g6p9zHxzcXGdc'
const API_BASE_URL = 'https://localhost:3000/api'

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testSlackSync() {
  console.log('Test de la synchronisation Slack...\n')
  
  try {
    // 1. Se connecter
    console.log('Connexion...')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@nousparisiens.fr',
      password: 'TestChat123!'
    })
    
    if (authError) {
      throw new Error(`Impossible de se connecter : ${authError.message}`)
    }
    
    const authToken = authData.session?.access_token
    console.log('✅ Connecté\n')
    
    // 2. Récupérer les groupes avec canal Slack
    console.log('Récupération des groupes avec Slack...')
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name, slack_channel_id')
      .not('slack_channel_id', 'is', null)
    
    if (!groups || groups.length === 0) {
      console.log('Aucun groupe avec canal Slack configuré')
      return
    }
    
    console.log(`${groups.length} groupe(s) avec Slack :`)
    groups.forEach(g => console.log(`  - ${g.name} (${g.slack_channel_id})`))
    console.log('')
    
    // 3. Tester la synchronisation pour chaque groupe
    for (const group of groups) {
      console.log(`\nSynchronisation du groupe "${group.name}"...`)
      
      try {
        const response = await fetch(`${API_BASE_URL}/chat/sync-slack`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            group_id: group.id
          }),
          agent: httpsAgent
        })
        
        const data = await response.json()
        
        if (response.ok) {
          console.log(`  ✅ ${data.synced} message(s) synchronisé(s)`)
          console.log(`     ${data.message}`)
        } else {
          console.error(`  ❌ Erreur: ${data.error}`)
          if (data.details) {
            console.error(`     Détails: ${data.details}`)
          }
        }
      } catch (err) {
        console.error(`  ❌ Erreur requête: ${err.message}`)
      }
    }
    
    // 4. Vérifier les messages synchronisés
    console.log('\n\nVérification des messages synchronisés :')
    
    for (const group of groups) {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, text, is_from_slack, slack_user_id, created_at')
        .eq('group_id', group.id)
        .eq('is_from_slack', true)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) {
        console.error(`Erreur récupération messages pour ${group.name}: ${error.message}`)
      } else {
        console.log(`\n${group.name}: ${messages?.length || 0} message(s) Slack`)
        messages?.forEach(m => {
          console.log(`  - [${new Date(m.created_at).toLocaleString()}] ${m.text.substring(0, 50)}...`)
        })
      }
    }
    
    // 5. Déconnexion
    await supabase.auth.signOut()
    console.log('\n✨ Test terminé !')
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

testSlackSync()