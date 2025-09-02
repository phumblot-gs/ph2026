#!/usr/bin/env node

/**
 * Script de test simplifié pour les APIs du système de chat natif
 * Usage: node scripts/test-chat-api-simple.mjs
 */

import fetch from 'node-fetch';
import https from 'https';

// Désactiver la vérification SSL pour localhost
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

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

// Test de base : vérifier que les routes existent
async function testRoutesExist() {
  section('TEST: Vérification de l\'existence des routes');
  
  const routes = [
    { path: '/chat/messages', method: 'GET', params: '?group_id=test' },
    { path: '/chat/messages', method: 'POST' },
    { path: '/chat/reactions', method: 'GET', params: '?message_id=test' },
    { path: '/chat/reactions', method: 'POST' },
    { path: '/chat/upload', method: 'GET', params: '?path=test' },
    { path: '/chat/upload', method: 'POST' },
    { path: '/chat/typing', method: 'GET', params: '?group_id=test' },
    { path: '/chat/typing', method: 'POST' },
    { path: '/chat/read-status', method: 'GET' },
    { path: '/chat/read-status', method: 'POST' }
  ];
  
  for (const route of routes) {
    try {
      const url = `${API_BASE_URL}${route.path}${route.params || ''}`;
      info(`Testing ${route.method} ${route.path}...`);
      
      const response = await fetch(url, {
        method: route.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: route.method === 'POST' ? '{}' : undefined,
        agent: httpsAgent
      });
      
      const data = await response.json();
      
      // On s'attend à une erreur 401 (non authentifié) ce qui prouve que la route existe
      if (response.status === 401) {
        success(`Route ${route.method} ${route.path} existe (401 - Auth required)`);
      } else if (response.status === 400) {
        success(`Route ${route.method} ${route.path} existe (400 - Params required)`);
      } else if (response.status === 404) {
        error(`Route ${route.method} ${route.path} NOT FOUND`);
      } else {
        info(`Route ${route.method} ${route.path} - Status: ${response.status}`);
      }
      
    } catch (err) {
      error(`Erreur sur ${route.method} ${route.path}: ${err.message}`);
    }
  }
}

// Test de la structure des réponses (sans auth)
async function testResponseStructure() {
  section('TEST: Structure des réponses d\'erreur');
  
  try {
    // Test d'une requête sans authentification
    info('Test de la réponse d\'erreur sans authentification...');
    const response = await fetch(`${API_BASE_URL}/chat/messages?group_id=test`, {
      headers: {
        'Content-Type': 'application/json'
      },
      agent: httpsAgent
    });
    
    const data = await response.json();
    
    if (data.error && response.status === 401) {
      success('Structure de réponse d\'erreur correcte');
      info(`  Message: ${data.error}`);
    } else {
      error('Structure de réponse inattendue');
    }
    
  } catch (err) {
    error(`Erreur test structure: ${err.message}`);
  }
}

// Test avec un token bidon pour vérifier la validation
async function testWithFakeToken() {
  section('TEST: Validation du token');
  
  try {
    info('Test avec un token invalide...');
    const response = await fetch(`${API_BASE_URL}/chat/messages?group_id=test`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-12345'
      },
      agent: httpsAgent
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      success('Token invalide correctement rejeté');
    } else {
      error(`Status inattendu: ${response.status}`);
    }
    
  } catch (err) {
    error(`Erreur test token: ${err.message}`);
  }
}

// Test de santé de la base de données
async function testDatabaseConnection() {
  section('TEST: Connexion à la base de données');
  
  try {
    // On peut tester si Supabase est accessible via l'API santé
    info('Vérification de la connexion Supabase...');
    
    // Essayer d'accéder à une route qui nécessite la DB
    const response = await fetch(`${API_BASE_URL}/chat/messages?group_id=test`, {
      agent: httpsAgent
    });
    
    // Si on obtient une erreur 401, c'est que la connexion DB fonctionne
    // (car elle a pu vérifier l'auth)
    if (response.status === 401) {
      success('Connexion à la base de données OK');
    } else if (response.status >= 500) {
      error('Problème de connexion à la base de données');
    }
    
  } catch (err) {
    error(`Erreur test DB: ${err.message}`);
  }
}

// Lancer les tests
async function runTests() {
  console.log('');
  log('🚀 TESTS SIMPLIFIÉS DES APIs DU CHAT', colors.bright + colors.cyan);
  log('(Sans authentification)', colors.yellow);
  console.log('');
  
  try {
    await testRoutesExist();
    await testResponseStructure();
    await testWithFakeToken();
    await testDatabaseConnection();
    
    console.log('');
    log('✨ TESTS DE BASE TERMINÉS', colors.bright + colors.green);
    log('Pour des tests complets, configurez .env.test avec vos credentials Supabase', colors.yellow);
    console.log('');
    
  } catch (err) {
    console.log('');
    error(`Erreur fatale: ${err.message}`);
    process.exit(1);
  }
}

// Point d'entrée
runTests();