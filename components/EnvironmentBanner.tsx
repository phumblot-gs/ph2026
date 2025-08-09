'use client'

import { useEffect, useState } from 'react'

export default function EnvironmentBanner() {
  const [env, setEnv] = useState<string>('')

  useEffect(() => {
    // Récupérer l'environnement depuis la variable d'environnement
    const environment = process.env.NEXT_PUBLIC_ENV || 'development'
    setEnv(environment)
  }, [])

  // Ne pas afficher le bandeau en production
  if (!env || env === 'production') {
    return null
  }

  const getEnvInfo = () => {
    switch (env) {
      case 'test':
        return {
          text: 'ENVIRONNEMENT DE TEST',
          bgColor: 'bg-orange-600',
        }
      case 'development':
      case 'dev':
        return {
          text: 'ENVIRONNEMENT DE DÉVELOPPEMENT',
          bgColor: 'bg-red-600',
        }
      default:
        return {
          text: `ENVIRONNEMENT: ${env.toUpperCase()}`,
          bgColor: 'bg-purple-600',
        }
    }
  }

  const { text, bgColor } = getEnvInfo()

  return (
    <div className={`${bgColor} text-white text-xs font-bold text-center py-1 px-2 fixed top-0 left-0 right-0 z-[9999] shadow-md`}>
      <span>{text}</span>
    </div>
  )
}