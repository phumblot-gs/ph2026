// Configuration centralisée de l'application
export const config = {
  // Informations du parti (modifiables via variables d'environnement)
  party: {
    name: process.env.NEXT_PUBLIC_PARTY_NAME || 'PH2026',
    slogan: 'Pour un Paris qui nous ressemble',
    candidate: process.env.NEXT_PUBLIC_CANDIDATE_NAME || 'Paul Hatte',
  },
  
  // URLs
  site: {
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  },
  
  // Supabase
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  
  // Réseaux sociaux (à configurer plus tard)
  social: {
    twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE,
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE,
    youtube: process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL,
  },
}