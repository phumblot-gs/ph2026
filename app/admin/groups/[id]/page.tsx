import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GroupEditPage from './client-page';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: PageProps) {
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
  
  // Load group data
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();
  
  if (!group) {
    redirect('/admin');
  }
  
  // Load all members first
  const { data: membersData } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false });

  // Load user_groups associations for this group
  const { data: userGroupsData } = await supabase
    .from('user_groups')
    .select('user_id, group_id')
    .eq('group_id', resolvedParams.id);

  // Filter members that belong to this group
  const groupMembers = membersData?.filter(member => 
    userGroupsData?.some(ug => ug.user_id === member.user_id)
  ) || [];
  
  // Load all members for adding new ones
  const { data: allMembers } = await supabase
    .from('members')
    .select('user_id, first_name, last_name, email')
    .order('first_name', { ascending: true });
  
  return (
    <GroupEditPage 
      groupId={resolvedParams.id}
      initialGroup={group}
      initialGroupMembers={groupMembers}
      allMembers={allMembers || []}
    />
  );
}