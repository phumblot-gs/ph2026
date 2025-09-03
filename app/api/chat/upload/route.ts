import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

// Configuration des limites
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const THUMBNAIL_WIDTH = 200
const THUMBNAIL_HEIGHT = 200

// POST /api/chat/upload - Upload de fichiers pour le chat
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    // Récupérer le FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const groupId = formData.get('group_id') as string
    
    if (!file || !groupId) {
      return NextResponse.json({ error: 'Fichier et group_id requis' }, { status: 400 })
    }
    
    // Vérifier la taille du fichier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 50MB)' }, { status: 400 })
    }
    
    // Vérifier l'appartenance au groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Générer les IDs et paths
    const fileId = crypto.randomUUID()
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    const storagePath = `${groupId}/${yearMonth}/${fileId}_${safeFileName}`
    
    // Convertir le fichier en ArrayBuffer puis en Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload du fichier principal
    const { error: uploadError } = await supabase.storage
      .from('chat')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      })
    
    if (uploadError) {
      console.error('Erreur upload fichier:', uploadError)
      return NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 })
    }
    
    // Préparer les métadonnées du fichier
    const fileMetadata: any = {
      id: fileId,
      name: safeFileName,
      original_name: file.name,
      mimetype: file.type,
      size: file.size,
      storage_path: storagePath
    }
    
    // Si c'est une image, créer un thumbnail et récupérer les dimensions
    if (file.type.startsWith('image/')) {
      try {
        const image = sharp(buffer)
        const metadata = await image.metadata()
        
        fileMetadata.width = metadata.width
        fileMetadata.height = metadata.height
        
        // Créer le thumbnail
        const thumbnailBuffer = await image
          .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 80 })
          .toBuffer()
        
        const thumbnailPath = `${groupId}/${yearMonth}/thumbnails/${fileId}_thumb.jpg`
        
        // Upload du thumbnail
        await supabase.storage
          .from('chat')
          .upload(thumbnailPath, thumbnailBuffer, {
            contentType: 'image/jpeg',
            upsert: false
          })
        
        fileMetadata.thumbnail_path = thumbnailPath
      } catch (err) {
        console.error('Erreur création thumbnail:', err)
        // Continue sans thumbnail
      }
    }
    
    // Si c'est une vidéo, essayer d'obtenir les dimensions (nécessite ffmpeg)
    if (file.type.startsWith('video/')) {
      // Pour l'instant, on ne génère pas de thumbnail pour les vidéos
      // Cela nécessiterait ffmpeg ou un service externe
      fileMetadata.thumbnail_path = null
    }
    
    // Si c'est un audio, essayer d'obtenir la durée
    if (file.type.startsWith('audio/')) {
      // Pour l'instant, on ne calcule pas la durée
      // Cela nécessiterait une lib audio ou ffmpeg
      fileMetadata.duration = null
    }
    
    // Obtenir l'URL publique signée (valide 1 heure)
    const { data: signedUrl } = await supabase.storage
      .from('chat')
      .createSignedUrl(storagePath, 3600)
    
    // Retourner les infos du fichier
    return NextResponse.json({
      file: {
        ...fileMetadata,
        url: signedUrl?.signedUrl
      }
    })
    
  } catch (error) {
    console.error('Erreur API upload:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET /api/chat/upload - Obtenir une URL signée pour un fichier
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get('path')
    
    if (!path) {
      return NextResponse.json({ error: 'path requis' }, { status: 400 })
    }
    
    // Extraire le group_id du path
    const groupId = path.split('/')[0]
    
    // Vérifier l'appartenance au groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Générer une URL signée (valide 1 heure)
    const { data, error } = await supabase.storage
      .from('chat')
      .createSignedUrl(path, 3600)
    
    if (error) {
      console.error('Erreur génération URL signée:', error)
      return NextResponse.json({ error: 'Erreur lors de la génération de l\'URL' }, { status: 500 })
    }
    
    // Pour les requêtes directes (audio/vidéo), faire une redirection
    const accept = request.headers.get('accept') || ''
    const isDirectRequest = accept.includes('audio/') || accept.includes('video/') || searchParams.get('direct') === 'true'
    
    if (isDirectRequest) {
      return NextResponse.redirect(data.signedUrl)
    }
    
    // Sinon retourner le JSON
    return NextResponse.json({ url: data.signedUrl })
    
  } catch (error) {
    console.error('Erreur API get signed url:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chat/upload - Supprimer un fichier
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const fileId = searchParams.get('file_id')
    
    if (!fileId) {
      return NextResponse.json({ error: 'file_id requis' }, { status: 400 })
    }
    
    // Récupérer le fichier et vérifier les permissions
    const { data: file } = await supabase
      .from('chat_files')
      .select(`
        storage_path,
        thumbnail_path,
        message:chat_messages!message_id (
          user_id
        )
      `)
      .eq('id', fileId)
      .single()
    
    if (!file || file.message?.user_id !== user.id) {
      return NextResponse.json({ error: 'Fichier non trouvé ou non autorisé' }, { status: 403 })
    }
    
    // Supprimer le fichier principal du storage
    const { error: deleteError } = await supabase.storage
      .from('chat')
      .remove([file.storage_path])
    
    if (deleteError) {
      console.error('Erreur suppression fichier storage:', deleteError)
    }
    
    // Supprimer le thumbnail s'il existe
    if (file.thumbnail_path) {
      await supabase.storage
        .from('chat')
        .remove([file.thumbnail_path])
    }
    
    // Supprimer l'entrée en base de données
    const { error: dbError } = await supabase
      .from('chat_files')
      .delete()
      .eq('id', fileId)
    
    if (dbError) {
      console.error('Erreur suppression fichier DB:', dbError)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur API delete file:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}