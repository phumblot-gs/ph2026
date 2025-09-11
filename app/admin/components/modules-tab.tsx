'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { 
  Settings, 
  Loader2,
  AlertCircle,
  Eye,
  Edit,
  Shield,
  Users,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { Module } from '@/lib/types/modules';

export default function ModulesTab() {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [moduleStats, setModuleStats] = useState<Record<string, { groups: number; users: number }>>({});

  useEffect(() => {
    loadModules();
    loadModuleStats();
  }, []);

  const loadModules = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error loading modules:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des modules' });
    } finally {
      setLoading(false);
    }
  };

  const loadModuleStats = async () => {
    const supabase = createClient();

    try {
      // Compter les groupes par module
      const { data: groupStats, error: groupError } = await supabase
        .from('group_modules')
        .select('module_id, group_id')
        .eq('can_read', true);

      if (groupError) throw groupError;

      // Compter les utilisateurs par groupe de chaque module
      const stats: Record<string, { groups: number; users: number }> = {};
      
      for (const moduleItem of modules) {
        const moduleGroups = groupStats?.filter(gs => gs.module_id === moduleItem.id) || [];
        stats[moduleItem.id] = {
          groups: moduleGroups.length,
          users: 0
        };

        // Compter les utilisateurs dans ces groupes
        if (moduleGroups.length > 0) {
          const groupIds = moduleGroups.map(g => g.group_id);
          const { data: userCounts } = await supabase
            .from('user_groups')
            .select('user_id')
            .in('group_id', groupIds);
          
          // Dédupliquer les utilisateurs (un utilisateur peut être dans plusieurs groupes)
          const uniqueUsers = new Set(userCounts?.map(uc => uc.user_id) || []);
          stats[module.id].users = uniqueUsers.size;
        }
      }

      setModuleStats(stats);
    } catch (error) {
      console.error('Error loading module stats:', error);
    }
  };

  const toggleModuleStatus = async (moduleId: string, newStatus: boolean) => {
    setUpdating(moduleId);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('modules')
        .update({ is_active: newStatus })
        .eq('id', moduleId);

      if (error) throw error;

      // Mettre à jour l'état local
      setModules(prev => prev.map(m => 
        m.id === moduleId ? { ...m, is_active: newStatus } : m
      ));

      setMessage({ 
        type: 'success', 
        text: `Module ${newStatus ? 'activé' : 'désactivé'} avec succès` 
      });
    } catch (error) {
      console.error('Error updating module status:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour du module' });
    } finally {
      setUpdating(null);
    }
  };

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'message-square':
        return '💬';
      case 'calendar':
        return '📅';
      case 'file-text':
        return '📄';
      case 'eye':
        return '👁️';
      case 'megaphone':
        return '📢';
      default:
        return '🔧';
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? <Badge className="bg-green-100 text-green-800">Actif</Badge>
      : <Badge variant="outline" className="text-gray-500">Inactif</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Message */}
      {message && (
        <Alert className={`${message.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gestion des modules</h2>
        <p className="text-gray-600 mt-2">
          Gérez les modules de l'application et leurs permissions entre groupes
        </p>
      </div>

      {/* Modules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Modules disponibles</CardTitle>
          <CardDescription>
            Liste des modules avec leur statut et statistiques d'usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Aucun module disponible dans le système
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Groupes</TableHead>
                    <TableHead className="text-center">Utilisateurs</TableHead>
                    <TableHead className="text-center">Actif</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => {
                    const stats = moduleStats[module.id] || { groups: 0, users: 0 };
                    return (
                      <TableRow key={module.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl" title={module.icon}>
                              {getModuleIcon(module.icon)}
                            </span>
                            <div>
                              <p className="font-medium">{module.display_name}</p>
                              <p className="text-sm text-gray-500">{module.description}</p>
                              <p className="text-xs text-gray-400">Ordre: {module.sort_order}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(module.is_active)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{stats.groups}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <BarChart3 className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{stats.users}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={module.is_active}
                            onCheckedChange={(checked) => toggleModuleStatus(module.id, checked)}
                            disabled={updating === module.id}
                          />
                          {updating === module.id && (
                            <Loader2 className="h-3 w-3 animate-spin ml-2" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/modules/${module.id}/permissions`)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Permissions
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Guide d'utilisation</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 text-sm space-y-2">
          <p>• <strong>Actif/Inactif</strong> : Contrôle la visibilité du module dans la navigation</p>
          <p>• <strong>Groupes</strong> : Nombre de groupes ayant accès au module</p>
          <p>• <strong>Utilisateurs</strong> : Nombre d'utilisateurs ayant accès via leurs groupes</p>
          <p>• <strong>Permissions</strong> : Cliquez pour gérer les permissions entre groupes au niveau des données</p>
        </CardContent>
      </Card>
    </div>
  );
}