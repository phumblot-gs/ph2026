# Paul Hatte 2026 - Plateforme de Campagne

Plateforme web pour la campagne de Paul Hatte aux élections municipales de Paris 2026.

## 🚀 Stack Technique

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS + Shadcn/ui (Thème Minimal Stone)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Hébergement**: Vercel
- **Analytics**: Metabase

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build pour production
npm run build
```

## 🏗 Structure du Projet

```
ph2026/
├── app/              # Pages et layouts Next.js
├── components/       # Composants React
│   └── ui/          # Composants Shadcn/ui
├── lib/             # Utilitaires et configuration
├── public/          # Assets statiques
└── DOCUMENTATION.md # Documentation technique complète
```

## 🎨 Design System

Le projet utilise le thème "Minimal Stone" avec Shadcn/ui :
- Palette minimaliste noir/blanc
- Typographie élégante avec Inter et Instrument Serif
- Composants accessibles basés sur Radix UI

## 📝 Documentation

Voir [DOCUMENTATION.md](./DOCUMENTATION.md) pour la documentation technique complète.

## 🔐 Environnement

Créer un fichier `.env.local` avec :

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📄 License

Propriétaire - Paul Hatte 2026