#!/usr/bin/env node

/**
 * Script pour tester le cron job de synchronisation Slack en local
 * Usage: node scripts/test-slack-cron.js
 */

async function testSlackCron() {
  try {
    console.log('🔄 Test du cron job de synchronisation Slack...')
    console.log('----------------------------------------')
    
    // Faire une requête POST à l'endpoint (autorisé en dev)
    const response = await fetch('https://localhost:3001/api/cron/sync-slack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Ignorer les erreurs de certificat SSL en local
      ...(process.env.NODE_ENV === 'development' && {
        agent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })
    })
    
    if (!response.ok) {
      console.error('❌ Erreur:', response.status, response.statusText)
      const error = await response.text()
      console.error('Détails:', error)
      return
    }
    
    const result = await response.json()
    
    console.log('✅ Synchronisation terminée avec succès!')
    console.log('----------------------------------------')
    console.log(`📊 Total synchronisé: ${result.totalSynced} messages`)
    console.log(`⏱️  Durée: ${result.duration}ms`)
    console.log(`📅 Timestamp: ${result.timestamp}`)
    
    if (result.results && result.results.length > 0) {
      console.log('\n📋 Résultats par groupe:')
      result.results.forEach(r => {
        if (r.error) {
          console.log(`  ❌ ${r.group}: Erreur - ${r.error}`)
        } else {
          console.log(`  ✅ ${r.group}: ${r.synced} messages`)
        }
      })
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Exécuter le test
testSlackCron()