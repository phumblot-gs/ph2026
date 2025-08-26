'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Check, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Member {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface MemberSearchSelectProps {
  members: Member[];
  onSelect: (memberId: string) => void;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function MemberSearchSelect({
  members,
  onSelect,
  value,
  placeholder = "Rechercher un membre par nom ou email...",
  disabled = false,
}: MemberSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter members based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMembers(members.slice(0, 10)); // Show first 10 when empty
    } else {
      const search = searchTerm.toLowerCase();
      const filtered = members.filter(member => {
        const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
        const email = member.email.toLowerCase();
        return fullName.includes(search) || email.includes(search);
      }).slice(0, 10); // Limit to 10 results
      setFilteredMembers(filtered);
    }
    setSelectedIndex(0);
  }, [searchTerm, members]);

  // Get selected member details
  const selectedMember = members.find(m => m.user_id === value);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredMembers[selectedIndex]) {
          handleSelect(filteredMembers[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  }, [isOpen, selectedIndex, filteredMembers]);

  const handleSelect = (member: Member) => {
    onSelect(member.user_id);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedMember 
            ? `${selectedMember.first_name} ${selectedMember.last_name} (${selectedMember.email})`
            : placeholder
          }
          className={cn(
            "pl-10 pr-3",
            selectedMember && !searchTerm && "text-gray-600"
          )}
          disabled={disabled}
        />
      </div>

      {isOpen && !disabled && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto"
        >
          {filteredMembers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Aucun membre trouvé
            </div>
          ) : (
            filteredMembers.map((member, index) => (
              <div
                key={member.user_id}
                data-index={index}
                onClick={() => handleSelect(member)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                  index === selectedIndex && "bg-gray-100",
                  member.user_id === value && "bg-blue-50"
                )}
              >
                <Avatar className="h-8 w-8">
                  {member.avatar_url ? (
                    <AvatarImage src={member.avatar_url} />
                  ) : (
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {member.email}
                  </p>
                </div>
                {member.user_id === value && (
                  <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}