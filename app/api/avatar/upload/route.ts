import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Récupérer le fichier depuis le FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Vérifier le type et la taille
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Le fichier ne doit pas dépasser 5MB' }, { status: 400 });
    }

    // Générer un nom de fichier unique dans un dossier utilisateur
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

    // Convertir le fichier en buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload vers Supabase Storage avec le client serveur
    const { error: uploadError, data } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Erreur upload:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Mettre à jour la base de données
    const { error: updateError } = await supabase
      .from('members')
      .update({ 
        photo_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      // Essayer de supprimer le fichier uploadé si la mise à jour échoue
      await supabase.storage.from('avatars').remove([fileName]);
      console.error('Erreur mise à jour DB:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      message: 'Photo uploadée avec succès'
    });

  } catch (error: any) {
    console.error('Erreur serveur:', error);
    return NextResponse.json({ 
      error: error.message || 'Erreur serveur' 
    }, { status: 500 });
  }
}