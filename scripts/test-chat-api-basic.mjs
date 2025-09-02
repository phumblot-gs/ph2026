#!/usr/bin/env node

/**
 * Test basique des routes API du chat (sans auth)
 */

import fetch from 'node-fetch';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const API_BASE_URL = 'https://localhost:3000/api';

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

async function testRoute(method, path, description) {
  try {
    info(`Testing ${method} ${path}...`);
    
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: method === 'POST' || method === 'PUT' ? '{}' : undefined,
      agent: httpsAgent
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      success(`${description} - Route existe (401 Auth required)`);
      return true;
    } else if (response.status === 400) {
      success(`${description} - Route existe (400 Params required)`);
      return true;
    } else if (response.status === 404) {
      error(`${description} - Route NOT FOUND`);
      return false;
    } else if (response.status === 405) {
      error(`${description} - Method not allowed`);
      return false;
    } else {
      info(`${description} - Status: ${response.status}`);
      return true;
    }
  } catch (err) {
    error(`${description} - Error: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('');
  log('🚀 TEST BASIQUE DES ROUTES API CHAT', colors.bright + colors.cyan);
  console.log('');
  
  section('TEST: Routes Messages');
  
  const messageRoutes = [
    { method: 'GET', path: '/chat/messages?group_id=test', desc: 'GET messages' },
    { method: 'POST', path: '/chat/messages', desc: 'POST message' },
    { method: 'PUT', path: '/chat/messages', desc: 'PUT message' },
    { method: 'DELETE', path: '/chat/messages?id=test', desc: 'DELETE message' }
  ];
  
  let messagesOk = 0;
  for (const route of messageRoutes) {
    if (await testRoute(route.method, route.path, route.desc)) {
      messagesOk++;
    }
  }
  
  section('TEST: Routes Réactions');
  
  const reactionRoutes = [
    { method: 'GET', path: '/chat/reactions?message_id=test', desc: 'GET reactions' },
    { method: 'POST', path: '/chat/reactions', desc: 'POST reaction' },
    { method: 'DELETE', path: '/chat/reactions?message_id=test&emoji=test', desc: 'DELETE reaction' }
  ];
  
  let reactionsOk = 0;
  for (const route of reactionRoutes) {
    if (await testRoute(route.method, route.path, route.desc)) {
      reactionsOk++;
    }
  }
  
  section('TEST: Routes Upload');
  
  const uploadRoutes = [
    { method: 'GET', path: '/chat/upload?path=test', desc: 'GET signed URL' },
    { method: 'POST', path: '/chat/upload', desc: 'POST upload file' },
    { method: 'DELETE', path: '/chat/upload?file_id=test', desc: 'DELETE file' }
  ];
  
  let uploadOk = 0;
  for (const route of uploadRoutes) {
    if (await testRoute(route.method, route.path, route.desc)) {
      uploadOk++;
    }
  }
  
  section('TEST: Routes Typing');
  
  const typingRoutes = [
    { method: 'GET', path: '/chat/typing?group_id=test', desc: 'GET typing' },
    { method: 'POST', path: '/chat/typing', desc: 'POST typing' },
    { method: 'DELETE', path: '/chat/typing?group_id=test', desc: 'DELETE typing' }
  ];
  
  let typingOk = 0;
  for (const route of typingRoutes) {
    if (await testRoute(route.method, route.path, route.desc)) {
      typingOk++;
    }
  }
  
  section('TEST: Routes Read Status');
  
  const readStatusRoutes = [
    { method: 'GET', path: '/chat/read-status', desc: 'GET read status' },
    { method: 'POST', path: '/chat/read-status', desc: 'POST read status' },
    { method: 'DELETE', path: '/chat/read-status?group_id=test', desc: 'DELETE read status' }
  ];
  
  let readStatusOk = 0;
  for (const route of readStatusRoutes) {
    if (await testRoute(route.method, route.path, route.desc)) {
      readStatusOk++;
    }
  }
  
  section('RÉSUMÉ');
  
  console.log('');
  log('📊 Résultats des tests :', colors.bright);
  console.log('');
  info(`Messages    : ${messagesOk}/4 routes OK`);
  info(`Réactions   : ${reactionsOk}/3 routes OK`);
  info(`Upload      : ${uploadOk}/3 routes OK`);
  info(`Typing      : ${typingOk}/3 routes OK`);
  info(`Read Status : ${readStatusOk}/3 routes OK`);
  console.log('');
  
  const total = messagesOk + reactionsOk + uploadOk + typingOk + readStatusOk;
  const expected = 16;
  
  if (total === expected) {
    log('✨ TOUTES LES ROUTES SONT ACCESSIBLES !', colors.bright + colors.green);
  } else {
    log(`⚠️  ${total}/${expected} routes accessibles`, colors.yellow);
  }
  console.log('');
}

runTests();