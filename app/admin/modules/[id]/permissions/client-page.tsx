'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { 
  ArrowLeft,
  Settings, 
  Loader2,
  AlertCircle,
  Eye,
  Edit,
  Users,
  Info
} from 'lucide-react';
import { AdminNav } from '@/components/admin-nav';
import { Footer } from '@/components/footer';
import { Module, ModuleDataPermission } from '@/lib/types/modules';

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface ModulePermissionsPageProps {
  module: Module;
  groups: Group[];
  existingPermissions: ModuleDataPermission[];
}

interface PermissionMatrix {
  [sourceGroupId: string]: {
    [targetGroupId: string]: {
      [permission: string]: boolean;
    };
  };
}

const PERMISSION_TYPES = [
  { value: 'read', label: 'Lecture', icon: Eye, color: 'text-green-600' },
  { value: 'write', label: 'Écriture', icon: Edit, color: 'text-blue-600' }
];

export default function ModulePermissionsPage({ 
  module, 
  groups, 
  existingPermissions 
}: ModulePermissionsPageProps) {
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    buildPermissionMatrix();
  }, [existingPermissions]);

  const buildPermissionMatrix = () => {
    const matrix: PermissionMatrix = {};
    
    // Initialiser la matrice pour tous les groupes
    groups.forEach(sourceGroup => {
      matrix[sourceGroup.id] = {};
      groups.forEach(targetGroup => {
        matrix[sourceGroup.id][targetGroup.id] = {
          read: false,
          write: false
        };
      });
    });

    // Remplir avec les permissions existantes
    existingPermissions.forEach(permission => {
      if (matrix[permission.source_group_id] && matrix[permission.source_group_id][permission.target_group_id]) {
        matrix[permission.source_group_id][permission.target_group_id][permission.permission_type] = true;
      }
    });

    setPermissionMatrix(matrix);
  };

  const updatePermission = async (
    sourceGroupId: string,
    targetGroupId: string,
    permissionType: string,
    granted: boolean
  ) => {
    setSaving(true);
    const supabase = createClient();

    try {
      if (granted) {
        // Ajouter la permission
        const { error } = await supabase
          .from('module_data_permissions')
          .insert({
            module_id: module.id,
            source_group_id: sourceGroupId,
            target_group_id: targetGroupId,
            permission_type: permissionType
          });

        if (error) throw error;
      } else {
        // Supprimer la permission
        const { error } = await supabase
          .from('module_data_permissions')
          .delete()
          .eq('module_id', module.id)
          .eq('source_group_id', sourceGroupId)
          .eq('target_group_id', targetGroupId)
          .eq('permission_type', permissionType);

        if (error) throw error;
      }

      // Mettre à jour l'état local
      setPermissionMatrix(prev => ({
        ...prev,
        [sourceGroupId]: {
          ...prev[sourceGroupId],
          [targetGroupId]: {
            ...prev[sourceGroupId][targetGroupId],
            [permissionType]: granted
          }
        }
      }));

      setMessage({ type: 'success', text: 'Permission mise à jour avec succès' });
    } catch (error) {
      console.error('Error updating permission:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour de la permission' });
    } finally {
      setSaving(false);
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

  const getGroupBadge = (group: Group) => {
    return (
      <Badge variant="outline" className="text-xs">
        <Users className="h-3 w-3 mr-1" />
        {group.name}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin?tab=modules">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux modules
            </Button>
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <span className="text-3xl">{getModuleIcon(module.icon)}</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Permissions du module {module.display_name}
              </h1>
              <p className="text-gray-600 mt-1">
                {module.description}
              </p>
            </div>
          </div>
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


        {/* Permissions Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Matrice de permissions entre groupes</CardTitle>
            <CardDescription>
              Définissez qui peut accéder à toutes les données créées par chaque groupe dans ce module
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Comment lire cette matrice :</p>
                    <p>• <strong>Lignes</strong> : Groupes qui créent les données</p>
                    <p>• <strong>Colonnes</strong> : Groupes qui peuvent accéder aux données</p>
                    <p>• <strong>Exemple</strong> : Si Bureau crée du contenu, cochez les cases pour définir qui peut le lire/modifier</p>
                  </div>
                </div>
              </div>

              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Créé par ↓</div>
                        <div className="text-xs text-gray-500">Accessible à →</div>
                      </div>
                    </TableHead>
                    {groups.map(targetGroup => (
                      <TableHead key={targetGroup.id} className="text-center min-w-[120px]">
                        <div className="space-y-1">
                          <div className="font-medium text-xs">{targetGroup.name}</div>
                          <div className="flex justify-center gap-1">
                            {PERMISSION_TYPES.map(permType => {
                              const Icon = permType.icon;
                              return (
                                <div key={permType.value} className="text-center">
                                  <Icon className={`h-3 w-3 ${permType.color}`} title={permType.label} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(sourceGroup => (
                    <TableRow key={sourceGroup.id}>
                      <TableCell className="font-medium bg-gray-50">
                        <div className="text-sm">{sourceGroup.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {sourceGroup.description}
                        </div>
                      </TableCell>
                      {groups.map(targetGroup => (
                        <TableCell key={targetGroup.id} className="text-center">
                          <div className="flex justify-center gap-2">
                            {PERMISSION_TYPES.map(permType => (
                              <Checkbox
                                key={permType.value}
                                checked={permissionMatrix[sourceGroup.id]?.[targetGroup.id]?.[permType.value] || false}
                                onCheckedChange={(checked) => 
                                  updatePermission(
                                    sourceGroup.id, 
                                    targetGroup.id, 
                                    permType.value, 
                                    checked as boolean
                                  )
                                }
                                disabled={saving}
                                className="data-[state=checked]:bg-blue-600"
                                title={`${permType.label} - ${sourceGroup.name} → ${targetGroup.name}`}
                              />
                            ))}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {saving && (
              <div className="flex items-center justify-center mt-4 p-4 bg-blue-50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                <span className="text-sm text-blue-800">Sauvegarde en cours...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="mt-6 bg-gray-50">
          <CardHeader>
            <CardTitle className="text-lg">Légende des permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PERMISSION_TYPES.map(permType => {
                const Icon = permType.icon;
                return (
                  <div key={permType.value} className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${permType.color}`} />
                    <div>
                      <p className="font-medium text-sm">{permType.label}</p>
                      <p className="text-xs text-gray-500">
                        {permType.value === 'read' && 'Peut voir et consulter les données'}
                        {permType.value === 'write' && 'Peut modifier, créer et supprimer les données'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
}