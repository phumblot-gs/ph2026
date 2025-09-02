#!/usr/bin/env node

/**
 * Script pour vérifier la configuration du chat natif
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

async function checkSetup() {
  console.log('Vérification de la configuration du chat natif...\n')
  
  try {
    // 1. Vérifier les messages
    console.log('📋 Messages dans la base :')
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, group_id, user_id, text, created_at')
      .limit(5)
      .order('created_at', { ascending: false })
    
    if (msgError) {
      console.error('❌ Erreur récupération messages:', msgError)
    } else {
      console.log(`✅ ${messages?.length || 0} message(s) trouvé(s)`)
      messages?.forEach(m => {
        console.log(`   - ${m.text.substring(0, 50)}... (user: ${m.user_id})`)
      })
    }
    
    // 2. Vérifier que les utilisateurs des messages ont des profils membres
    console.log('\n📋 Vérification des profils membres :')
    if (messages && messages.length > 0) {
      const userIds = [...new Set(messages.map(m => m.user_id))]
      
      for (const userId of userIds) {
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('user_id, first_name, last_name, email')
          .eq('user_id', userId)
          .single()
        
        if (memberError || !member) {
          console.error(`❌ Pas de profil membre pour l'utilisateur ${userId}`)
          
          // Créer un profil membre par défaut si manquant
          console.log(`   Création d'un profil membre par défaut...`)
          const { error: createError } = await supabase
            .from('members')
            .insert({
              user_id: userId,
              email: 'system@nousparisiens.fr',
              first_name: 'Système',
              last_name: 'Chat'
            })
          
          if (createError && !createError.message.includes('duplicate')) {
            console.error(`   ❌ Erreur création profil:`, createError.message)
          } else {
            console.log(`   ✅ Profil créé`)
          }
        } else {
          console.log(`✅ Profil trouvé: ${member.first_name} ${member.last_name}`)
        }
      }
    }
    
    // 3. Vérifier les groupes et leurs membres
    console.log('\n📋 Groupes et membres :')
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name')
    
    for (const group of groups || []) {
      const { data: members, error: membersError } = await supabase
        .from('user_groups')
        .select('user_id')
        .eq('group_id', group.id)
      
      console.log(`✅ ${group.name}: ${members?.length || 0} membre(s)`)
    }
    
    // 4. Vérifier les tables associées
    console.log('\n📋 Tables associées :')
    
    const { count: filesCount } = await supabase
      .from('chat_files')
      .select('*', { count: 'exact', head: true })
    console.log(`   - chat_files: ${filesCount || 0} fichier(s)`)
    
    const { count: reactionsCount } = await supabase
      .from('chat_reactions')
      .select('*', { count: 'exact', head: true })
    console.log(`   - chat_reactions: ${reactionsCount || 0} réaction(s)`)
    
    const { count: mentionsCount } = await supabase
      .from('chat_mentions')
      .select('*', { count: 'exact', head: true })
    console.log(`   - chat_mentions: ${mentionsCount || 0} mention(s)`)
    
    const { count: typingCount } = await supabase
      .from('chat_typing')
      .select('*', { count: 'exact', head: true })
    console.log(`   - chat_typing: ${typingCount || 0} indicateur(s)`)
    
    const { count: readStatusCount } = await supabase
      .from('chat_read_status')
      .select('*', { count: 'exact', head: true })
    console.log(`   - chat_read_status: ${readStatusCount || 0} statut(s)`)
    
    console.log('\n✨ Vérification terminée !')
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

checkSetup()