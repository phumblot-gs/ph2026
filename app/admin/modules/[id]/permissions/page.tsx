import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ModulePermissionsPage from './client-page';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModulePermissionsPageServer({ params }: PageProps) {
  const resolvedParams = await params;
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
  
  // Load module data
  const { data: module } = await supabase
    .from('modules')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();
  
  if (!module) {
    redirect('/admin?tab=modules');
  }
  
  // Load all groups
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('name');
  
  // Load existing permissions for this module
  const { data: existingPermissions } = await supabase
    .from('module_data_permissions')
    .select('*')
    .eq('module_id', resolvedParams.id);
  
  return (
    <ModulePermissionsPage 
      module={module}
      groups={groups || []}
      existingPermissions={existingPermissions || []}
    />
  );
}