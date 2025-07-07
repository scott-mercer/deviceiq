'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_FLOWS = ['LoginTest', 'SearchTest', 'AddToCartTest', 'CheckoutTest'];

export default function SettingsPage() {
  const [flows, setFlows] = useState<string[]>([]);
  const [newFlow, setNewFlow] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('testFlows');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFlows(parsed);
          return;
        }
      } catch {
        // ignore parse errors
      }
    }
    setFlows(DEFAULT_FLOWS);
  }, []);

  useEffect(() => {
    localStorage.setItem('testFlows', JSON.stringify(flows));
  }, [flows]);

  const handleAdd = () => {
    const trimmed = newFlow.trim();
    if (trimmed && !flows.includes(trimmed)) {
      setFlows([...flows, trimmed]);
      setNewFlow('');
    }
  };

  const handleUpdate = (index: number, value: string) => {
    setFlows(flows.map((f, i) => (i === index ? value : f)));
  };

  const handleDelete = (index: number) => {
    setFlows(flows.filter((_, i) => i !== index));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold">Test Flows</h2>
          {flows.map((flow, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <Input
                value={flow}
                onChange={e => handleUpdate(idx, e.target.value)}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(idx)}
              >
                Delete
              </Button>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <Input
              placeholder="New flow"
              value={newFlow}
              onChange={e => setNewFlow(e.target.value)}
            />
            <Button size="sm" onClick={handleAdd}>
              Add Flow
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
