import { format, isToday, isYesterday, isThisYear, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Formate une date selon les règles spécifiées :
 * - Heure:minute si c'est aujourd'hui (ex: "14:25")
 * - "Hier HH:mm" si c'est hier (ex: "Hier 14:25")
 * - "Avant-hier HH:mm" si c'est avant-hier (ex: "Avant-hier 14:25")
 * - "Jour Date HH:mm" si c'est cette année (ex: "Mer. 10 sept 14:25")
 * - "Jour Date Année HH:mm" si c'est une autre année (ex: "Jeu. 10 sept 2024 14:25")
 */
export function formatMessageTimestamp(date: Date): string {
  const now = new Date()
  
  // Aujourd'hui : juste l'heure
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: fr })
  }
  
  // Hier
  if (isYesterday(date)) {
    return `Hier ${format(date, 'HH:mm', { locale: fr })}`
  }
  
  // Avant-hier (il y a 2 jours)
  const twoDaysAgo = new Date(now)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  if (isSameDay(date, twoDaysAgo)) {
    return `Avant-hier ${format(date, 'HH:mm', { locale: fr })}`
  }
  
  // Cette année : jour + date + heure
  if (isThisYear(date)) {
    return format(date, 'EEE d MMM HH:mm', { locale: fr })
  }
  
  // Autre année : jour + date + année + heure
  return format(date, 'EEE d MMM yyyy HH:mm', { locale: fr })
}

/**
 * Détermine si deux messages doivent être groupés ensemble
 * Les messages sont groupés s'ils :
 * - Sont du même utilisateur
 * - Sont envoyés dans les 5 minutes (au lieu de 60 secondes pour plus de flexibilité)
 */
export function shouldGroupMessages(
  msg1: { user_id: string; created_at: string },
  msg2: { user_id: string; created_at: string }
): boolean {
  if (!msg1 || !msg2) return false
  if (msg1.user_id !== msg2.user_id) return false
  
  // Grouper si les messages sont envoyés dans les 5 minutes
  const time1 = new Date(msg1.created_at).getTime()
  const time2 = new Date(msg2.created_at).getTime()
  const timeDiff = Math.abs(time1 - time2)
  return timeDiff < 5 * 60 * 1000 // 5 minutes
}