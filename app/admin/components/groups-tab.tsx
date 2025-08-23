'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Search, Download, Plus, Edit, MoreHorizontal, Users, MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { utils, writeFile } from 'xlsx';

interface Group {
  id: string;
  name: string;
  description: string | null;
  slack_channel_id: string | null;
  created_at: string;
  members_count: number;
}

export default function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSlack, setFilterSlack] = useState<'all' | 'connected' | 'not_connected'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    const supabase = createClient();
    
    // Récupérer tous les groupes avec le nombre de membres
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        user_groups (count)
      `)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading groups:', error);
    } else if (data) {
      // Transformer les données pour inclure le comptage
      const groupsWithCount = await Promise.all(data.map(async (group) => {
        const { count } = await supabase
          .from('user_groups')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);
        
        return {
          ...group,
          members_count: count || 0
        };
      }));
      
      setGroups(groupsWithCount);
    }
    
    setLoading(false);
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return;
    
    setAddingGroup(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('groups')
      .insert({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null
      });

    if (error) {
      console.error('Error adding group:', error);
      alert('Erreur lors de l\'ajout du groupe');
    } else {
      await loadGroups();
      setShowAddDialog(false);
      setNewGroupName('');
      setNewGroupDescription('');
    }
    
    setAddingGroup(false);
  }

  async function exportToExcel() {
    const exportData = filteredGroups.map(group => ({
      'Nom': group.name,
      'Description': group.description || '',
      'Nombre de membres': group.members_count,
      'Canal Slack': group.slack_channel_id ? 'Oui' : 'Non',
      'Date de création': new Date(group.created_at).toLocaleDateString('fr-FR')
    }));

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Groupes');
    
    const fileName = `groupes_${new Date().toISOString().split('T')[0]}.xlsx`;
    writeFile(wb, fileName);
  }

  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (group.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      
      let matchesSlack = true;
      if (filterSlack === 'connected') {
        matchesSlack = !!group.slack_channel_id;
      } else if (filterSlack === 'not_connected') {
        matchesSlack = !group.slack_channel_id;
      }
      
      return matchesSearch && matchesSlack;
    });
  }, [groups, searchTerm, filterSlack]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestion des groupes</CardTitle>
              <CardDescription>
                {filteredGroups.length} groupe{filteredGroups.length > 1 ? 's' : ''} trouvé{filteredGroups.length > 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={loadGroups}
                title="Actualiser"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={exportToExcel}
                title="Exporter XLS"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau groupe
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Rechercher un groupe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterSlack} onValueChange={(value: any) => setFilterSlack(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrer par Slack" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les groupes</SelectItem>
                <SelectItem value="connected">Avec canal Slack</SelectItem>
                <SelectItem value="not_connected">Sans canal Slack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Groups Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Membres</TableHead>
                  <TableHead className="text-center">Canal Slack</TableHead>
                  <TableHead>Date création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      Aucun groupe trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell className="text-gray-600">
                        {group.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          <Users className="h-3 w-3 mr-1" />
                          {group.members_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {group.slack_channel_id ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Connecté
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            Non connecté
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {new Date(group.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/groups/${group.id}`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Group Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau groupe</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau groupe à l'application. Les membres pourront ensuite y être assignés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="group-name">Nom du groupe</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Arrondissement 15"
                disabled={addingGroup}
              />
            </div>
            <div>
              <Label htmlFor="group-description">Description (optionnel)</Label>
              <Input
                id="group-description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Description du groupe..."
                disabled={addingGroup}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={addingGroup}>
              Annuler
            </Button>
            <Button onClick={handleAddGroup} disabled={!newGroupName.trim() || addingGroup}>
              {addingGroup ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer le groupe'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}