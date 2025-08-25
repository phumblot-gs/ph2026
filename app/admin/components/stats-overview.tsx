import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Euro, Users, TrendingUp, Heart, MessageSquare } from 'lucide-react';

export default async function StatsOverview() {
  const supabase = await createClient();
  
  // Fetch statistics
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Total donations for current year
  const { data: totalDonations } = await supabase
    .from('donations')
    .select('amount')
    .eq('status', 'completed')
    .gte('created_at', `${currentYear}-01-01`)
    .lt('created_at', `${currentYear + 1}-01-01`);
  
  const totalAmount = totalDonations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
  
  // Pending Slack invitations
  const { count: pendingInvitations } = await supabase
    .from('slack_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  // Total members
  const { count: totalMembers } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  
  // Total donors (unique members who donated)
  const { data: uniqueDonors } = await supabase
    .from('donations')
    .select('member_id')
    .eq('status', 'completed');
  
  const uniqueDonorCount = new Set(uniqueDonors?.map(d => d.member_id)).size;
  
  // Average donation
  const avgDonation = totalDonations?.length ? Math.round(totalAmount / totalDonations.length) : 0;
  
  const stats = [
    {
      title: 'Total collecté',
      value: `${totalAmount.toLocaleString('fr-FR')}€`,
      description: `${totalDonations?.length || 0} dons sur ${currentYear}`,
      icon: Euro,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Donateurs uniques',
      value: uniqueDonorCount.toString(),
      description: `Sur ${totalMembers || 0} membres`,
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Don moyen',
      value: `${avgDonation}€`,
      description: 'Par transaction',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Membres actifs',
      value: (totalMembers || 0).toString(),
      description: 'Inscrits et validés',
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Invitations Slack',
      value: (pendingInvitations || 0).toString(),
      description: pendingInvitations ? 'En attente de traitement' : 'Aucune en attente',
      icon: MessageSquare,
      color: pendingInvitations ? 'text-orange-600' : 'text-gray-600',
      bgColor: pendingInvitations ? 'bg-orange-50' : 'bg-gray-50',
    },
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}