import { createClient } from '@/lib/supabase/server'

export default async function PrivacyPage() {
  const supabase = await createClient()
  
  // Récupérer l'email de support depuis les paramètres
  const { data: settings } = await supabase
    .from('settings')
    .select('setting_value')
    .eq('setting_key', 'support_email')
    .single()
  
  const supportEmail = settings?.setting_value || 'contact@nous-parisiens.fr'

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Politique de confidentialité</h1>
      
      <div className="prose prose-stone max-w-none">
        <p className="text-sm text-gray-600 mb-4">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
        
        <h2>1. Collecte des données</h2>
        <p>Nous collectons uniquement les informations nécessaires au fonctionnement du service :</p>
        <ul>
          <li>Nom et prénom</li>
          <li>Adresse email</li>
          <li>Numéro de téléphone (optionnel)</li>
          <li>Informations de profil des réseaux sociaux (si connexion OAuth)</li>
        </ul>
        
        <h2>2. Utilisation des données</h2>
        <p>Vos données sont utilisées pour :</p>
        <ul>
          <li>Créer et gérer votre compte</li>
          <li>Vous envoyer des communications relatives à la campagne</li>
          <li>Améliorer nos services</li>
        </ul>
        
        <h2>3. Protection des données</h2>
        <p>Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données personnelles.</p>
        
        <h2>4. Partage des données</h2>
        <p>Nous ne vendons, n'échangeons ni ne transférons vos données personnelles à des tiers sans votre consentement.</p>
        
        <h2>5. Vos droits</h2>
        <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.</p>
        
        <h2>6. Contact</h2>
        <p>Pour toute question : {supportEmail}</p>
      </div>
    </div>
  )
}