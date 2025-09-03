'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatMessage } from './use-native-chat'

interface CacheEntry {
  messages: ChatMessage[]
  timestamp: number
  hasMore: boolean
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_STORAGE_KEY = 'chat-messages-cache'

// Fonctions utilitaires pour le stockage
const saveToStorage = (cache: Map<string, CacheEntry>) => {
  if (typeof window === 'undefined') return
  
  try {
    const cacheObject: Record<string, CacheEntry> = {}
    cache.forEach((value, key) => {
      cacheObject[key] = value
    })
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheObject))
  } catch (error) {
    // Erreur silencieuse
  }
}

const loadFromStorage = (): Map<string, CacheEntry> => {
  if (typeof window === 'undefined') return new Map()
  
  try {
    const stored = sessionStorage.getItem(CACHE_STORAGE_KEY)
    if (!stored) return new Map()
    
    const cacheObject = JSON.parse(stored) as Record<string, CacheEntry>
    const cache = new Map<string, CacheEntry>()
    
    // Reconstruire la Map et nettoyer les entrées expirées
    Object.entries(cacheObject).forEach(([key, value]) => {
      if (Date.now() - value.timestamp <= CACHE_TTL) {
        cache.set(key, value)
      }
    })
    
    return cache
  } catch (error) {
    // Erreur silencieuse
    return new Map()
  }
}

export function useChatCache() {
  // Initialiser le cache directement avec les données de sessionStorage
  const [cache, setCache] = useState<Map<string, CacheEntry>>(() => {
    // Cette fonction ne s'exécute qu'une fois lors de l'initialisation
    if (typeof window !== 'undefined') {
      return loadFromStorage()
    }
    return new Map()
  })
  const [isInitialized, setIsInitialized] = useState(true)
  
  // Sauvegarder le cache à chaque modification
  useEffect(() => {
    saveToStorage(cache)
  }, [cache])
  
  // Mettre à jour le cache pour un groupe
  const updateCache = useCallback((groupId: string, messages: ChatMessage[], hasMore: boolean) => {
    const entry: CacheEntry = {
      messages,
      timestamp: Date.now(),
      hasMore
    }
    
    setCache(prevCache => {
      const newCache = new Map(prevCache)
      newCache.set(groupId, entry)
      return newCache
    })
  }, [])
  
  // Récupérer depuis le cache
  const getFromCache = useCallback((groupId: string): CacheEntry | null => {
    const entry = cache.get(groupId)
    if (!entry) {
      return null
    }
    
    // Vérifier si le cache est encore valide
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      setCache(prevCache => {
        const newCache = new Map(prevCache)
        newCache.delete(groupId)
        return newCache
      })
      return null
    }
    
    return entry
  }, [cache])
  
  // Invalider le cache pour un groupe
  const invalidateCache = useCallback((groupId: string) => {
    setCache(prevCache => {
      const newCache = new Map(prevCache)
      newCache.delete(groupId)
      return newCache
    })
  }, [])
  
  // Invalider tout le cache
  const clearCache = useCallback(() => {
    setCache(new Map())
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CACHE_STORAGE_KEY)
    }
  }, [])
  
  // Mettre à jour un message dans le cache
  const updateMessageInCache = useCallback((groupId: string, messageId: string, updater: (msg: ChatMessage) => ChatMessage) => {
    setCache(prevCache => {
      const entry = prevCache.get(groupId)
      if (!entry) return prevCache
      
      const updatedMessages = entry.messages.map(msg => 
        msg.id === messageId ? updater(msg) : msg
      )
      
      const newCache = new Map(prevCache)
      newCache.set(groupId, {
        ...entry,
        messages: updatedMessages
      })
      return newCache
    })
  }, [])
  
  // Ajouter un nouveau message au cache
  const addMessageToCache = useCallback((groupId: string, message: ChatMessage) => {
    setCache(prevCache => {
      const entry = prevCache.get(groupId)
      if (!entry) return prevCache
      
      // Ajouter le message au début (les messages sont triés du plus récent au plus ancien)
      const updatedMessages = [message, ...entry.messages]
      
      const newCache = new Map(prevCache)
      newCache.set(groupId, {
        ...entry,
        messages: updatedMessages
      })
      return newCache
    })
  }, [])
  
  // Supprimer un message du cache
  const removeMessageFromCache = useCallback((groupId: string, messageId: string) => {
    setCache(prevCache => {
      const entry = prevCache.get(groupId)
      if (!entry) return prevCache
      
      const updatedMessages = entry.messages.filter(msg => msg.id !== messageId)
      
      const newCache = new Map(prevCache)
      newCache.set(groupId, {
        ...entry,
        messages: updatedMessages
      })
      return newCache
    })
  }, [])
  
  return {
    cache,
    updateCache,
    getFromCache,
    invalidateCache,
    clearCache,
    updateMessageInCache,
    addMessageToCache,
    removeMessageFromCache
  }
}