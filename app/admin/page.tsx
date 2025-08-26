import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminTabs from './components/admin-tabs';
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
  
  // Get website URL and highlight URL for navigation
  const { data: navigationSettings } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['website_url', 'highlight_url']);
  
  const websiteUrl = navigationSettings?.find(s => s.setting_key === 'website_url')?.setting_value?.replace(/^https?:\/\//, '') || null;
  const highlightUrl = navigationSettings?.find(s => s.setting_key === 'highlight_url')?.setting_value || null;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <AdminNav websiteUrl={websiteUrl} highlightUrl={highlightUrl} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {/* Statistics Overview */}
        <StatsOverview />
        
        {/* Main Tabs */}
        <div className="mt-8">
          <AdminTabs />
        </div>
      </div>
      <Footer />
    </div>
  );
}