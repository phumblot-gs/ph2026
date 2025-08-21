'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function AdminNav() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="fixed top-4 right-4 z-50">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="outline" size="sm">
            ph2026.fr
          </Button>
        </Link>
        
        <Link href="/dashboard">
          <Button size="sm">
            Dashboard
          </Button>
        </Link>
        
        <Link href="/profile">
          <Button variant="outline" size="sm">
            Mon profil
          </Button>
        </Link>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleLogout}
        >
          Déconnexion
        </Button>
      </div>
    </nav>
  )
}