/**
 * Utilitaires pour le tri des messages avec support des threads
 */

export interface MessageForSorting {
  id: string
  created_at: string
  thread_ts?: string | null
}

/**
 * Trie les messages en respectant la logique des threads :
 * 1. Les messages principaux sont triés par date (plus récent en premier)
 * 2. Les réponses apparaissent immédiatement après leur message parent
 * 3. Les réponses sont triées chronologiquement (plus ancien en premier)
 */
export function sortMessagesWithThreads<T extends MessageForSorting>(messages: T[]): T[] {
  // Séparer les messages principaux et les réponses
  const mainMessages: T[] = []
  const replies: T[] = []
  
  for (const message of messages) {
    if (message.thread_ts) {
      replies.push(message)
    } else {
      mainMessages.push(message)
    }
  }
  
  // Trier les messages principaux par date (plus récent en premier)
  mainMessages.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  
  // Grouper les réponses par message parent
  const repliesByParent = new Map<string, T[]>()
  for (const reply of replies) {
    if (!reply.thread_ts) continue
    
    if (!repliesByParent.has(reply.thread_ts)) {
      repliesByParent.set(reply.thread_ts, [])
    }
    repliesByParent.get(reply.thread_ts)!.push(reply)
  }
  
  // Trier les réponses de chaque thread chronologiquement (plus ancien en premier)
  for (const threadReplies of repliesByParent.values()) {
    threadReplies.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }
  
  // Construire le résultat final
  const result: T[] = []
  
  for (const mainMessage of mainMessages) {
    // Ajouter le message principal
    result.push(mainMessage)
    
    // Ajouter ses réponses s'il en a
    const threadReplies = repliesByParent.get(mainMessage.id)
    if (threadReplies) {
      result.push(...threadReplies)
    }
  }
  
  return result
}