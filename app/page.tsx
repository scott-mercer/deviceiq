'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHead, TableRow, TableCell, TableBody } from '@/components/ui/table';

export default function DeviceIQDashboard() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [matrix, setMatrix] = useState<
    { device_model: string; os_version: string; usage_percent: number }[]
  >([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleGenerateMatrix = async () => {
    if (!csvFile) return;

    const formData = new FormData();
    formData.append('file', csvFile);

    const res = await fetch('http://localhost:8000/upload-csv/', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();
    setMatrix(result);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">DeviceIQ – Test Matrix Builder</h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Input type="file" accept=".csv" onChange={handleFileUpload} />
          <Button onClick={handleGenerateMatrix}>Generate Device Matrix</Button>
        </CardContent>
      </Card>

      {matrix.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4">Top Devices by Usage</h2>
            <Table>
              <thead>
                <TableRow>
                  <th className="px-4 py-2 text-left">Device Model</th>
                  <th className="px-4 py-2 text-left">OS Version</th>
                  <th className="px-4 py-2 text-left">Usage %</th>
                </TableRow>
              </thead>
              <TableBody>
                {matrix.map((device, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{device.device_model}</TableCell>
                    <TableCell>{device.os_version}</TableCell>
                    <TableCell>{device.usage_percent}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}