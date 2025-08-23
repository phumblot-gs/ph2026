import { WebClient } from '@slack/web-api';
import { InstallProvider } from '@slack/oauth';

// Configuration Slack
export const isSlackConfigured = () => {
  return !!(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_BOT_TOKEN
  );
};

// Client Slack pour les opérations bot
export const slackBotClient = isSlackConfigured() 
  ? new WebClient(process.env.SLACK_BOT_TOKEN)
  : null;

// Client Slack pour un utilisateur spécifique
export const createUserSlackClient = (accessToken: string) => {
  return new WebClient(accessToken);
};

// Provider OAuth pour l'authentification
export const slackOAuthProvider = isSlackConfigured()
  ? new InstallProvider({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      stateSecret: process.env.SLACK_SIGNING_SECRET || 'default-state-secret',
    })
  : null;

// Types pour les réponses Slack
export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  real_name?: string;
  email?: string;
  image_24?: string;
  image_48?: string;
  image_72?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member?: boolean;
  num_members?: number;
  topic?: {
    value: string;
  };
  purpose?: {
    value: string;
  };
}

export interface SlackMessage {
  user: string;
  text: string;
  ts: string;
  type: string;
  user_profile?: {
    name: string;
    real_name: string;
    image_48: string;
  };
}