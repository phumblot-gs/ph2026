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
  FileSpreadsheet,
  Pencil
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

export default function MembersTab() {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    loadMembers();
  }, [searchTerm]);
  
  async function loadMembers() {
    setLoading(true);
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      let filtered = data;
      if (searchTerm) {
        filtered = data.filter(m => 
          m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setMembers(filtered);
    }
    
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
      'Adresse': member.address_line1 || '',
      'Complément': member.address_line2 || '',
      'Code postal': member.postal_code || '',
      'Ville': member.city || '',
      'Pays': member.country || '',
      'Rôle': member.role || 'member',
      'Statut': member.status || 'active',
      'Date d\'inscription': new Date(member.created_at).toLocaleDateString('fr-FR'),
    }));

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membres');

    // Generate filename with current date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `membres_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
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
            <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={loadMembers}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={members.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exporter XLS
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
                <TableHead>Adresse</TableHead>
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
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-semibold text-blue-600">
                            {member.first_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {member.first_name} {member.last_name}
                          </p>
                          {member.birth_date && (
                            <p className="text-xs text-gray-500">
                              Né(e) le {new Date(member.birth_date).toLocaleDateString('fr-FR')}
                            </p>
                          )}
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
                      {member.city ? (
                        <div className="flex items-center text-sm">
                          <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                          {member.postal_code} {member.city}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Non renseignée</span>
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