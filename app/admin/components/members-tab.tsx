'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Search, 
  RefreshCw, 
  User,
  Mail,
  Calendar,
  MapPin,
  Shield,
  UserCheck,
  UserX,
  Download,
  Pencil,
  MessageSquare,
  Users
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ExcelJS from 'exceljs';

export default function MembersTab() {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterSlack, setFilterSlack] = useState<'all' | 'connected' | 'not_connected'>('all');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'member'>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'all' | 'suspended'>('active');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [groups, setGroups] = useState<any[]>([]);
  
  useEffect(() => {
    loadGroups();
    loadMembers();
  }, [searchTerm, filterSlack, filterRole, filterStatus, filterGroup]);
  
  async function loadGroups() {
    const supabase = createClient();
    const { data } = await supabase
      .from('groups')
      .select('id, name')
      .order('name', { ascending: true });
    if (data) setGroups(data);
  }
  
  async function loadMembers() {
    setLoading(true);
    const supabase = createClient();
    
    // Récupérer les membres
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (membersError) {
      console.error('Error loading members:', membersError);
      setLoading(false);
      return;
    }
    
    // Récupérer les associations user_groups avec les infos des groupes
    const { data: userGroupsData } = await supabase
      .from('user_groups')
      .select(`
        user_id,
        group_id,
        groups (
          id,
          name
        )
      `);
    
    // Associer les groupes aux membres
    const membersWithGroups = membersData?.map(member => {
      const memberGroups = userGroupsData?.filter(ug => ug.user_id === member.user_id) || [];
      return {
        ...member,
        user_groups: memberGroups
      };
    }) || [];
    
    let filtered = membersWithGroups;
    
    // Filtrer par recherche
    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtrer par statut Slack
    if (filterSlack === 'connected') {
      filtered = filtered.filter(m => m.slack_user_id);
    } else if (filterSlack === 'not_connected') {
      filtered = filtered.filter(m => !m.slack_user_id);
    }
    
    // Filtrer par rôle
    if (filterRole !== 'all') {
      filtered = filtered.filter(m => m.role === filterRole);
    }
    
    // Filtrer par statut (par défaut: exclure les suspendus)
    if (filterStatus === 'active') {
      filtered = filtered.filter(m => m.status === 'active');
    } else if (filterStatus === 'suspended') {
      filtered = filtered.filter(m => m.status === 'suspended');
    }
    // 'all' affiche tout
    
    // Filtrer par groupe
    if (filterGroup !== 'all') {
      filtered = filtered.filter(m => 
        m.user_groups?.some((ug: any) => ug.groups?.id === filterGroup)
      );
    }
    
    setMembers(filtered);
    
    setLoading(false);
    setSelectedMembers([]); // Reset selection when reloading
  }
  
  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <Badge className="bg-purple-100 text-purple-800"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800"><User className="h-3 w-3 mr-1" />Membre</Badge>;
  };
  
  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-800"><UserCheck className="h-3 w-3 mr-1" />Actif</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800"><UserX className="h-3 w-3 mr-1" />Suspendu</Badge>;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(members.map(m => m.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleSelectMember = (memberId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, memberId]);
    } else {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedMembers.length === 0) return;
    
    setIsProcessing(true);
    const supabase = createClient();
    
    const [field, value] = bulkAction.split(':');
    const updateData = { [field]: value, updated_at: new Date().toISOString() };
    
    const { error } = await supabase
      .from('members')
      .update(updateData)
      .in('id', selectedMembers);
    
    if (!error) {
      await loadMembers();
      setBulkAction('');
    }
    
    setIsProcessing(false);
  };

  const exportToExcel = () => {
    // Prepare data for export
    const exportData = members.map(member => ({
      'Prénom': member.first_name || '',
      'Nom': member.last_name || '',
      'Email': member.email || '',
      'Téléphone': member.phone || '',
      'Date de naissance': member.birth_date ? new Date(member.birth_date).toLocaleDateString('fr-FR') : '',
      'Groupes': member.user_groups?.map((ug: any) => ug.groups?.name).filter(Boolean).join(', ') || 'Aucun',
      'Slack': member.slack_user_id ? 'Connecté' : 'Non connecté',
      'Rôle': member.role || 'member',
      'Statut': member.status || 'active',
      'Date d\'inscription': new Date(member.created_at).toLocaleDateString('fr-FR'),
    }));

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Membres');
    
    // Define columns
    worksheet.columns = [
      { header: 'Prénom', key: 'first_name', width: 15 },
      { header: 'Nom', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Date de naissance', key: 'birth_date', width: 20 },
      { header: 'Groupes', key: 'groups', width: 30 },
      { header: 'Slack', key: 'slack', width: 12 },
      { header: 'Rôle', key: 'role', width: 12 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Date d\'inscription', key: 'created_at', width: 20 }
    ];
    
    // Add data
    exportData.forEach(row => {
      worksheet.addRow({
        first_name: row['Prénom'],
        last_name: row['Nom'],
        email: row['Email'],
        phone: row['Téléphone'],
        birth_date: row['Date de naissance'],
        groups: row['Groupes'],
        slack: row['Slack'],
        role: row['Rôle'],
        status: row['Statut'],
        created_at: row['Date d\'inscription']
      });
    });

    // Generate filename with current date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `membres_${dateStr}.xlsx`;

    // Save file
    
    // Generate buffer and download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Gestion des membres</CardTitle>
              <CardDescription>
                {members.length} membres inscrits
                {selectedMembers.length > 0 && ` • ${selectedMembers.length} sélectionné(s)`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un membre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={filterSlack} onValueChange={(value: any) => setFilterSlack(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Connexion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="connected">Connectés</SelectItem>
                <SelectItem value="not_connected">Non connectés</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={(value: any) => setFilterRole(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous rôles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Membre</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="suspended">Suspendus</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Groupe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous groupes</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={loadMembers}
              title="Actualiser"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={exportToExcel}
              disabled={members.length === 0}
              title="Exporter XLS"
            >
              <Download className="h-4 w-4" />
            </Button>
            </div>
          </div>
          
          {/* Bulk actions */}
          {selectedMembers.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Sélectionner une action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role:admin">Passer en Admin</SelectItem>
                  <SelectItem value="role:member">Passer en Membre</SelectItem>
                  <SelectItem value="status:active">Activer</SelectItem>
                  <SelectItem value="status:suspended">Suspendre</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkAction}
                disabled={!bulkAction || isProcessing}
                size="sm"
              >
                {isProcessing ? 'Application...' : 'Appliquer'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSelectedMembers([])}
                size="sm"
              >
                Annuler la sélection
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={members.length > 0 && selectedMembers.length === members.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Membre</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Groupes</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Aucun membre trouvé
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={(checked) => handleSelectMember(member.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                          {member.photo_url ? (
                            <img 
                              src={member.photo_url} 
                              alt={`${member.first_name} ${member.last_name}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-blue-600">
                              {member.first_name?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {member.first_name} {member.last_name}
                            </p>
                            <div 
                              className={`h-2 w-2 rounded-full ${
                                member.slack_user_id ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                              title="Connexion Slack"
                            />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="h-3 w-3 mr-1 text-gray-400" />
                          {member.email}
                        </div>
                        {member.phone && (
                          <div className="flex items-center text-sm text-gray-500">
                            {member.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.user_groups && member.user_groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {member.user_groups.map((ug: any, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {ug.groups?.name || 'Groupe'}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Aucun groupe</span>
                      )}
                    </TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>{getStatusBadge(member.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                        {new Date(member.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/admin/members/${member.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}