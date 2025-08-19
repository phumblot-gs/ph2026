export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Conditions d'utilisation</h1>
      
      <div className="prose prose-stone max-w-none">
        <p className="text-sm text-gray-600 mb-4">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
        
        <h2>1. Acceptation des conditions</h2>
        <p>En utilisant ce site, vous acceptez les présentes conditions d'utilisation.</p>
        
        <h2>2. Description du service</h2>
        <p>PH2026 est une plateforme de mobilisation citoyenne pour la campagne municipale de Paris 2026.</p>
        
        <h2>3. Inscription</h2>
        <p>L'inscription est gratuite et ouverte à toute personne majeure. Vous vous engagez à fournir des informations exactes.</p>
        
        <h2>4. Utilisation appropriée</h2>
        <p>Vous vous engagez à :</p>
        <ul>
          <li>Respecter les autres utilisateurs</li>
          <li>Ne pas diffuser de contenu illégal ou offensant</li>
          <li>Ne pas usurper l'identité d'autrui</li>
          <li>Respecter les lois en vigueur</li>
        </ul>
        
        <h2>5. Propriété intellectuelle</h2>
        <p>Le contenu du site est protégé par le droit d'auteur. Toute reproduction non autorisée est interdite.</p>
        
        <h2>6. Responsabilité</h2>
        <p>Nous ne pouvons être tenus responsables des dommages directs ou indirects liés à l'utilisation du site.</p>
        
        <h2>7. Modification des conditions</h2>
        <p>Nous nous réservons le droit de modifier ces conditions à tout moment.</p>
        
        <h2>8. Loi applicable</h2>
        <p>Ces conditions sont régies par le droit français.</p>
        
        <h2>9. Contact</h2>
        <p>Pour toute question : contact@ph2026.fr</p>
      </div>
    </div>
  )
}