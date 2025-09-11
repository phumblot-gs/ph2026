'use client';

import { useState, useEffect } from 'react';
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
  Check,
  X,
  Eye,
  Edit,
  Shield
} from 'lucide-react';
import { Module, GroupModule } from '@/lib/types/modules';

interface GroupModulesPermissionsProps {
  groupId: string;
  onMessage: (message: { type: 'success' | 'error', text: string }) => void;
}

export default function GroupModulesPermissions({ groupId, onMessage }: GroupModulesPermissionsProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [groupModules, setGroupModules] = useState<GroupModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadModulesData();
  }, [groupId]);

  const loadModulesData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Charger tous les modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('sort_order');

      if (modulesError) {
        throw modulesError;
      }

      // Charger les permissions du groupe pour ces modules
      const { data: groupModulesData, error: groupModulesError } = await supabase
        .from('group_modules')
        .select('*')
        .eq('group_id', groupId);

      if (groupModulesError) {
        throw groupModulesError;
      }

      setModules(modulesData || []);
      setGroupModules(groupModulesData || []);
    } catch (error) {
      console.error('Error loading modules data:', error);
      onMessage({ type: 'error', text: 'Erreur lors du chargement des modules' });
    } finally {
      setLoading(false);
    }
  };

  const getGroupModulePermissions = (moduleId: string): GroupModule | null => {
    return groupModules.find(gm => gm.module_id === moduleId) || null;
  };

  const updateModulePermission = async (
    moduleId: string, 
    permission: 'can_read' | 'can_write' | 'can_admin', 
    value: boolean
  ) => {
    setSaving(`${moduleId}-${permission}`);
    const supabase = createClient();

    try {
      const existingPermission = getGroupModulePermissions(moduleId);

      if (existingPermission) {
        // Mettre à jour les permissions existantes
        const { error } = await supabase
          .from('group_modules')
          .update({ [permission]: value })
          .eq('id', existingPermission.id);

        if (error) throw error;

        // Mettre à jour l'état local
        setGroupModules(prev => 
          prev.map(gm => 
            gm.id === existingPermission.id 
              ? { ...gm, [permission]: value }
              : gm
          )
        );
      } else {
        // Créer de nouvelles permissions
        const newPermission = {
          group_id: groupId,
          module_id: moduleId,
          can_read: permission === 'can_read' ? value : false,
          can_write: permission === 'can_write' ? value : false,
          can_admin: permission === 'can_admin' ? value : false,
        };

        const { data, error } = await supabase
          .from('group_modules')
          .insert(newPermission)
          .select()
          .single();

        if (error) throw error;

        // Ajouter à l'état local
        setGroupModules(prev => [...prev, data]);
      }

      onMessage({ type: 'success', text: 'Permissions mises à jour avec succès' });
    } catch (error) {
      console.error('Error updating module permission:', error);
      onMessage({ type: 'error', text: 'Erreur lors de la mise à jour des permissions' });
    } finally {
      setSaving(null);
    }
  };

  const removeModuleAccess = async (moduleId: string) => {
    setSaving(`${moduleId}-remove`);
    const supabase = createClient();

    try {
      const existingPermission = getGroupModulePermissions(moduleId);
      if (existingPermission) {
        const { error } = await supabase
          .from('group_modules')
          .delete()
          .eq('id', existingPermission.id);

        if (error) throw error;

        // Supprimer de l'état local
        setGroupModules(prev => prev.filter(gm => gm.id !== existingPermission.id));
        onMessage({ type: 'success', text: 'Accès au module supprimé' });
      }
    } catch (error) {
      console.error('Error removing module access:', error);
      onMessage({ type: 'error', text: 'Erreur lors de la suppression de l\'accès' });
    } finally {
      setSaving(null);
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

  const getStatusBadge = (module: Module, permissions: GroupModule | null) => {
    if (!permissions) {
      return <Badge variant="outline" className="text-gray-500">Aucun accès</Badge>;
    }

    if (permissions.can_admin) {
      return <Badge className="bg-red-100 text-red-800"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    }

    if (permissions.can_write) {
      return <Badge className="bg-blue-100 text-blue-800"><Edit className="h-3 w-3 mr-1" />Lecture/Écriture</Badge>;
    }

    if (permissions.can_read) {
      return <Badge className="bg-green-100 text-green-800"><Eye className="h-3 w-3 mr-1" />Lecture seule</Badge>;
    }

    return <Badge variant="outline" className="text-gray-500">Aucun accès</Badge>;
  };

  if (loading) {
    return (
      <Card className="mb-8">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Permissions des modules
        </CardTitle>
        <CardDescription>
          Définissez l'accès de ce groupe aux différents modules de l'application
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
                  <TableHead className="text-center">Lecture</TableHead>
                  <TableHead className="text-center">Écriture</TableHead>
                  <TableHead className="text-center">Administration</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((module) => {
                  const permissions = getGroupModulePermissions(module.id);
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
                            {!module.is_active && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Inactif
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(module, permissions)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={permissions?.can_read || false}
                          onCheckedChange={(checked) => updateModulePermission(module.id, 'can_read', checked)}
                          disabled={saving === `${module.id}-can_read`}
                        />
                        {saving === `${module.id}-can_read` && (
                          <Loader2 className="h-3 w-3 animate-spin ml-2" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={permissions?.can_write || false}
                          onCheckedChange={(checked) => updateModulePermission(module.id, 'can_write', checked)}
                          disabled={saving === `${module.id}-can_write` || !permissions?.can_read}
                        />
                        {saving === `${module.id}-can_write` && (
                          <Loader2 className="h-3 w-3 animate-spin ml-2" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={permissions?.can_admin || false}
                          onCheckedChange={(checked) => updateModulePermission(module.id, 'can_admin', checked)}
                          disabled={saving === `${module.id}-can_admin` || !permissions?.can_write}
                        />
                        {saving === `${module.id}-can_admin` && (
                          <Loader2 className="h-3 w-3 animate-spin ml-2" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {permissions && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeModuleAccess(module.id)}
                            disabled={saving === `${module.id}-remove`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {saving === `${module.id}-remove` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Hiérarchie des permissions</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Lecture</strong> : Permet de voir le module et son contenu</li>
            <li>• <strong>Écriture</strong> : Permet de créer/modifier du contenu (requiert Lecture)</li>
            <li>• <strong>Administration</strong> : Permet de gérer les paramètres du module (requiert Écriture)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}