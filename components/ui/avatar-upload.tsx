'use client';

import { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, X, ZoomIn, ZoomOut } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AvatarUploadProps {
  userId: string;
  currentPhotoUrl?: string;
  userName?: string;
  onPhotoUpdate?: (url: string | null) => void;
}

export function AvatarUpload({ 
  userId, 
  currentPhotoUrl, 
  userName = 'User',
  onPhotoUpdate 
}: AvatarUploadProps) {
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || '');
  const [uploading, setUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const createImage = useCallback((url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    }), []);

  const getCroppedImg = useCallback(async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Définir la taille du canvas (carré pour l'avatar)
    // Utiliser une taille plus grande pour une meilleure qualité
    const size = 800; // Augmenté de 400 à 800 pour une meilleure qualité
    canvas.width = size;
    canvas.height = size;

    // Activer l'antialiasing pour une meilleure qualité
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Dessiner l'image recadrée
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      size,
      size
    );

    // Convertir en blob avec une qualité maximale
    // Essayer WebP d'abord pour une meilleure compression, sinon JPEG
    return new Promise((resolve) => {
      // Vérifier le support WebP
      const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      
      canvas.toBlob((blob) => {
        resolve(blob);
      }, supportsWebP ? 'image/webp' : 'image/jpeg', supportsWebP ? 0.95 : 1.0); 
      // WebP à 0.95 offre une excellente qualité avec une taille réduite
      // JPEG à 1.0 pour la meilleure qualité possible
    });
  }, [createImage]);

  const onCropComplete = useCallback(async (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
    
    // Générer un aperçu du recadrage pour l'affichage en temps réel
    if (previewUrl) {
      try {
        const croppedImg = await getCroppedImg(previewUrl, croppedAreaPixels);
        if (croppedImg) {
          const preview = URL.createObjectURL(croppedImg);
          // Nettoyer l'ancienne URL d'aperçu pour éviter les fuites mémoire
          if (croppedPreview) {
            URL.revokeObjectURL(croppedPreview);
          }
          setCroppedPreview(preview);
        }
      } catch (e) {
        console.error('Error generating preview:', e);
      }
    }
  }, [previewUrl, getCroppedImg, croppedPreview]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier - Accepter uniquement JPG, PNG et GIF
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Format non supporté. Veuillez sélectionner une image JPG, PNG ou GIF');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('L\'image ne doit pas dépasser 5MB');
      return;
    }

    // Créer un aperçu
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setShowDialog(true);
      // Réinitialiser le zoom et la position
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!previewUrl || !croppedAreaPixels) return;

    setUploading(true);
    try {
      // Obtenir l'image recadrée
      const croppedImageBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      
      if (!croppedImageBlob) {
        throw new Error('Impossible de recadrer l\'image');
      }

      // Créer un File à partir du Blob
      const croppedFile = new File([croppedImageBlob], 'avatar.jpg', {
        type: 'image/jpeg'
      });

      // Utiliser l'API route pour l'upload
      const formData = new FormData();
      formData.append('file', croppedFile);

      const response = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'upload');
      }

      // Supprimer l'ancienne image si elle existe
      if (currentPhotoUrl && currentPhotoUrl.includes('avatars/')) {
        const oldPath = currentPhotoUrl.split('avatars/').pop();
        if (oldPath) {
          // Ignorer les erreurs de suppression de l'ancienne image
          try {
            await supabase.storage
              .from('avatars')
              .remove([oldPath]);
          } catch (e) {
            console.log('Impossible de supprimer l\'ancienne image:', e);
          }
        }
      }

      setPhotoUrl(result.url);
      if (onPhotoUpdate) {
        onPhotoUpdate(result.url);
      }
      
      setShowDialog(false);
      setPreviewUrl(null);
    } catch (error: any) {
      console.error('Erreur lors de l\'upload:', error);
      console.error('Détails de l\'erreur:', error.message, error.details);
      alert(`Erreur lors de l'upload de la photo: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!photoUrl) return;
    
    setUploading(true);
    try {
      // Mettre à jour la base de données
      const { error: updateError } = await supabase
        .from('members')
        .update({ 
          photo_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      // Supprimer l'image du storage si c'est une image uploadée
      if (photoUrl.includes('avatars/')) {
        const path = photoUrl.split('avatars/').pop();
        if (path) {
          await supabase.storage
            .from('avatars')
            .remove([path]); // Pas de préfixe 'avatars/'
        }
      }

      setPhotoUrl(''); // On garde la chaîne vide ici pour l'état local
      if (onPhotoUpdate) {
        onPhotoUpdate(null); // On passe null au callback
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de la photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Avatar className="h-24 w-24">
            <AvatarImage src={photoUrl || undefined} alt={userName} />
            <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-0 right-0 rounded-full h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upload...
                </>
              ) : (
                'Changer la photo'
              )}
            </Button>
            
            {photoUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeAvatar}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <p className="text-xs text-gray-500">
            JPG, PNG ou GIF. Max 5MB.
          </p>
        </div>
      </div>

      {/* Dialog de prévisualisation et recadrage */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          // Nettoyer les URLs d'objets pour éviter les fuites mémoire
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
          if (croppedPreview) {
            URL.revokeObjectURL(croppedPreview);
            setCroppedPreview(null);
          }
          setZoom(1);
          setCrop({ x: 0, y: 0 });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recadrer votre photo</DialogTitle>
            <DialogDescription>
              Ajustez le cadrage et le zoom pour obtenir la photo parfaite
            </DialogDescription>
          </DialogHeader>
          
          {previewUrl && (
            <div className="space-y-4">
              {/* Zone de recadrage avec preview en temps réel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Zone de recadrage */}
                <div className="relative h-[400px] bg-gray-100 rounded-lg overflow-hidden">
                  <Cropper
                    image={previewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>
                
                {/* Aperçu du résultat */}
                <div className="flex flex-col items-center justify-center space-y-2">
                  <p className="text-sm font-medium text-gray-700">Aperçu final</p>
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                    {croppedPreview ? (
                      <img 
                        src={croppedPreview} 
                        alt="Aperçu final" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <span className="text-xs">Ajustez le recadrage</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Image finale : 800×800px</p>
                  <p className="text-xs text-gray-400">Haute qualité</p>
                </div>
              </div>
              
              {/* Contrôles de zoom */}
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <ZoomOut className="h-4 w-4 text-gray-500" />
                  <Slider
                    value={[zoom]}
                    min={1}
                    max={3}
                    step={0.1}
                    onValueChange={(value) => setZoom(value[0])}
                    className="flex-1"
                  />
                  <ZoomIn className="h-4 w-4 text-gray-500" />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Utilisez la molette de la souris ou pincez pour zoomer
                </p>
              </div>
              
              {/* Boutons d'action */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    setPreviewUrl(null);
                    setZoom(1);
                    setCrop({ x: 0, y: 0 });
                  }}
                  disabled={uploading}
                >
                  Annuler
                </Button>
                <Button
                  onClick={uploadAvatar}
                  disabled={uploading || !croppedAreaPixels}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Upload...
                    </>
                  ) : (
                    'Confirmer'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}