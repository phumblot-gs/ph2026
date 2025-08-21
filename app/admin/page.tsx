import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DonationsTab from './components/donations-tab';
import MembersTab from './components/members-tab';
import SettingsTab from './components/settings-tab';
import StatsOverview from './components/stats-overview';
import { AdminNav } from '@/components/admin-nav';
import { Footer } from '@/components/footer';

export default async function AdminPage() {
  const supabase = await createClient();
  
  // Check authentication and admin role
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', user.id)
    .single();
  
  if (!member || member.role !== 'admin') {
    redirect('/dashboard');
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Statistics Overview */}
        <StatsOverview />
        
        {/* Main Tabs */}
        <div className="mt-8">
          <Tabs defaultValue="donations" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="donations">Dons</TabsTrigger>
              <TabsTrigger value="members">Membres</TabsTrigger>
              <TabsTrigger value="settings">Paramètres</TabsTrigger>
            </TabsList>
            
            <TabsContent value="donations" className="space-y-6">
              <DonationsTab />
            </TabsContent>
            
            <TabsContent value="members" className="space-y-6">
              <MembersTab />
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-6">
              <SettingsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
}