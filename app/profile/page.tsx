'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, Loader2, User, Mail, MapPin, Calendar, Phone } from 'lucide-react'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { PhoneInput } from '@/components/ui/phone-input'
import { DatePicker } from '@/components/ui/date-picker'
import { Footer } from '@/components/footer'
import { SlackConnection } from '@/components/slack-connection'
import { AvatarUpload } from '@/components/ui/avatar-upload'

interface ProfileFormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string
  address_line1: string
  address_line2: string
  postal_code: string
  city: string
  country: string
  google_place_id: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [member, setMember] = useState<any>(null)
  const [formData, setFormData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: '',
    country: '',
    google_place_id: ''
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }
    
    const { data: memberData } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (memberData) {
      setMember(memberData)
      setFormData({
        first_name: memberData.first_name || '',
        last_name: memberData.last_name || '',
        email: memberData.email || '',
        phone: memberData.phone || '',
        birth_date: memberData.birth_date || '',
        address_line1: memberData.address_line1 || '',
        address_line2: memberData.address_line2 || '',
        postal_code: memberData.postal_code || '',
        city: memberData.city || '',
        country: memberData.country || '',
        google_place_id: memberData.google_place_id || ''
      })
    }
    
    setLoading(false)
  }

  const handleAddressSelect = (address: any) => {
    setFormData(prev => ({
      ...prev,
      address_line1: address.address_line1 || '',
      address_line2: address.address_line2 || '',
      postal_code: address.postal_code || '',
      city: address.city || '',
      country: address.country || '',
      google_place_id: address.google_place_id || '',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }
    
    const { error } = await supabase
      .from('members')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        birth_date: formData.birth_date || null,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2,
        postal_code: formData.postal_code,
        city: formData.city,
        country: formData.country,
        google_place_id: formData.google_place_id,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
    
    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' })
      console.error('Update error:', error)
    } else {
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès' })
      // Recharger les données
      await loadProfile()
    }
    
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au tableau de bord
            </Button>
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900">Mon profil</h1>
          <p className="text-gray-600 mt-2">
            Gérez vos informations personnelles
          </p>
        </div>
        
        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Mettez à jour vos informations personnelles et vos coordonnées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Upload */}
              <div className="pb-6 border-b">
                <Label className="block mb-4">Photo de profil</Label>
                <AvatarUpload
                  userId={member?.user_id || ''}
                  currentPhotoUrl={member?.photo_url}
                  userName={`${formData.first_name} ${formData.last_name}`.trim() || formData.email}
                  onPhotoUpdate={async () => {
                    // Recharger le profil après la mise à jour de la photo
                    await loadProfile()
                  }}
                />
              </div>
              
              {/* Name fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">
                    Prénom
                  </Label>
                  <Input
                    id="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Votre prénom"
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label htmlFor="last_name">
                    Nom
                  </Label>
                  <Input
                    id="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Votre nom"
                    disabled={saving}
                  />
                </div>
              </div>
              
              {/* Contact fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <Label htmlFor="email">
                    Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <div className="h-4 mt-1">
                      <p className="text-xs text-gray-500">
                        L'adresse email ne peut pas être modifiée
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    disabled={saving}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>
              
              {/* Birth date */}
              <div>
                <Label htmlFor="birth_date">
                  Date de naissance
                </Label>
                <DatePicker
                  value={formData.birth_date}
                  onChange={(value) => setFormData({ ...formData, birth_date: value })}
                  disabled={saving}
                  placeholder="Sélectionner votre date de naissance"
                  maxDate={new Date()}
                  minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 120))}
                />
              </div>
              
              {/* Address */}
              <div className="space-y-4">
                <AddressAutocomplete
                  onAddressSelect={handleAddressSelect}
                  initialPlaceId={formData.google_place_id}
                  initialAddress={{
                    address_line1: formData.address_line1,
                    postal_code: formData.postal_code,
                    city: formData.city
                  }}
                  disabled={saving}
                />
                
                {/* Optional complement field */}
                <div>
                  <Label htmlFor="address_line2">
                    Complément d'adresse (optionnel)
                  </Label>
                  <Input
                    id="address_line2"
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    disabled={saving}
                    placeholder="Bâtiment, étage, appartement..."
                  />
                </div>
              </div>
              
              {/* Submit Button inside form */}
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Enregistrer les modifications
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Success/Error Message */}
        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800' 
              : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Slack Integration */}
        {member && (
          <div className="mt-8">
            <SlackConnection userId={member.user_id} />
          </div>
        )}
        
        {/* Account Info - Read Only */}
        <div className="mt-8 pt-8 border-t">
          <h3 className="font-medium mb-4">Informations du compte</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Niveau d'accès</p>
              <p className="font-medium capitalize">{member?.role || 'Membre'}</p>
            </div>
            <div>
              <p className="text-gray-500">Statut</p>
              <p className="font-medium capitalize">{member?.status || 'Actif'}</p>
            </div>
            <div>
              <p className="text-gray-500">Membre depuis</p>
              <p className="font-medium">
                {member?.created_at 
                  ? new Date(member.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}