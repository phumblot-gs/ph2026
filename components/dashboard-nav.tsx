'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

interface DashboardNavProps {
  memberRole?: string
  websiteUrl?: string | null
  highlightUrl?: string | null
}

export function DashboardNav({ memberRole, websiteUrl, highlightUrl }: DashboardNavProps) {
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = memberRole === 'admin'
  const [userInfo, setUserInfo] = useState<{ email?: string; photoUrl?: string; initials?: string }>({})

  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await supabase
        .from('members')
        .select('first_name, last_name, photo_url')
        .eq('user_id', user.id)
        .single()
      
      setUserInfo({
        email: user.email,
        photoUrl: member?.photo_url,
        initials: member ? `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase() : user.email?.[0]?.toUpperCase()
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Extract display URL from highlight URL
  const highlightDisplayUrl = highlightUrl?.replace(/^https?:\/\//, '') || null

  return (
    <nav className="fixed top-4 right-4 z-50">
      <div className="flex items-center gap-2">
        {highlightUrl && (
          <a href={highlightUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="default" size="sm">
              {highlightDisplayUrl}
            </Button>
          </a>
        )}
        
        {websiteUrl && (
          <Link href="/">
            <Button variant="ghost" size="sm">
              {websiteUrl}
            </Button>
          </Link>
        )}
        
        {isAdmin && (
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              Admin
            </Button>
          </Link>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userInfo.photoUrl} alt="Avatar" />
                <AvatarFallback>{userInfo.initials || 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Mon profil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Déconnexion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}