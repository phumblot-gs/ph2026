/**
 * Détection des fonctionnalités Slack disponibles
 * Permet de gérer gracieusement les limitations des workspaces gratuits
 */

import { slackBotClient } from './client';

export interface SlackFeatures {
  hasAdminScopes: boolean;
  canManageChannels: boolean;
  canReadMessages: boolean;
  canInviteUsers: boolean;
  isPaidWorkspace: boolean;
}

/**
 * Vérifier les fonctionnalités disponibles selon les permissions du bot
 */
export async function checkSlackFeatures(): Promise<SlackFeatures> {
  if (!slackBotClient) {
    return {
      hasAdminScopes: false,
      canManageChannels: false,
      canReadMessages: false,
      canInviteUsers: false,
      isPaidWorkspace: false,
    };
  }

  try {
    // Tester les permissions en appelant auth.test
    const authTest = await slackBotClient.auth.test();
    
    if (!authTest.ok) {
      throw new Error('Auth test failed');
    }

    // Vérifier les scopes disponibles
    const scopes = authTest.scopes || [];
    
    return {
      // Les scopes admin indiquent un workspace payant
      hasAdminScopes: scopes.some((s: string) => s.startsWith('admin.')),
      canManageChannels: scopes.includes('channels:manage') || scopes.includes('groups:write'),
      canReadMessages: scopes.includes('channels:history') || scopes.includes('groups:history'),
      canInviteUsers: scopes.includes('channels:manage') || scopes.includes('groups:write'),
      isPaidWorkspace: scopes.some((s: string) => s.startsWith('admin.')),
    };
  } catch (error) {
    console.error('Error checking Slack features:', error);
    
    // En cas d'erreur, on assume les permissions basiques
    return {
      hasAdminScopes: false,
      canManageChannels: true,  // On assume qu'on peut créer des canaux
      canReadMessages: true,     // On assume qu'on peut lire les messages
      canInviteUsers: true,      // On assume qu'on peut inviter
      isPaidWorkspace: false,
    };
  }
}

/**
 * Message d'avertissement pour les fonctionnalités limitées
 */
export function getFeatureLimitationMessage(feature: keyof SlackFeatures): string {
  const messages: Record<keyof SlackFeatures, string> = {
    hasAdminScopes: 'Cette fonctionnalité nécessite un workspace Slack payant avec des permissions admin.',
    canManageChannels: 'La gestion des canaux nécessite les permissions appropriées dans Slack.',
    canReadMessages: 'La lecture des messages nécessite les permissions appropriées dans Slack.',
    canInviteUsers: 'L\'invitation d\'utilisateurs nécessite les permissions appropriées dans Slack.',
    isPaidWorkspace: 'Cette fonctionnalité est disponible uniquement pour les workspaces Slack payants.',
  };
  
  return messages[feature] || 'Cette fonctionnalité n\'est pas disponible avec vos permissions actuelles.';
}

/**
 * Vérifier si une fonctionnalité spécifique est disponible
 */
export async function isFeatureAvailable(feature: keyof SlackFeatures): Promise<boolean> {
  const features = await checkSlackFeatures();
  return features[feature];
}