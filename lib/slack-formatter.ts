/**
 * Formats Slack messages to HTML/React-friendly content
 */

import { SLACK_EMOJI_MAP } from './slack-emoji-map'

/**
 * Convert Slack emoji codes to actual emojis
 */
export function parseEmojis(text: string): string {
  return text.replace(/:[\w_+-]+:/g, (match) => {
    return SLACK_EMOJI_MAP[match] || match
  })
}

/**
 * Parse Slack markdown formatting
 */
export function parseSlackMarkdown(text: string): string {
  let formatted = text
  
  // Parse user mentions <@U123456> to @username
  formatted = formatted.replace(/<@(U[A-Z0-9]+)(\|([^>]+))?>/g, (match, userId, pipe, username) => {
    return `@${username || userId}`
  })
  
  // Parse channel mentions <#C123456|channel-name> to #channel-name
  formatted = formatted.replace(/<#(C[A-Z0-9]+)\|([^>]+)>/g, (match, channelId, channelName) => {
    return `#${channelName}`
  })
  
  // Parse URLs <http://example.com|text> to clickable links (Slack format)
  // Les liens doivent s'ouvrir dans un nouvel onglet
  formatted = formatted.replace(/<(https?:\/\/[^|>]+)(\|([^>]+))?>/g, (match, url, pipe, text) => {
    const displayText = text || url
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">${displayText}</a>`
  })
  
  // Parse Markdown links [text](url) to clickable links
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    // Ajouter https:// si l'URL ne commence pas par http:// ou https://
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">${text}</a>`
  })
  
  // Parse code blocks FIRST (before other formatting) ```text```
  formatted = formatted.replace(/```([^`]+)```/g, '<pre class="bg-gray-100 p-2 rounded my-1 overflow-x-auto"><code>$1</code></pre>')
  
  // Parse inline code `text` (Slack uses ` for inline code)
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
  
  // Parse bold **text** (Markdown standard) FIRST, then *text* (Slack format)
  formatted = formatted.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/\*([^*]+?)\*/g, '<strong>$1</strong>')
  
  // Parse italic _text_ (both Markdown and Slack use _)
  formatted = formatted.replace(/_([^_]+?)_/g, '<em>$1</em>')
  
  // Parse strikethrough ~~text~~ (Markdown) FIRST, then ~text~ (Slack)
  formatted = formatted.replace(/~~([^~]+?)~~/g, '<del>$1</del>')
  formatted = formatted.replace(/~([^~]+?)~/g, '<del>$1</del>')
  
  // Parse blockquotes > text (Slack uses > for quotes)
  formatted = formatted.replace(/^&gt;\s(.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 my-2 italic">$1</blockquote>')
  
  // Convertir les listes à puces et numérotées
  const lines = formatted.split('\n')
  const processedLines = []
  let inList = false
  let listType = null // 'ul' ou 'ol'
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // Détecter les différents formats de listes
    const isBullet = trimmedLine.startsWith('•') || trimmedLine.startsWith('*') || trimmedLine.startsWith('-')
    const isNumbered = /^\d+[\.)]\s/.test(trimmedLine)
    
    if (isBullet || isNumbered) {
      const currentType = isBullet ? 'ul' : 'ol'
      
      // Si on change de type de liste, fermer l'ancienne
      if (inList && listType !== currentType) {
        processedLines.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
      }
      
      // Ouvrir une nouvelle liste si nécessaire
      if (!inList) {
        listType = currentType
        processedLines.push(listType === 'ul' ? '<ul class="list-disc list-inside my-1">' : '<ol class="list-decimal list-inside my-1">')
        inList = true
      }
      
      // Extraire le contenu de l'élément de liste
      let content = trimmedLine
      if (isBullet) {
        content = content.replace(/^[•*-]\s*/, '')
      } else {
        content = content.replace(/^\d+[\.)]\s*/, '')
      }
      
      processedLines.push(`<li>${content}</li>`)
      
      // Vérifier si la ligne suivante continue la liste
      const nextLine = lines[i + 1]
      if (nextLine !== undefined) {
        const nextTrimmed = nextLine.trim()
        const nextIsBullet = nextTrimmed.startsWith('•') || nextTrimmed.startsWith('*') || nextTrimmed.startsWith('-')
        const nextIsNumbered = /^\d+[\.)]\s/.test(nextTrimmed)
        
        if (!nextIsBullet && !nextIsNumbered) {
          // Fin de la liste
          processedLines.push(listType === 'ul' ? '</ul>' : '</ol>')
          inList = false
          listType = null
        }
      } else {
        // Dernière ligne du message
        processedLines.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
        listType = null
      }
    } else {
      // Ligne normale
      if (inList) {
        processedLines.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
        listType = null
      }
      processedLines.push(line)
    }
  }
  
  // Fermer la liste si elle est encore ouverte
  if (inList) {
    processedLines.push(listType === 'ul' ? '</ul>' : '</ol>')
  }
  
  formatted = processedLines.join('\n')
  
  // Convertir les retours à la ligne en <br>
  // Mais pas à l'intérieur des balises HTML et pas entre les éléments de liste
  formatted = formatted.split('\n').map((line, index, array) => {
    // Ne pas ajouter de <br> si:
    // - La ligne est une balise ouvrante ou fermante de liste
    // - La ligne précédente est une balise fermante de liste
    // - La ligne suivante est une balise ouvrante de liste
    const isListTag = /^<\/?[uo]l/.test(line)
    const isListItem = /^<li>/.test(line)
    const prevIsClosingList = index > 0 && /^<\/[uo]l>/.test(array[index - 1])
    const nextIsOpeningList = index < array.length - 1 && /^<[uo]l/.test(array[index + 1])
    
    if (isListTag || isListItem || prevIsClosingList || nextIsOpeningList) {
      return line
    }
    
    // Pour les autres lignes, ajouter <br> sauf pour la dernière ligne
    return index < array.length - 1 ? line + '<br>' : line
  }).join('')
  
  // Nettoyer les entités HTML indésirables
  formatted = formatted.replace(/&#32;/g, ' ') // Remplacer les espaces encodés
  formatted = formatted.replace(/&nbsp;/g, ' ') // Remplacer les espaces insécables
  
  return formatted
}

/**
 * Extract signature from message and return clean text and author info
 */
export function extractMessageSignature(text: string): { 
  cleanText: string
  authorSlackId: string | null 
} {
  if (!text) return { cleanText: '', authorSlackId: null }
  
  // Pattern to match signature at the beginning or end of message
  // Beginning format: _Envoyé par PRENOM NOM (slack_user_id)_\n
  // Beginning format alt: Envoyé par PRENOM NOM • slack_user_id\n
  // Beginning format alt2: _Envoyé par • slack_user_id_\n
  // End format (old): -- Envoyé par PRENOM NOM (slack_user_id)
  // End format (new): _― Envoyé par PRENOM NOM (slack_user_id)_
  
  // Try beginning of message first (new format with parentheses or bullet)
  // Pattern plus flexible qui gère les espaces autour du bullet/parenthèse
  const beginningPattern = /^_?Envoyé par .*?[•(]\s*(U[A-Z0-9]+)\s*[)•]?_?\n/
  let match = text.match(beginningPattern)
  
  if (match) {
    return {
      cleanText: text.replace(beginningPattern, '').trim(),
      authorSlackId: match[1]
    }
  }
  
  // Try end of message (backward compatibility)
  const endPattern = /\n(?:--|_―) Envoyé par .+ \((U[A-Z0-9]+)\)_?$/
  match = text.match(endPattern)
  
  if (match) {
    return {
      cleanText: text.replace(endPattern, '').trim(),
      authorSlackId: match[1]
    }
  }
  
  return {
    cleanText: text,
    authorSlackId: null
  }
}

/**
 * Main function to format Slack messages
 */
export function formatSlackMessage(text: string, removeSignature: boolean = true): string {
  if (!text) return ''
  
  let cleanText = text
  
  // Remove signature if needed
  if (removeSignature) {
    const { cleanText: extracted } = extractMessageSignature(text)
    cleanText = extracted
  }
  
  // First parse emojis
  let formatted = parseEmojis(cleanText)
  
  // Then parse markdown
  formatted = parseSlackMarkdown(formatted)
  
  return formatted
}

/**
 * Format Slack message for preview (plain text, truncated)
 */
export function formatSlackMessagePreview(text: string, maxLength: number = 100): string {
  if (!text) return ''
  
  // Remove signature first
  const { cleanText } = extractMessageSignature(text)
  
  // Parse emojis
  let formatted = parseEmojis(cleanText)
  
  // Remove markdown formatting for preview
  formatted = formatted.replace(/<@(U[A-Z0-9]+)(\|([^>]+))?>/g, (match, userId, pipe, username) => {
    return `@${username || userId}`
  })
  
  formatted = formatted.replace(/<#(C[A-Z0-9]+)\|([^>]+)>/g, (match, channelId, channelName) => {
    return `#${channelName}`
  })
  
  formatted = formatted.replace(/<(https?:\/\/[^|>]+)(\|([^>]+))?>/g, (match, url, pipe, text) => {
    return text || url
  })
  
  // Remove formatting characters
  formatted = formatted.replace(/[*_~`]/g, '')
  
  // Truncate if necessary
  if (formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength) + '...'
  }
  
  return formatted
}

/**
 * Convert markdown text to Slack-compatible mrkdwn format
 */
export function markdownToSlack(markdown: string): string {
  if (!markdown) return ''
  
  let slackFormat = markdown
  
  // Convert links FIRST to avoid conflicts: [text](url) -> <url|text>
  slackFormat = slackFormat.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    // Ajouter https:// si l'URL ne commence pas par http:// ou https://
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    return `<${fullUrl}|${text}>`
  })
  
  // Convert strikethrough FIRST: ~~text~~ -> ~text~
  slackFormat = slackFormat.replace(/~~([^~]+?)~~/g, '~$1~')
  
  // Convert bold: **text** or __text__ -> *text* (Slack format for bold)
  slackFormat = slackFormat.replace(/\*\*([^*]+?)\*\*/g, '*$1*')
  slackFormat = slackFormat.replace(/__([^_]+?)__/g, '*$1*')
  
  // Convert italic: _text_ -> _text_ (same in both Markdown and Slack)
  // Single underscores are the same format in both Markdown and Slack for italic
  
  // Convert code blocks: ```code``` -> ```code``` (same format)
  // Already compatible
  
  // Convert inline code: `code` -> `code` (same format)
  // Already compatible
  
  // Convert blockquotes: > text -> > text (same format)
  // Already compatible
  
  // Convert lists: - item or * item -> • item
  slackFormat = slackFormat.replace(/^[\s]*[-*]\s+(.+)$/gm, '• $1')
  
  // Convert numbered lists: 1. item -> 1. item (same format)
  // Already compatible
  
  return slackFormat
}