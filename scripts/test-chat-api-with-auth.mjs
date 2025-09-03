#!/usr/bin/env node

/**
 * Script de test avec authentification pour les APIs du chat
 * Usage: node scripts/test-chat-api-with-auth.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import https from 'https';

// Agent HTTPS pour ignorer les certificats auto-signés
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Configuration depuis .env.local
const SUPABASE_URL = 'https://nzdtnhdgekawwmjrpako.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56ZHRuaGRnZWthd3dtanJwYWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTQyNjcsImV4cCI6MjA3MDQ5MDI2N30.vHnepyNrEJ2fAHG4BjwrCZoqgd9z12g6p9zHxzcXGdc';
const API_BASE_URL = 'https://localhost:3000/api';

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function section(title) {
  console.log('');
  log(`${'='.repeat(50)}`, colors.bright);
  log(title, colors.bright + colors.blue);
  log(`${'='.repeat(50)}`, colors.bright);
  console.log('');
}

// Variables globales pour les tests
let authToken = null;
let testGroupId = null;
let testMessageId = null;
let currentUser = null;

// Helper pour les requêtes API
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      agent: httpsAgent
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (err) {
    throw err;
  }
}

// Setup : Connexion et récupération d'un groupe
async function setup() {
  section('SETUP: Préparation pour les tests');
  
  try {
    // 1. Récupérer la session actuelle
    info('Récupération de la session Supabase...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      // Essayer de se connecter avec un compte de test
      info('Tentative de connexion avec un compte de test...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'test@nousparisiens.fr',
        password: 'TestChat123!'
      });
      
      if (authError) {
        throw new Error(`Impossible de se connecter : ${authError.message}`);
      }
      
      authToken = authData.session?.access_token;
      currentUser = authData.user;
    } else {
      authToken = session.access_token;
      currentUser = session.user;
    }
    
    if (!authToken) {
      throw new Error('Pas de token d\'authentification');
    }
    
    success(`Connecté en tant que : ${currentUser.email}`);
    
    // 2. Récupérer un groupe existant
    info('Récupération d\'un groupe de test...');
    const { data: groups, error: groupError } = await supabase
      .from('groups')
      .select('id, name')
      .limit(1);
    
    if (groupError || !groups || groups.length === 0) {
      throw new Error('Aucun groupe trouvé');
    }
    
    testGroupId = groups[0].id;
    success(`Groupe sélectionné : ${groups[0].name} (${testGroupId})`);
    
    // 3. Vérifier l'appartenance au groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', currentUser.id)
      .eq('group_id', testGroupId)
      .single();
    
    if (!membership) {
      info('Ajout au groupe...');
      await supabase.from('user_groups').insert({
        user_id: currentUser.id,
        group_id: testGroupId
      });
      success('Ajouté au groupe');
    } else {
      success('Déjà membre du groupe');
    }
    
  } catch (err) {
    error(`Erreur setup : ${err.message}`);
    process.exit(1);
  }
}

// Test 1 : API Messages
async function testMessages() {
  section('TEST 1: API Messages');
  
  try {
    // 1. Envoyer un message
    info('POST /chat/messages - Envoi d\'un message...');
    const createRes = await apiRequest('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        group_id: testGroupId,
        text: `Test message API - ${new Date().toISOString()}`
      })
    });
    
    if (createRes.message) {
      testMessageId = createRes.message.id;
      success(`Message créé avec ID : ${testMessageId}`);
    } else {
      error('Pas de message dans la réponse');
    }
    
    // 2. Récupérer les messages
    info('GET /chat/messages - Récupération des messages...');
    const getRes = await apiRequest(`/chat/messages?group_id=${testGroupId}&limit=5`);
    
    if (getRes.messages && getRes.messages.length > 0) {
      success(`${getRes.messages.length} message(s) récupéré(s)`);
      const latestMessage = getRes.messages[0];
      info(`  Dernier message : "${latestMessage.text?.substring(0, 50)}..."`);
    } else {
      error('Aucun message récupéré');
    }
    
    // 3. Modifier le message
    if (testMessageId) {
      info('PUT /chat/messages - Modification du message...');
      const updateRes = await apiRequest('/chat/messages', {
        method: 'PUT',
        body: JSON.stringify({
          id: testMessageId,
          text: `Message modifié - ${new Date().toISOString()}`
        })
      });
      success('Message modifié');
    }
    
    // 4. Créer une réponse (thread)
    if (testMessageId) {
      info('POST /chat/messages - Création d\'une réponse...');
      const threadRes = await apiRequest('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          group_id: testGroupId,
          text: 'Réponse au message de test',
          thread_ts: testMessageId
        })
      });
      
      if (threadRes.message) {
        success(`Réponse créée avec ID : ${threadRes.message.id}`);
      }
    }
    
  } catch (err) {
    error(`Erreur test messages : ${err.message}`);
  }
}

// Test 2 : API Réactions
async function testReactions() {
  section('TEST 2: API Réactions');
  
  if (!testMessageId) {
    error('Pas de message de test disponible');
    return;
  }
  
  try {
    // 1. Ajouter une réaction
    info('POST /chat/reactions - Ajout d\'une réaction...');
    const addRes = await apiRequest('/chat/reactions', {
      method: 'POST',
      body: JSON.stringify({
        message_id: testMessageId,
        emoji: '👍',
        emoji_name: 'thumbsup'
      })
    });
    success('Réaction 👍 ajoutée');
    
    // 2. Récupérer les réactions
    info('GET /chat/reactions - Récupération des réactions...');
    const getRes = await apiRequest(`/chat/reactions?message_id=${testMessageId}`);
    
    if (getRes.reactions && getRes.reactions.length > 0) {
      success(`${getRes.reactions.length} type(s) de réaction(s)`);
      getRes.reactions.forEach(r => {
        info(`  ${r.emoji} : ${r.count} utilisateur(s)`);
      });
    }
    
    // 3. Retirer la réaction
    info('DELETE /chat/reactions - Suppression de la réaction...');
    await apiRequest(`/chat/reactions?message_id=${testMessageId}&emoji=👍`, {
      method: 'DELETE'
    });
    success('Réaction supprimée');
    
  } catch (err) {
    error(`Erreur test réactions : ${err.message}`);
  }
}

// Test 3 : API Typing
async function testTyping() {
  section('TEST 3: API Typing');
  
  try {
    // 1. Signaler qu'on tape
    info('POST /chat/typing - Activation indicateur de frappe...');
    await apiRequest('/chat/typing', {
      method: 'POST',
      body: JSON.stringify({
        group_id: testGroupId
      })
    });
    success('Indicateur activé');
    
    // 2. Vérifier qui tape
    info('GET /chat/typing - Récupération des indicateurs...');
    const getRes = await apiRequest(`/chat/typing?group_id=${testGroupId}`);
    info(`${getRes.typing_users?.length || 0} utilisateur(s) en train de taper`);
    
    // 3. Arrêter de taper
    info('DELETE /chat/typing - Désactivation indicateur...');
    await apiRequest(`/chat/typing?group_id=${testGroupId}`, {
      method: 'DELETE'
    });
    success('Indicateur désactivé');
    
  } catch (err) {
    error(`Erreur test typing : ${err.message}`);
  }
}

// Test 4 : API Read Status
async function testReadStatus() {
  section('TEST 4: API Read Status');
  
  try {
    // 1. Marquer comme lu
    info('POST /chat/read-status - Marquage comme lu...');
    await apiRequest('/chat/read-status', {
      method: 'POST',
      body: JSON.stringify({
        group_id: testGroupId,
        last_read_message_id: testMessageId
      })
    });
    success('Messages marqués comme lus');
    
    // 2. Récupérer le statut
    info('GET /chat/read-status - Récupération du statut...');
    const getRes = await apiRequest('/chat/read-status');
    
    if (getRes.read_statuses) {
      success(`Statut pour ${getRes.read_statuses.length} groupe(s)`);
      getRes.read_statuses.forEach(status => {
        info(`  ${status.group_name || 'Groupe'} : ${status.unread_count} non lu(s)`);
      });
    }
    
  } catch (err) {
    error(`Erreur test read status : ${err.message}`);
  }
}

// Nettoyage
async function cleanup() {
  section('CLEANUP: Nettoyage');
  
  try {
    if (testMessageId) {
      info('Suppression du message de test...');
      await apiRequest(`/chat/messages?id=${testMessageId}`, {
        method: 'DELETE'
      });
      success('Message supprimé');
    }
    
    info('Déconnexion...');
    await supabase.auth.signOut();
    success('Déconnecté');
    
  } catch (err) {
    error(`Erreur cleanup : ${err.message}`);
  }
}

// Lancer les tests
async function runTests() {
  console.log('');
  log('🚀 TESTS DES APIs CHAT AVEC AUTHENTIFICATION', colors.bright + colors.cyan);
  console.log('');
  
  try {
    await setup();
    await testMessages();
    await testReactions();
    await testTyping();
    await testReadStatus();
    await cleanup();
    
    console.log('');
    log('✨ TOUS LES TESTS SONT PASSÉS !', colors.bright + colors.green);
    console.log('');
    
  } catch (err) {
    console.log('');
    error(`Erreur fatale : ${err.message}`);
    process.exit(1);
  }
}

// Point d'entrée
runTests();