#!/usr/bin/env node

/**
 * Script pour créer un utilisateur de test dans Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://nzdtnhdgekawwmjrpako.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56ZHRuaGRnZWthd3dtanJwYWtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkxNDI2NywiZXhwIjoyMDcwNDkwMjY3fQ.CqgQcsudOviGDPxkaQacMft6wDg1DEfQcBhgAc7PYl0';

// Créer le client avec la clé service_role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  console.log('Création d\'un utilisateur de test...');
  
  try {
    // Créer l'utilisateur
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: 'test@nousparisiens.fr',
      password: 'TestChat123!',
      email_confirm: true // Confirmer automatiquement l'email
    });
    
    if (userError) {
      if (userError.message.includes('already been registered')) {
        console.log('✅ L\'utilisateur de test existe déjà');
        
        // Réinitialiser le mot de passe
        const { error: resetError } = await supabase.auth.admin.updateUserById(
          user?.id || '',
          { password: 'TestChat123!' }
        );
        
        if (resetError) {
          console.error('Erreur réinitialisation mot de passe:', resetError);
        } else {
          console.log('✅ Mot de passe réinitialisé');
        }
      } else {
        throw userError;
      }
    } else {
      console.log('✅ Utilisateur créé:', user.user?.email);
      
      // Créer le profil membre
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: user.user?.id,
          email: 'test@nousparisiens.fr',
          first_name: 'Test',
          last_name: 'Chat'
        });
      
      if (memberError && !memberError.message.includes('duplicate')) {
        console.error('Erreur création profil:', memberError);
      } else {
        console.log('✅ Profil membre créé');
      }
    }
    
    // Récupérer un groupe et ajouter l'utilisateur
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name')
      .limit(1);
    
    if (groups && groups.length > 0) {
      const { data: existingUser } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', 'test@nousparisiens.fr')
        .single();
      
      if (existingUser) {
        const { error: groupError } = await supabase
          .from('user_groups')
          .insert({
            user_id: existingUser.id,
            group_id: groups[0].id
          });
        
        if (groupError && !groupError.message.includes('duplicate')) {
          console.error('Erreur ajout au groupe:', groupError);
        } else {
          console.log(`✅ Ajouté au groupe: ${groups[0].name}`);
        }
      }
    }
    
    console.log('\n📧 Email: test@nousparisiens.fr');
    console.log('🔑 Mot de passe: TestChat123!');
    console.log('\n✨ Utilisateur de test prêt !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createTestUser();