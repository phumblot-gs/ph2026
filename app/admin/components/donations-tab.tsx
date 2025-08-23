'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Search, 
  Filter, 
  RefreshCw, 
  Euro,
  Calendar,
  User,
  CreditCard,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Donation } from '@/lib/types/donations';

export default function DonationsTab() {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  useEffect(() => {
    loadDonations();
    loadSettings();
  }, []);
  
  async function loadDonations() {
    setLoading(true);
    const supabase = createClient();
    
    let query = supabase
      .from('donations')
      .select(`
        *,
        members (
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    
    // Date filter
    if (dateFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (dateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.gte('created_at', monthAgo.toISOString());
    }
    
    const { data, error } = await query;
    
    if (!error && data) {
      // Apply search filter
      let filtered = data;
      if (searchTerm) {
        filtered = data.filter(d => 
          d.members?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.members?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.members?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setDonations(filtered);
    }
    
    setLoading(false);
  }
  
  async function loadSettings() {
    const supabase = createClient();
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('setting_key', 'donations_enabled')
      .single();
    
    if (data) {
      setDonationsEnabled(data.setting_value === 'true');
    }
  }
  
  async function toggleDonations(enabled: boolean) {
    const supabase = createClient();
    await supabase
      .from('app_settings')
      .update({ 
        setting_value: enabled ? 'true' : 'false',
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'donations_enabled');
    
    setDonationsEnabled(enabled);
  }
  
  async function exportDonations() {
    // Create CSV content
    const headers = ['Date', 'Montant', 'Statut', 'Donateur', 'Email', 'Méthode', 'ID'];
    const rows = donations.map(d => [
      new Date(d.created_at).toLocaleDateString('fr-FR'),
      d.amount + '€',
      d.status,
      `${d.members?.first_name || ''} ${d.members?.last_name || ''}`,
      d.members?.email || '',
      d.payment_method || 'card',
      d.id.substring(0, 8)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `donations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Complété</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Échoué</Badge>;
      case 'refunded':
        return <Badge className="bg-gray-100 text-gray-800"><RefreshCw className="h-3 w-3 mr-1" />Remboursé</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  const totalAmount = donations
    .filter(d => d.status === 'completed')
    .reduce((sum, d) => sum + Number(d.amount), 0);
  
  return (
    <div className="space-y-6">
      {/* Donations Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestion des dons</CardTitle>
              <CardDescription>
                Activez ou désactivez la collecte de dons sur le site
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="donations-toggle">
                {donationsEnabled ? 'Activé' : 'Désactivé'}
              </Label>
              <Switch
                id="donations-toggle"
                checked={donationsEnabled}
                onCheckedChange={toggleDonations}
              />
            </div>
          </div>
        </CardHeader>
        {!donationsEnabled && (
          <CardContent>
            <div className="flex items-center p-4 bg-yellow-50 text-yellow-800 rounded-lg">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p className="text-sm">
                Les dons sont actuellement désactivés. Les visiteurs verront un message d'information.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Liste des dons</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">Tous les statuts</option>
                <option value="completed">Complétés</option>
                <option value="pending">En attente</option>
                <option value="failed">Échoués</option>
                <option value="refunded">Remboursés</option>
              </select>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">7 derniers jours</option>
                <option value="month">30 derniers jours</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDonations}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportDonations}
                disabled={donations.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total collecté</p>
                <p className="text-xl font-bold">{totalAmount.toLocaleString('fr-FR')}€</p>
              </div>
              <div>
                <p className="text-gray-600">Nombre de dons</p>
                <p className="text-xl font-bold">{donations.length}</p>
              </div>
              <div>
                <p className="text-gray-600">Don moyen</p>
                <p className="text-xl font-bold">
                  {donations.length ? Math.round(totalAmount / donations.filter(d => d.status === 'completed').length) : 0}€
                </p>
              </div>
              <div>
                <p className="text-gray-600">Taux de succès</p>
                <p className="text-xl font-bold">
                  {donations.length 
                    ? Math.round((donations.filter(d => d.status === 'completed').length / donations.length) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Donateur</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : donations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Aucun don trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  donations.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(donation.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {donation.members?.first_name} {donation.members?.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{donation.members?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center font-semibold">
                          <Euro className="h-4 w-4 mr-1 text-gray-400" />
                          {donation.amount}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(donation.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <CreditCard className="h-4 w-4 mr-1 text-gray-400" />
                          {donation.payment_method || 'card'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {donation.id.substring(0, 8)}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}