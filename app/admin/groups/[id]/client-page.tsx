'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MemberSearchSelect } from '@/components/ui/member-search-select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Save, 
  UserPlus, 
  UserMinus, 
  MessageSquare, 
  RefreshCw,
  AlertCircle,
  Loader2,
  Users,
  Hash,
  Search,
  Mail,
  Calendar,
  Shield,
  User,
  UserCheck,
  UserX,
  Download
} from 'lucide-react';
import { AdminNav } from '@/components/admin-nav';
import { Footer } from '@/components/footer';
import ExcelJS from 'exceljs';

interface GroupEditPageProps {
  groupId: string;
  initialGroup: any;
  initialGroupMembers: any[];
  allMembers: any[];
}

export default function GroupEditPage({ 
  groupId, 
  initialGroup, 
  initialGroupMembers,
  allMembers 
}: GroupEditPageProps) {
  const router = useRouter();
  const [group, setGroup] = useState(initialGroup);
  const [groupMembers, setGroupMembers] = useState(initialGroupMembers);
  
  // Initialiser allMembersData avec les données des membres du groupe
  const [allMembersData, setAllMembersData] = useState<any[]>(initialGroupMembers);
  
  // État de debug
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [customChannelName, setCustomChannelName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [slackFeatures, setSlackFeatures] = useState<any>(null);
  const [syncingSlack, setSyncingSlack] = useState(false);
  
  // Nouveaux états pour filtres et sélection
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSlack, setFilterSlack] = useState<'all' | 'connected' | 'not_connected'>('all');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'member'>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'all' | 'suspended'>('active');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSlackFeatures();
    // Charger les données au montage si elles sont vides
    if (allMembersData.length === 0 && groupMembers.length === 0) {
      loadCompleteGroupMembers();
    }
  }, []);
  
  useEffect(() => {
    setSelectedMembers([]);
  }, [searchTerm, filterSlack, filterRole, filterStatus]);

  async function checkSlackFeatures() {
    try {
      const response = await fetch('/api/slack/features');
      if (response.ok) {
        const features = await response.json();
        setSlackFeatures(features);
      }
    } catch (error) {
      console.error('Error checking Slack features:', error);
    }
  }
  
  const exportToExcel = () => {
    // Préparer les données pour l'export
    const exportData = filteredMembers.map(member => ({
      'Prénom': member.first_name || '',
      'Nom': member.last_name || '',
      'Email': member.email || '',
      'Téléphone': member.phone || '',
      'Date de naissance': member.birth_date ? new Date(member.birth_date).toLocaleDateString('fr-FR') : '',
      'Slack': member.slack_user_id ? 'Connecté' : 'Non connecté',
      'Rôle': member.role || 'member',
      'Statut': member.status || 'active',
      'Date d\'inscription': new Date(member.created_at).toLocaleDateString('fr-FR'),
    }));

    // Créer le workbook et worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Membres du groupe');
    
    // Define columns
    worksheet.columns = [
      { header: 'Prénom', key: 'first_name', width: 15 },
      { header: 'Nom', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Date de naissance', key: 'birth_date', width: 20 },
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
        slack: row['Slack'],
        role: row['Rôle'],
        status: row['Statut'],
        created_at: row['Date d\'inscription']
      });
    });

    // Générer le nom du fichier avec la date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `membres_${group.name}_${dateStr}.xlsx`;

    // Sauvegarder le fichier
    
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

  async function handleSaveGroup() {
    setSaving(true);
    setMessage(null);
    
    const supabase = createClient();
    
    const { error } = await supabase
      .from('groups')
      .update({
        name: group.name,
        description: group.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', groupId);
    
    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
      console.error('Update error:', error);
    } else {
      setMessage({ type: 'success', text: 'Groupe mis à jour avec succès' });
    }
    
    setSaving(false);
  }

  async function handleAddMember() {
    if (!selectedMemberId) return;
    
    setAddingMember(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('user_groups')
      .insert({
        user_id: selectedMemberId,
        group_id: groupId
      });
    
    if (error) {
      console.error('Error adding member:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'ajout du membre' });
    } else {
      // Recharger les membres
      await loadCompleteGroupMembers();
      setShowAddMemberDialog(false);
      setSelectedMemberId('');
      setMessage({ type: 'success', text: 'Membre ajouté avec succès' });
      
      // Si le groupe a un canal Slack, ajouter le membre au canal
      if (group.slack_channel_id) {
        await addMemberToSlackChannel(selectedMemberId);
      }
    }
    
    setAddingMember(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce membre du groupe ?')) {
      return;
    }
    
    setRemovingMemberId(userId);
    const supabase = createClient();
    
    // Retirer de Slack d'abord si nécessaire
    if (group.slack_channel_id) {
      await removeMemberFromSlackChannel(userId);
    }
    
    const { error } = await supabase
      .from('user_groups')
      .delete()
      .eq('user_id', userId)
      .eq('group_id', groupId);
    
    if (error) {
      console.error('Error removing member:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression du membre' });
    } else {
      await loadCompleteGroupMembers();
      setMessage({ type: 'success', text: 'Membre retiré avec succès' });
    }
    
    setRemovingMemberId(null);
  }

  async function loadGroupMembers() {
    const supabase = createClient();
    
    // Récupérer d'abord les associations user_groups
    const { data: userGroupsData } = await supabase
      .from('user_groups')
      .select('user_id')
      .eq('group_id', groupId);
    
    if (userGroupsData && userGroupsData.length > 0) {
      // Récupérer ensuite les infos des membres
      const userIds = userGroupsData.map(ug => ug.user_id);
      const { data: membersData } = await supabase
        .from('members')
        .select('user_id, first_name, last_name, email, slack_user_id')
        .in('user_id', userIds);
      
      // Reconstruire la structure attendue
      const groupMembersData = userGroupsData.map(ug => ({
        user_id: ug.user_id,
        members: membersData?.find(m => m.user_id === ug.user_id) || null
      }));
      
      setGroupMembers(groupMembersData);
    } else {
      setGroupMembers([]);
    }
  }
  
  async function loadCompleteGroupMembers() {
    setLoading(true);
    const supabase = createClient();
    
    // Récupérer tous les membres d'abord
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (membersError) {
      console.error('Error loading members:', membersError);
      setMessage({ type: 'error', text: `Erreur: ${membersError.message}` });
      setLoading(false);
      return;
    }
    
    // Récupérer les associations user_groups pour ce groupe
    const { data: userGroupsData, error: userGroupsError } = await supabase
      .from('user_groups')
      .select('user_id, group_id')
      .eq('group_id', groupId);
    
    if (userGroupsError) {
      console.error('Error loading user_groups:', userGroupsError);
      setMessage({ type: 'error', text: `Erreur: ${userGroupsError.message}` });
      setLoading(false);
      return;
    }
    
    // Filtrer les membres qui appartiennent à ce groupe
    const groupMembersData = membersData?.filter(member => 
      userGroupsData?.some(ug => ug.user_id === member.user_id)
    ) || [];
    
    setAllMembersData(groupMembersData);
    setGroupMembers(groupMembersData);
    
    setLoading(false);
  }
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(filteredMembers.map(m => m.user_id));
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
    
    if (bulkAction === 'remove') {
      if (!confirm(`Êtes-vous sûr de vouloir retirer ${selectedMembers.length} membre(s) du groupe ?`)) {
        return;
      }
      
      setIsProcessing(true);
      const supabase = createClient();
      
      // Retirer de Slack d'abord si nécessaire
      if (group.slack_channel_id) {
        for (const userId of selectedMembers) {
          await removeMemberFromSlackChannel(userId);
        }
      }
      
      // Retirer les membres sélectionnés du groupe
      const { error } = await supabase
        .from('user_groups')
        .delete()
        .in('user_id', selectedMembers)
        .eq('group_id', groupId);
      
      if (!error) {
        await loadCompleteGroupMembers();
        setBulkAction('');
        setSelectedMembers([]);
        setMessage({ type: 'success', text: `${selectedMembers.length} membre(s) retiré(s) du groupe` });
      } else {
        setMessage({ type: 'error', text: 'Erreur lors du retrait des membres' });
      }
      
      setIsProcessing(false);
    }
  };

  async function handleCreateSlackChannel() {
    setCreatingChannel(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/slack/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: groupId,
          name: customChannelName || group.name
        })
      });
      
      if (response.ok) {
        const { channelId } = await response.json();
        setGroup({ ...group, slack_channel_id: channelId });
        setMessage({ type: 'success', text: 'Canal Slack créé avec succès' });
        
        // Ajouter tous les membres connectés à Slack au canal
        await syncSlackMembers();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Erreur lors de la création du canal' });
      }
    } catch (error) {
      console.error('Error creating Slack channel:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la création du canal' });
    }
    
    setCreatingChannel(false);
  }

  async function handleSyncSlackChannel() {
    if (!group.slack_channel_id) return;
    
    setSyncingSlack(true);
    
    try {
      const response = await fetch('/api/slack/channels/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: group.slack_channel_id,
          groupId: groupId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessage({ 
          type: 'success', 
          text: `Synchronisation terminée : ${data.added} membre(s) ajouté(s) au canal` 
        });
      } else {
        setMessage({ type: 'error', text: 'Erreur lors de la synchronisation' });
      }
    } catch (error) {
      console.error('Error syncing Slack channel:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la synchronisation' });
    }
    
    setSyncingSlack(false);
  }
  
  async function syncSlackMembers() {
    const slackMembers = groupMembers.filter(m => m.slack_user_id);
    
    if (slackMembers.length === 0) return;
    
    try {
      const response = await fetch('/api/slack/channels/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: group.slack_channel_id,
          userIds: slackMembers.map(m => m.slack_user_id),
          action: 'add'
        })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: `${slackMembers.length} membres ajoutés au canal Slack` });
      }
    } catch (error) {
      console.error('Error syncing Slack members:', error);
    }
  }

  async function addMemberToSlackChannel(userId: string) {
    if (!group.slack_channel_id) return;
    
    try {
      const response = await fetch('/api/slack/channels/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: group.slack_channel_id,
          userId: userId,
          groupId: groupId
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Error adding member to Slack channel:', error);
        // Si l'utilisateur n'est pas connecté à Slack, c'est normal
        if (error.error !== 'User not connected to Slack') {
          setMessage({ type: 'error', text: 'Erreur lors de l\'ajout au canal Slack' });
        }
      }
    } catch (error) {
      console.error('Error adding member to Slack channel:', error);
    }
  }

  async function removeMemberFromSlackChannel(userId: string) {
    if (!group.slack_channel_id) return;
    
    try {
      const response = await fetch('/api/slack/channels/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: group.slack_channel_id,
          userId: userId,
          groupId: groupId
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Error removing member from Slack channel:', error);
        // Si l'utilisateur n'est pas connecté à Slack, c'est normal
        if (error.error !== 'User not connected to Slack') {
          setMessage({ type: 'error', text: 'Erreur lors du retrait du canal Slack' });
        }
      }
    } catch (error) {
      console.error('Error removing member from Slack channel:', error);
    }
  }

  // Filtrer les membres disponibles pour l'ajout
  const availableMembers = allMembers.filter(
    m => !groupMembers.some(gm => gm.user_id === m.user_id)
  );
  
  // Filtrer les membres affichés
  const filteredMembers = useMemo(() => {
    let filtered = allMembersData;
    
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
    
    return filtered;
  }, [allMembersData, searchTerm, filterSlack, filterRole, filterStatus]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin?tab=groups">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux groupes
            </Button>
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900">Modifier le groupe</h1>
          <p className="text-gray-600 mt-2">
            Gérez les informations et les membres du groupe
          </p>
        </div>
        
        {/* Success/Error Message */}
        {message && (
          <Alert className={`mb-6 ${
            message.type === 'success' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
        
        {/* Group Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Informations du groupe</CardTitle>
            <CardDescription>
              Modifiez le nom et la description du groupe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nom du groupe</Label>
                <Input
                  id="name"
                  value={group.name}
                  onChange={(e) => setGroup({ ...group, name: e.target.value })}
                  disabled={saving}
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={group.description || ''}
                  onChange={(e) => setGroup({ ...group, description: e.target.value })}
                  disabled={saving}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleSaveGroup} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Slack Integration */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Canal Slack
            </CardTitle>
            <CardDescription>
              Gérez le canal Slack associé à ce groupe
            </CardDescription>
          </CardHeader>
          <CardContent>
            {group.slack_channel_id ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Hash className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Canal actif</p>
                      <p className="text-sm text-green-700">ID: {group.slack_channel_id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncSlackChannel}
                      disabled={syncingSlack}
                      title="Synchroniser tous les membres avec le canal Slack"
                    >
                      {syncingSlack ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`slack://channel?team=${process.env.NEXT_PUBLIC_SLACK_TEAM_ID}&id=${group.slack_channel_id}`, '_blank')}
                    >
                      Ouvrir dans Slack
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Les membres connectés à Slack sont automatiquement ajoutés/retirés du canal.
                  Utilisez le bouton de synchronisation si nécessaire.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Aucun canal Slack n'est associé à ce groupe
                  </p>
                </div>
                {group.name.toLowerCase() === 'public' ? (
                  <Alert className="bg-blue-50 border-blue-200">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Le groupe public utilise le canal #tous-nous-parisiens imposé par Slack.
                      Pour l'associer, utilisez l'ID du canal dans la base de données.
                    </AlertDescription>
                  </Alert>
                ) : slackFeatures?.canManageChannels ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="channel-name">Nom du canal Slack</Label>
                      <Input
                        id="channel-name"
                        type="text"
                        placeholder={group.name.toLowerCase().replace(/\s+/g, '-')}
                        value={customChannelName}
                        onChange={(e) => setCustomChannelName(e.target.value)}
                        disabled={creatingChannel}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Laissez vide pour utiliser le nom du groupe
                      </p>
                    </div>
                    <Button onClick={handleCreateSlackChannel} disabled={creatingChannel} className="w-full">
                      {creatingChannel ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Création...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Créer le canal
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      La création de canaux nécessite les permissions appropriées dans Slack
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Members */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Membres du groupe</CardTitle>
                  <CardDescription>
                    {filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''} 
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => loadCompleteGroupMembers()}
                    disabled={loading}
                    title="Actualiser"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={exportToExcel}
                    disabled={filteredMembers.length === 0}
                    title="Exporter XLS"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setShowAddMemberDialog(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Ajouter
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
                      <SelectItem value="remove">Retirer du groupe</SelectItem>
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
                        checked={filteredMembers.length > 0 && selectedMembers.length === filteredMembers.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Membre</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Inscrit le</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Aucun membre trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedMembers.includes(member.user_id)}
                            onCheckedChange={(checked) => handleSelectMember(member.user_id, checked as boolean)}
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
                            onClick={() => handleRemoveMember(member.user_id)}
                            disabled={removingMemberId === member.user_id}
                          >
                            {removingMemberId === member.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserMinus className="h-4 w-4" />
                            )}
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
        
        {/* Add Member Dialog */}
        <Dialog open={showAddMemberDialog} onOpenChange={(open) => {
          setShowAddMemberDialog(open);
          if (!open) {
            setSelectedMemberId(''); // Reset selection when closing
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un membre au groupe</DialogTitle>
              <DialogDescription>
                Recherchez et sélectionnez un membre à ajouter à ce groupe
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <MemberSearchSelect
                members={availableMembers}
                onSelect={setSelectedMemberId}
                value={selectedMemberId}
                placeholder="Rechercher par nom ou email..."
              />
              {selectedMemberId && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Membre sélectionné: {availableMembers.find(m => m.user_id === selectedMemberId)?.first_name} {availableMembers.find(m => m.user_id === selectedMemberId)?.last_name}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMemberDialog(false)} disabled={addingMember}>
                Annuler
              </Button>
              <Button onClick={handleAddMember} disabled={!selectedMemberId || addingMember}>
                {addingMember ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ajout...
                  </>
                ) : (
                  'Ajouter'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </div>
  );
}