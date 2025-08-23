'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { AdminNav } from '@/components/admin-nav'
import { PhoneInput } from '@/components/ui/phone-input'
import { DatePicker } from '@/components/ui/date-picker'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { Footer } from '@/components/footer'

interface MemberFormData {
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
  role: string
  status: string
}

export default function EditMemberPage() {
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<MemberFormData>({
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
    google_place_id: '',
    role: 'member',
    status: 'active'
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadMember()
  }, [memberId])

  async function loadMember() {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single()
    
    if (error || !data) {
      setMessage({ type: 'error', text: 'Membre introuvable' })
      setLoading(false)
      return
    }
    
    setFormData({
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
      phone: data.phone || '',
      birth_date: data.birth_date || '',
      address_line1: data.address_line1 || '',
      address_line2: data.address_line2 || '',
      postal_code: data.postal_code || '',
      city: data.city || '',
      country: data.country || '',
      google_place_id: data.google_place_id || '',
      role: data.role || 'member',
      status: data.status || 'active'
    })
    
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
        role: formData.role,
        status: formData.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
    
    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' })
      console.error('Update error:', error)
    } else {
      setMessage({ type: 'success', text: 'Membre mis à jour avec succès' })
      setTimeout(() => {
        router.push('/admin')
      }, 1500)
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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <AdminNav />
      
      <div className="pt-8 px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header with Back Button */}
          <div className="mb-8">
            <Link href="/admin">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à l'administration
              </Button>
            </Link>
            
            <h1 className="text-3xl font-bold text-gray-900">Modifier le membre</h1>
            <p className="text-gray-600 mt-2">
              Modifiez les informations du membre
            </p>
          </div>
          
          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle>Informations du membre</CardTitle>
              <CardDescription>
                Tous les champs peuvent être modifiés sauf l'email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      placeholder="Prénom"
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
                      placeholder="Nom"
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
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      L'email ne peut pas être modifié
                    </p>
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
                    placeholder="Sélectionner la date de naissance"
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
                
                {/* Role and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">
                      Rôle
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Membre</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="status">
                      Statut
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="suspended">Suspendu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Submit Button */}
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
        </div>
      </div>
      <Footer />
    </div>
  )
}