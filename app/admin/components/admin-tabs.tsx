'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DonationsTab from './donations-tab';
import MembersTab from './members-tab';
import GroupsTab from './groups-tab';
import SettingsTab from './settings-tab';
import { SlackInvitationsTab } from './slack-invitations-tab';

const STORAGE_KEY = 'admin-active-tab';

function AdminTabsContent() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  
  // Récupérer l'onglet depuis l'URL, le sessionStorage ou utiliser la valeur par défaut
  // État initial basé uniquement sur l'URL pour éviter les problèmes d'hydratation
  const validTabs = ['donations', 'members', 'groups', 'slack', 'settings'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl)
    ? tabFromUrl
    : 'donations';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Charger la valeur sauvegardée après le montage
  useEffect(() => {
    if (!tabFromUrl) {
      const savedTab = sessionStorage.getItem(STORAGE_KEY);
      if (savedTab && validTabs.includes(savedTab)) {
        setActiveTab(savedTab);
      }
    }
  }, []);
  
  useEffect(() => {
    // Si un onglet est spécifié dans l'URL, l'utiliser
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
      sessionStorage.setItem(STORAGE_KEY, tabFromUrl);
    }
  }, [tabFromUrl]);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
    
    // Optionnel : mettre à jour l'URL sans recharger la page
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
  };
  
  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid w-full grid-cols-5 lg:w-auto">
        <TabsTrigger value="donations">Dons</TabsTrigger>
        <TabsTrigger value="members">Membres</TabsTrigger>
        <TabsTrigger value="groups">Groupes</TabsTrigger>
        <TabsTrigger value="slack">Slack</TabsTrigger>
        <TabsTrigger value="settings">Paramètres</TabsTrigger>
      </TabsList>
      
      <TabsContent value="donations" className="space-y-6">
        <DonationsTab />
      </TabsContent>
      
      <TabsContent value="members" className="space-y-6">
        <MembersTab />
      </TabsContent>
      
      <TabsContent value="groups" className="space-y-6">
        <GroupsTab />
      </TabsContent>
      
      <TabsContent value="slack" className="space-y-6">
        <SlackInvitationsTab />
      </TabsContent>
      
      <TabsContent value="settings" className="space-y-6">
        <SettingsTab />
      </TabsContent>
    </Tabs>
  );
}

export default function AdminTabs() {
  return (
    <Suspense fallback={
      <Tabs defaultValue="donations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="donations">Dons</TabsTrigger>
          <TabsTrigger value="members">Membres</TabsTrigger>
          <TabsTrigger value="groups">Groupes</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>
      </Tabs>
    }>
      <AdminTabsContent />
    </Suspense>
  );
}