import { slackBotClient, createUserSlackClient } from './client';
import type { SlackChannel, SlackMessage } from './client';

/**
 * Créer un canal Slack privé
 */
export async function createSlackChannel(name: string, isPrivate: boolean = true): Promise<string | null> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return null;
  }

  try {
    const result = await slackBotClient.conversations.create({
      name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), // Slack exige des noms en minuscules
      is_private: isPrivate,
    });

    if (result.ok && result.channel) {
      return result.channel.id!;
    }
    return null;
  } catch (error: any) {
    console.error('Error creating Slack channel:', error);
    if (error.data?.error === 'name_taken') {
      // Le canal existe déjà, essayer de le récupérer
      const channels = await listSlackChannels();
      const existing = channels.find(c => c.name === name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      return existing?.id || null;
    }
    return null;
  }
}

/**
 * Supprimer (archiver) un canal Slack
 */
export async function archiveSlackChannel(channelId: string): Promise<boolean> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return false;
  }

  try {
    const result = await slackBotClient.conversations.archive({
      channel: channelId,
    });
    return result.ok || false;
  } catch (error) {
    console.error('Error archiving Slack channel:', error);
    return false;
  }
}

/**
 * Désarchiver un canal Slack
 */
export async function unarchiveSlackChannel(channelId: string): Promise<boolean> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return false;
  }

  try {
    const result = await slackBotClient.conversations.unarchive({
      channel: channelId,
    });
    console.log(`Channel ${channelId} unarchived successfully`);
    return result.ok || false;
  } catch (error: any) {
    console.error('Error unarchiving channel:', error.data || error);
    return false;
  }
}

/**
 * Ajouter un utilisateur à un canal
 */
export async function addUserToChannel(channelId: string, userId: string): Promise<boolean> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return false;
  }

  try {
    console.log(`Attempting to add user ${userId} to channel ${channelId}`);
    
    // D'abord vérifier que le bot est bien dans le canal (nécessaire pour les canaux privés)
    const channelInfo = await slackBotClient.conversations.info({
      channel: channelId,
    });
    
    if (!channelInfo.ok) {
      console.error('Cannot access channel:', channelId);
      // Essayer de rejoindre le canal d'abord
      try {
        await slackBotClient.conversations.join({
          channel: channelId,
        });
        console.log('Bot joined channel:', channelId);
      } catch (joinError) {
        console.error('Bot cannot join channel:', joinError);
      }
    } else if (channelInfo.channel?.is_archived) {
      console.log(`Channel ${channelId} is archived, unarchiving...`);
      const unarchived = await unarchiveSlackChannel(channelId);
      if (!unarchived) {
        console.error('Failed to unarchive channel');
        return false;
      }
    }
    
    const result = await slackBotClient.conversations.invite({
      channel: channelId,
      users: userId,
    });
    
    console.log(`Successfully added user ${userId} to channel ${channelId}`);
    return result.ok || false;
  } catch (error: any) {
    if (error.data?.error === 'already_in_channel') {
      console.log(`User ${userId} already in channel ${channelId}`);
      return true; // L'utilisateur est déjà dans le canal
    }
    if (error.data?.error === 'is_archived') {
      console.log(`Channel ${channelId} is archived, attempting to unarchive...`);
      const unarchived = await unarchiveSlackChannel(channelId);
      if (unarchived) {
        // Réessayer après désarchivage
        try {
          const result = await slackBotClient.conversations.invite({
            channel: channelId,
            users: userId,
          });
          return result.ok || false;
        } catch (retryError: any) {
          console.error('Error adding user after unarchive:', retryError.data || retryError);
        }
      }
    }
    console.error('Error adding user to channel:', error.data || error);
    return false;
  }
}

/**
 * Retirer un utilisateur d'un canal
 */
export async function removeUserFromChannel(channelId: string, userId: string): Promise<boolean> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return false;
  }

  try {
    const result = await slackBotClient.conversations.kick({
      channel: channelId,
      user: userId,
    });
    return result.ok || false;
  } catch (error) {
    console.error('Error removing user from channel:', error);
    return false;
  }
}

/**
 * Lister tous les canaux
 */
export async function listSlackChannels(): Promise<SlackChannel[]> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return [];
  }

  try {
    const result = await slackBotClient.conversations.list({
      types: 'public_channel,private_channel',
      limit: 1000,
    });

    if (result.ok && result.channels) {
      return result.channels as SlackChannel[];
    }
    return [];
  } catch (error) {
    console.error('Error listing Slack channels:', error);
    return [];
  }
}

/**
 * Obtenir les messages récents d'un canal
 */
export async function getChannelMessages(
  channelId: string, 
  limit: number = 5,
  userToken?: string
): Promise<SlackMessage[]> {
  const client = userToken ? createUserSlackClient(userToken) : slackBotClient;
  
  if (!client) {
    console.error('Slack client not available');
    return [];
  }

  try {
    const result = await client.conversations.history({
      channel: channelId,
      limit,
    });

    if (result.ok && result.messages) {
      // Enrichir avec les infos utilisateur
      const messages = result.messages as SlackMessage[];
      const userIds = [...new Set(messages.map(m => m.user).filter(Boolean))];
      
      // Récupérer les infos des utilisateurs
      const userInfos = await Promise.all(
        userIds.map(async (userId) => {
          try {
            const userResult = await client.users.info({ user: userId });
            return userResult.user;
          } catch {
            return null;
          }
        })
      );

      // Mapper les infos utilisateur aux messages avec le bon format
      return messages.map(msg => {
        const userInfo = userInfos.find(u => u?.id === msg.user);
        return {
          ...msg,
          user_profile: userInfo ? {
            name: userInfo.name || '',
            real_name: userInfo.real_name || userInfo.name || '',
            image_48: (userInfo.profile as any)?.image_48 || ''
          } : undefined,
        };
      });
    }
    return [];
  } catch (error) {
    console.error('Error getting channel messages:', error);
    return [];
  }
}

/**
 * Obtenir les informations d'un utilisateur Slack par email
 */
export async function getSlackUserByEmail(email: string): Promise<string | null> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return null;
  }

  try {
    const result = await slackBotClient.users.lookupByEmail({
      email,
    });

    if (result.ok && result.user) {
      return result.user.id!;
    }
    return null;
  } catch (error) {
    console.error('Error finding Slack user by email:', error);
    return null;
  }
}

/**
 * Vérifier si un canal existe
 */
export async function checkChannelExists(channelId: string): Promise<boolean> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return false;
  }

  try {
    const result = await slackBotClient.conversations.info({
      channel: channelId,
    });
    return result.ok || false;
  } catch (error) {
    return false;
  }
}

/**
 * Envoyer un message dans un canal
 */
export async function sendMessageToChannel(
  channelId: string, 
  text: string,
  blocks?: any[]
): Promise<boolean> {
  if (!slackBotClient) {
    console.error('Slack not configured');
    return false;
  }

  try {
    const result = await slackBotClient.chat.postMessage({
      channel: channelId,
      text,
      blocks,
    });
    return result.ok || false;
  } catch (error) {
    console.error('Error sending message to channel:', error);
    return false;
  }
}

/**
 * Formater le nom d'un canal pour Slack
 */
export function formatChannelName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
    .replace(/[^a-z0-9-]/g, '-') // Remplacer les caractères spéciaux
    .replace(/-+/g, '-') // Éviter les tirets multiples
    .replace(/^-|-$/g, '') // Retirer les tirets au début/fin
    .slice(0, 80); // Limite Slack de 80 caractères
}