'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Save, 
  Plus, 
  Trash2, 
  Edit2,
  Euro,
  Settings,
  Mail,
  AlertCircle,
  CheckCircle,
  GripVertical,
  MessageSquare
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable row component
function SortableRow({ example, editingExample, setEditingExample, updateDonationExample, deleteDonationExample }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: example.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      {editingExample?.id === example.id ? (
        <>
          <TableCell>
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" {...attributes} {...listeners} />
              {/* <Input
                type="number"
                value={editingExample.display_order}
                onChange={(e) => setEditingExample({ 
                  ...editingExample, 
                  display_order: parseInt(e.target.value) 
                })}
                className="w-16"
              /> */}
            </div>
          </TableCell>
          <TableCell>
            <Input
              type="number"
              value={editingExample.amount}
              onChange={(e) => setEditingExample({ 
                ...editingExample, 
                amount: parseFloat(e.target.value) 
              })}
              className="w-24"
            />
          </TableCell>
          <TableCell>
            <Input
              type="text"
              value={editingExample.title}
              onChange={(e) => setEditingExample({ 
                ...editingExample, 
                title: e.target.value 
              })}
            />
          </TableCell>
          <TableCell>
            <Input
              type="text"
              value={editingExample.description || ''}
              onChange={(e) => setEditingExample({ 
                ...editingExample, 
                description: e.target.value 
              })}
            />
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateDonationExample(example.id, editingExample)}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingExample(null)}
              >
                Annuler
              </Button>
            </div>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell>
            <div className="flex items-center gap-2">
              <GripVertical 
                className="h-4 w-4 text-gray-400 cursor-grab active:cursor-grabbing" 
                {...attributes} 
                {...listeners} 
              />
              {/* <span>{example.display_order}</span> */}
            </div>
          </TableCell>
          <TableCell className="font-semibold">{example.amount}€</TableCell>
          <TableCell>{example.title}</TableCell>
          <TableCell className="text-sm text-gray-600">
            {example.description || '-'}
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingExample(example)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteDonationExample(example.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </TableCell>
        </>
      )}
    </TableRow>
  );
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<any>({});
  const [donationExamples, setDonationExamples] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingExample, setEditingExample] = useState<any>(null);
  const [newExample, setNewExample] = useState({
    amount: '',
    title: '',
    description: '',
    display_order: 0
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  useEffect(() => {
    loadSettings();
    loadDonationExamples();
  }, []);
  
  async function loadSettings() {
    const supabase = createClient();
    const { data } = await supabase
      .from('app_settings')
      .select('*');
    
    if (data) {
      const settingsMap: any = {};
      data.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setSettings(settingsMap);
    }
  }
  
  async function loadDonationExamples() {
    const supabase = createClient();
    const { data } = await supabase
      .from('app_settings_donation')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (data) {
      setDonationExamples(data);
    }
  }
  
  async function saveAllSettings() {
    setSaving(true);
    const supabase = createClient();
    
    try {
      // Get existing settings to know which ones to update vs insert
      const { data: existingSettings } = await supabase
        .from('app_settings')
        .select('setting_key');
      
      const existingKeys = new Set(existingSettings?.map(s => s.setting_key) || []);
      
      // Process each setting
      for (const [key, value] of Object.entries(settings)) {
        let error;
        
        if (existingKeys.has(key)) {
          // Update existing setting
          const result = await supabase
            .from('app_settings')
            .update({ 
              setting_value: value as string,
              updated_at: new Date().toISOString()
            })
            .eq('setting_key', key);
          error = result.error;
        } else {
          // Insert new setting
          const result = await supabase
            .from('app_settings')
            .insert({ 
              setting_key: key,
              setting_value: value as string,
              updated_at: new Date().toISOString()
            });
          error = result.error;
        }
        
        if (error) {
          console.error(`Error saving ${key}:`, error);
          setMessage({ type: 'error', text: `Erreur lors de la sauvegarde de ${key}` });
          setSaving(false);
          setTimeout(() => setMessage(null), 3000);
          return;
        }
      }
      
      setMessage({ type: 'success', text: 'Paramètres sauvegardés' });
      await loadSettings(); // Reload to ensure consistency
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    }
    
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }
  
  async function addDonationExample() {
    if (!newExample.amount || !newExample.title) return;
    
    // Calculate the next display_order as max + 1
    const maxOrder = donationExamples.reduce((max, example) => 
      Math.max(max, example.display_order || 0), 0
    );
    
    const supabase = createClient();
    const { error } = await supabase
      .from('app_settings_donation')
      .insert({
        amount: parseFloat(newExample.amount),
        title: newExample.title,
        description: newExample.description,
        display_order: maxOrder + 1,
        is_active: true
      });
    
    if (!error) {
      loadDonationExamples();
      setNewExample({ amount: '', title: '', description: '', display_order: 0 });
      setMessage({ type: 'success', text: 'Exemple ajouté' });
      setTimeout(() => setMessage(null), 3000);
    }
  }
  
  async function updateDonationExample(id: string, updates: any) {
    const supabase = createClient();
    const { error } = await supabase
      .from('app_settings_donation')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (!error) {
      loadDonationExamples();
      setEditingExample(null);
      setMessage({ type: 'success', text: 'Exemple mis à jour' });
      setTimeout(() => setMessage(null), 3000);
    }
  }
  
  async function deleteDonationExample(id: string) {
    if (!confirm('Supprimer cet exemple de don ?')) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from('app_settings_donation')
      .delete()
      .eq('id', id);
    
    if (!error) {
      loadDonationExamples();
      setMessage({ type: 'success', text: 'Exemple supprimé' });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = donationExamples.findIndex((item) => item.id === active.id);
      const newIndex = donationExamples.findIndex((item) => item.id === over?.id);

      const reorderedExamples = arrayMove(donationExamples, oldIndex, newIndex);
      
      // Update display_order for all items
      const updatedExamples = reorderedExamples.map((item, index) => ({
        ...item,
        display_order: index + 1
      }));
      
      setDonationExamples(updatedExamples);

      // Update all items in database
      const supabase = createClient();
      const updates = updatedExamples.map(item => 
        supabase
          .from('app_settings_donation')
          .update({ 
            display_order: item.display_order,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
      );

      await Promise.all(updates);
      setMessage({ type: 'success', text: 'Ordre mis à jour' });
      setTimeout(() => setMessage(null), 3000);
    }
  }
  
  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Success/Error Message */}
      {message && (
        <div className={`flex items-center p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2" />
          )}
          {message.text}
        </div>
      )}
      
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Paramètres généraux
          </CardTitle>
          <CardDescription>
            Configuration globale du système de dons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" suppressHydrationWarning>
            <div>
              <Label htmlFor="support_email">Email de support</Label>
              <Input
                id="support_email"
                type="email"
                value={settings.support_email || ''}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                placeholder="support@exemple.fr"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="website_url">URL du site web</Label>
              <Input
                id="website_url"
                type="url"
                value={settings.website_url || ''}
                onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
                placeholder="https://exemple.fr"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="highlight_url">URL mise en avant</Label>
              <Input
                id="highlight_url"
                type="url"
                value={settings.highlight_url || ''}
                onChange={(e) => setSettings({ ...settings, highlight_url: e.target.value })}
                placeholder="https://site-externe.fr"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="donation_yearly_limit">Plafond annuel (€)</Label>
              <Input
                id="donation_yearly_limit"
                type="number"
                value={settings.donation_yearly_limit || '7500'}
                onChange={(e) => setSettings({ ...settings, donation_yearly_limit: e.target.value })}
                placeholder="7500"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="donation_minimum_age">Âge minimum</Label>
              <Input
                id="donation_minimum_age"
                type="number"
                value={settings.donation_minimum_age || '18'}
                onChange={(e) => setSettings({ ...settings, donation_minimum_age: e.target.value })}
                placeholder="18"
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button
              onClick={saveAllSettings}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Enregistrer les paramètres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Slack Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Configuration Slack
          </CardTitle>
          <CardDescription>
            Paramètres d'intégration avec Slack
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="slack_bot_token">Token du Bot Slack</Label>
              <Input
                id="slack_bot_token"
                type="password"
                value={settings.slack_bot_token || ''}
                onChange={(e) => setSettings({ ...settings, slack_bot_token: e.target.value })}
                placeholder="xoxb-..."
                className="mt-1 font-mono"
              />
              <div className="mt-2 text-sm text-gray-600 space-y-1">
                <p>Pour obtenir le token du bot :</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Allez sur <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">api.slack.com/apps</a></li>
                  <li>Sélectionnez votre application</li>
                  <li>Allez dans "OAuth & Permissions"</li>
                  <li>Copiez le "Bot User OAuth Token" (commence par xoxb-)</li>
                </ol>
              </div>
            </div>
            
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Important :</strong> Assurez-vous que le bot a les scopes suivants :
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <code className="px-1 py-0.5 bg-yellow-100 rounded">channels:history</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">channels:join</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">channels:read</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">chat:write</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">chat:write.public</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">files:read</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">files:write</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">groups:history</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">groups:read</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">im:history</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">im:read</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">mpim:history</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">mpim:read</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">users:read</code>
                <code className="px-1 py-0.5 bg-yellow-100 rounded">users:read.email</code>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button
              onClick={saveAllSettings}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Enregistrer les paramètres
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Donation Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Euro className="h-5 w-5 mr-2" />
            Exemples de dons
          </CardTitle>
          <CardDescription>
            Gérez les montants suggérés sur la page de don (glissez-déposez pour réorganiser)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add new example form */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg" suppressHydrationWarning>
            <h3 className="font-medium mb-3">Ajouter un exemple</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3" suppressHydrationWarning>
              <Input
                type="number"
                placeholder="Montant (€)"
                value={newExample.amount}
                onChange={(e) => setNewExample({ ...newExample, amount: e.target.value })}
              />
              <Input
                type="text"
                placeholder="Titre"
                value={newExample.title}
                onChange={(e) => setNewExample({ ...newExample, title: e.target.value })}
              />
              <Input
                type="text"
                placeholder="Description"
                value={newExample.description}
                onChange={(e) => setNewExample({ ...newExample, description: e.target.value })}
              />
              <Button onClick={addDonationExample}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
          
          {/* Examples table with drag and drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordre</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={donationExamples.map(e => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {donationExamples.map((example) => (
                    <SortableRow
                      key={example.id}
                      example={example}
                      editingExample={editingExample}
                      setEditingExample={setEditingExample}
                      updateDonationExample={updateDonationExample}
                      deleteDonationExample={deleteDonationExample}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  );
}