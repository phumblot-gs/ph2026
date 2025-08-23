'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Heart, Trophy } from 'lucide-react';
import type { DonationExample } from '@/lib/types/donations';

interface DonationExamplesProps {
  examples: DonationExample[];
  onSelectAmount?: (amount: number, exampleId?: string) => void;
}

export default function DonationExamples({ examples, onSelectAmount }: DonationExamplesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const handleSelect = (example: DonationExample) => {
    setSelectedId(example.id);
    onSelectAmount?.(example.amount, example.id);
  };
  
  const getIcon = (amount: number) => {
    if (amount >= 1000) return <Trophy className="h-5 w-5" />;
    if (amount >= 100) return <Sparkles className="h-5 w-5" />;
    return <Heart className="h-5 w-5" />;
  };
  
  const getColorClass = (amount: number) => {
    if (amount >= 1000) return 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:border-yellow-400';
    if (amount >= 100) return 'text-purple-600 bg-purple-50 border-purple-200 hover:border-purple-400';
    return 'text-blue-600 bg-blue-50 border-blue-200 hover:border-blue-400';
  };
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {examples.map((example) => {
        const isSelected = selectedId === example.id;
        const colorClass = getColorClass(example.amount);
        
        return (
          <Card
            key={example.id}
            className={`relative cursor-pointer transition-all duration-200 ${
              isSelected 
                ? `ring-2 ring-blue-500 ${colorClass}` 
                : 'hover:shadow-lg'
            }`}
            onClick={() => handleSelect(example)}
          >
            <CardContent className="p-6">
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="bg-blue-500 text-white rounded-full p-1">
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <span className={`${isSelected ? colorClass.split(' ')[0] : 'text-gray-500'}`}>
                  {getIcon(example.amount)}
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  {example.amount}€
                </span>
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-2">
                {example.title}
              </h3>
              
              {example.description && (
                <p className="text-sm text-gray-600">
                  {example.description}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
      
      {/* Custom amount card */}
      <Card
        className={`relative cursor-pointer transition-all duration-200 border-dashed ${
          selectedId === 'custom' 
            ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-400' 
            : 'hover:shadow-lg border-gray-300'
        }`}
        onClick={() => {
          setSelectedId('custom');
          onSelectAmount?.(0);
        }}
      >
        <CardContent className="p-6 flex flex-col items-center justify-center h-full">
          {selectedId === 'custom' && (
            <div className="absolute top-2 right-2">
              <div className="bg-blue-500 text-white rounded-full p-1">
                <Check className="h-4 w-4" />
              </div>
            </div>
          )}
          
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              Montant libre
            </div>
            <p className="text-sm text-gray-600">
              Choisissez le montant qui vous convient
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}