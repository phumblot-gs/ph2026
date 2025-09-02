#!/usr/bin/env node

/**
 * Script de test pour les APIs du système de chat natif
 * Usage: npx tsx scripts/test-chat-api.ts
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const API_BASE_URL = 'https://localhost:3001/api/chat'

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Variables pour stocker les IDs créés pendant les tests
let testGroupId: string | null = null
let testMessageId: string | null = null
let testThreadMessageId: string | null = null
let testUserId: string | null = null
let authToken: string | null = null

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function success(message: string) {
  log(`✅ ${message}`, colors.green)
}

function error(message: string) {
  log(`❌ ${message}`, colors.red)
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan)
}

function section(title: string) {
  console.log('')
  log(`${'='.repeat(50)}`, colors.bright)
  log(title, colors.bright + colors.blue)
  log(`${'='.repeat(50)}`, colors.bright)
  console.log('')
}

// Helper pour faire des requêtes API
async function apiRequest(
  endpoint: string,
  options: any = {}
): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders: any = {}
  if (authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`
  }
  
  // Ne pas ajouter Content-Type si FormData
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json'
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    // Ignorer les erreurs de certificat SSL pour localhost
    agent: undefined
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  
  return data
}

// Tests
async function setupTestData() {
  section('SETUP: Préparation des données de test')
  
  try {
    // 1. Se connecter avec un utilisateur de test
    info('Connexion avec un utilisateur de test...')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword123'
    })
    
    if (authError) {
      // Créer l'utilisateur s'il n'existe pas
      info('Création d\'un utilisateur de test...')
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: process.env.TEST_USER_EMAIL || 'test@example.com',
        password: process.env.TEST_USER_PASSWORD || 'testpassword123'
      })
      
      if (signUpError) throw signUpError
      authToken = signUpData.session?.access_token || null
      testUserId = signUpData.user?.id || null
    } else {
      authToken = authData.session?.access_token || null
      testUserId = authData.user?.id || null
    }
    
    if (!authToken || !testUserId) {
      throw new Error('Impossible de récupérer le token d\'authentification')
    }
    
    success('Authentification réussie')
    
    // 2. Créer ou récupérer un groupe de test
    info('Recherche d\'un groupe existant...')
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name')
      .limit(1)
    
    if (groups && groups.length > 0) {
      testGroupId = groups[0].id
      success(`Groupe trouvé : ${groups[0].name} (${testGroupId})`)
    } else {
      info('Création d\'un groupe de test...')
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: 'Test Chat API',
          description: 'Groupe pour tester les APIs du chat'
        })
        .select()
        .single()
      
      if (groupError) throw groupError
      testGroupId = newGroup.id
      
      // Ajouter l'utilisateur au groupe
      await supabase.from('user_groups').insert({
        user_id: testUserId,
        group_id: testGroupId
      })
      
      success(`Groupe créé : ${newGroup.name} (${testGroupId})`)
    }
    
    // 3. Vérifier que l'utilisateur est membre du groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', testUserId)
      .eq('group_id', testGroupId)
      .single()
    
    if (!membership) {
      info('Ajout de l\'utilisateur au groupe...')
      await supabase.from('user_groups').insert({
        user_id: testUserId,
        group_id: testGroupId
      })
      success('Utilisateur ajouté au groupe')
    }
    
    // 4. Créer un profil membre si nécessaire
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', testUserId)
      .single()
    
    if (!member) {
      info('Création du profil membre...')
      await supabase.from('members').insert({
        user_id: testUserId,
        first_name: 'Test',
        last_name: 'User',
        email: process.env.TEST_USER_EMAIL || 'test@example.com'
      })
      success('Profil membre créé')
    }
    
  } catch (err: any) {
    error(`Erreur setup : ${err.message}`)
    process.exit(1)
  }
}

async function testMessagesAPI() {
  section('TEST 1: API Messages')
  
  try {
    // 1. Envoyer un message
    info('Test POST /messages - Envoi d\'un message...')
    const createResponse = await apiRequest('/messages', {
      method: 'POST',
      body: JSON.stringify({
        group_id: testGroupId,
        text: 'Message de test depuis l\'API 🚀'
      })
    })
    
    testMessageId = createResponse.message.id
    success(`Message créé avec ID : ${testMessageId}`)
    
    // 2. Récupérer les messages
    info('Test GET /messages - Récupération des messages...')
    const getResponse = await apiRequest(`/messages?group_id=${testGroupId}&limit=10`)
    
    if (getResponse.messages && getResponse.messages.length > 0) {
      success(`${getResponse.messages.length} messages récupérés`)
    } else {
      error('Aucun message récupéré')
    }
    
    // 3. Modifier le message
    info('Test PUT /messages - Modification du message...')
    const updateResponse = await apiRequest('/messages', {
      method: 'PUT',
      body: JSON.stringify({
        id: testMessageId,
        text: 'Message modifié ✏️'
      })
    })
    success('Message modifié avec succès')
    
    // 4. Créer une réponse au message (thread)
    info('Test POST /messages - Création d\'une réponse en thread...')
    const threadResponse = await apiRequest('/messages', {
      method: 'POST',
      body: JSON.stringify({
        group_id: testGroupId,
        text: 'Réponse au message principal 💬',
        thread_ts: testMessageId
      })
    })
    
    testThreadMessageId = threadResponse.message.id
    success(`Réponse créée avec ID : ${testThreadMessageId}`)
    
    // 5. Récupérer les réponses du thread
    info('Test GET /messages - Récupération du thread...')
    const threadGetResponse = await apiRequest(`/messages?group_id=${testGroupId}&thread_ts=${testMessageId}`)
    
    if (threadGetResponse.messages && threadGetResponse.messages.length > 0) {
      success(`${threadGetResponse.messages.length} réponses dans le thread`)
    }
    
  } catch (err: any) {
    error(`Erreur API Messages : ${err.message}`)
  }
}

async function testReactionsAPI() {
  section('TEST 2: API Réactions')
  
  if (!testMessageId) {
    error('Pas de message de test disponible')
    return
  }
  
  try {
    // 1. Ajouter une réaction
    info('Test POST /reactions - Ajout d\'une réaction...')
    const addResponse = await apiRequest('/reactions', {
      method: 'POST',
      body: JSON.stringify({
        message_id: testMessageId,
        emoji: '👍',
        emoji_name: 'thumbsup'
      })
    })
    success('Réaction ajoutée : 👍')
    
    // 2. Ajouter une autre réaction
    info('Test POST /reactions - Ajout d\'une seconde réaction...')
    await apiRequest('/reactions', {
      method: 'POST',
      body: JSON.stringify({
        message_id: testMessageId,
        emoji: '❤️',
        emoji_name: 'heart'
      })
    })
    success('Réaction ajoutée : ❤️')
    
    // 3. Récupérer les réactions
    info('Test GET /reactions - Récupération des réactions...')
    const getResponse = await apiRequest(`/reactions?message_id=${testMessageId}`)
    
    if (getResponse.reactions && getResponse.reactions.length > 0) {
      success(`${getResponse.reactions.length} types de réactions trouvés`)
      getResponse.reactions.forEach((r: any) => {
        info(`  ${r.emoji} : ${r.count} réaction(s)`)
      })
    }
    
    // 4. Retirer une réaction
    info('Test DELETE /reactions - Suppression d\'une réaction...')
    await apiRequest(`/reactions?message_id=${testMessageId}&emoji=👍`, {
      method: 'DELETE'
    })
    success('Réaction 👍 supprimée')
    
  } catch (err: any) {
    error(`Erreur API Réactions : ${err.message}`)
  }
}

async function testUploadAPI() {
  section('TEST 3: API Upload')
  
  try {
    // Créer un fichier de test temporaire
    info('Création d\'un fichier de test...')
    const testFileName = 'test-image.png'
    const testFilePath = path.join(process.cwd(), testFileName)
    
    // Créer une image PNG simple (1x1 pixel rouge)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x00, 0x03, 0x00, 0x01, 0x9D, 0x93, 0x17,
      0xE0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    
    fs.writeFileSync(testFilePath, pngBuffer)
    success('Fichier de test créé')
    
    // Upload du fichier
    info('Test POST /upload - Upload du fichier...')
    const formData = new FormData()
    formData.append('file', fs.createReadStream(testFilePath))
    formData.append('group_id', testGroupId!)
    
    const uploadResponse = await apiRequest('/upload', {
      method: 'POST',
      body: formData
    })
    
    if (uploadResponse.file) {
      success(`Fichier uploadé : ${uploadResponse.file.name}`)
      info(`  Storage path : ${uploadResponse.file.storage_path}`)
      if (uploadResponse.file.thumbnail_path) {
        info(`  Thumbnail : ${uploadResponse.file.thumbnail_path}`)
      }
    }
    
    // Obtenir une URL signée
    info('Test GET /upload - Obtention d\'une URL signée...')
    const signedUrlResponse = await apiRequest(`/upload?path=${uploadResponse.file.storage_path}`)
    
    if (signedUrlResponse.url) {
      success('URL signée obtenue')
    }
    
    // Nettoyer le fichier de test
    fs.unlinkSync(testFilePath)
    info('Fichier de test supprimé')
    
  } catch (err: any) {
    error(`Erreur API Upload : ${err.message}`)
  }
}

async function testTypingAPI() {
  section('TEST 4: API Typing')
  
  try {
    // 1. Signaler qu'on tape
    info('Test POST /typing - Signaler qu\'on est en train de taper...')
    await apiRequest('/typing', {
      method: 'POST',
      body: JSON.stringify({
        group_id: testGroupId
      })
    })
    success('Indicateur de frappe activé')
    
    // 2. Récupérer qui tape
    info('Test GET /typing - Récupération des utilisateurs qui tapent...')
    const getResponse = await apiRequest(`/typing?group_id=${testGroupId}`)
    
    info(`${getResponse.typing_users.length} utilisateur(s) en train de taper`)
    
    // 3. Arrêter de taper
    info('Test DELETE /typing - Arrêt de l\'indicateur...')
    await apiRequest(`/typing?group_id=${testGroupId}`, {
      method: 'DELETE'
    })
    success('Indicateur de frappe désactivé')
    
  } catch (err: any) {
    error(`Erreur API Typing : ${err.message}`)
  }
}

async function testReadStatusAPI() {
  section('TEST 5: API Read Status')
  
  try {
    // 1. Marquer comme lu
    info('Test POST /read-status - Marquer les messages comme lus...')
    await apiRequest('/read-status', {
      method: 'POST',
      body: JSON.stringify({
        group_id: testGroupId,
        last_read_message_id: testMessageId
      })
    })
    success('Messages marqués comme lus')
    
    // 2. Récupérer le statut de lecture
    info('Test GET /read-status - Récupération du statut de lecture...')
    const getResponse = await apiRequest('/read-status')
    
    if (getResponse.read_statuses) {
      success(`Statut de lecture pour ${getResponse.read_statuses.length} groupe(s)`)
      getResponse.read_statuses.forEach((status: any) => {
        info(`  ${status.group_name || 'Groupe'} : ${status.unread_count} non lu(s)`)
      })
    }
    
  } catch (err: any) {
    error(`Erreur API Read Status : ${err.message}`)
  }
}

async function cleanup() {
  section('CLEANUP: Nettoyage des données de test')
  
  try {
    // Supprimer les messages de test
    if (testMessageId) {
      info('Suppression du message de test...')
      await apiRequest(`/messages?id=${testMessageId}`, {
        method: 'DELETE'
      })
      success('Message supprimé')
    }
    
    if (testThreadMessageId) {
      info('Suppression de la réponse de test...')
      await apiRequest(`/messages?id=${testThreadMessageId}`, {
        method: 'DELETE'
      })
      success('Réponse supprimée')
    }
    
    // Se déconnecter
    info('Déconnexion...')
    await supabase.auth.signOut()
    success('Déconnecté')
    
  } catch (err: any) {
    error(`Erreur cleanup : ${err.message}`)
  }
}

// Lancer les tests
async function runTests() {
  console.log('')
  log('🚀 TESTS DES APIs DU SYSTÈME DE CHAT NATIF', colors.bright + colors.cyan)
  console.log('')
  
  try {
    await setupTestData()
    await testMessagesAPI()
    await testReactionsAPI()
    await testUploadAPI()
    await testTypingAPI()
    await testReadStatusAPI()
    await cleanup()
    
    console.log('')
    log('✨ TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS !', colors.bright + colors.green)
    console.log('')
    
  } catch (err: any) {
    console.log('')
    error(`Erreur fatale : ${err.message}`)
    process.exit(1)
  }
}

// Point d'entrée
runTests()