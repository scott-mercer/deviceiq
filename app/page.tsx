'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

const TEST_FLOWS = ['LoginTest', 'SearchTest', 'AddToCartTest', 'CheckoutTest'];

interface DeviceMatrixRow {
  device_model: string;
  os_version: string;
  usage_percent: number;
}

export default function DeviceIQDashboard() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [matrix, setMatrix] = useState<
    { device_model: string; os_version: string; usage_percent: number }[]
  >([]);
  const [testPlan, setTestPlan] = useState<Record<string, string[]>>({});
  const [coverage, setCoverage] = useState<number>(0);
  const [filter, setFilter] = useState('');
  const [threshold, setThreshold] = useState(90);
  const [summary, setSummary] = useState<{
    total_devices: number;
    included_devices: number;
    total_usage_percent: number;
    covered_usage_percent: number;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleGenerateMatrix = async () => {
    if (!csvFile) return;

    const formData = new FormData();
    formData.append('file', csvFile);

    const res = await fetch(`http://localhost:8000/upload-csv/?coverage_threshold=${threshold}`, {
      method: 'POST',
      body: formData,
      headers: {
        'x-api-key': 'your-secret-api-key', // Must match backend
      },
    });

    if (!res.ok) {
      // Handle error (e.g., show error message)
      const error = await res.json();
      alert(error.detail || "Unknown error");
      return;
    }

    const result = await res.json();

    result.matrix.forEach((device: { cumulative_coverage: number } & { [key: string]: any }) => {
      device.include_in_matrix = device.cumulative_coverage <= threshold;
    });
    setMatrix(result.matrix);

    // Default plan: all flows enabled per device
    const defaultPlan: Record<string, string[]> = {};
    result.matrix.forEach((device: { device_model: string; os_version: string; usage_percent: number }) => {
      const key = `${device.device_model}_${device.os_version}`;
      defaultPlan[key] = [...TEST_FLOWS];
    });
    setTestPlan(defaultPlan);

    // Calculate total coverage
    setCoverage(result.summary.covered_usage_percent);

    setSummary(result.summary);
  };

  const handleCheckboxChange = (deviceKey: string, flow: string) => {
    setTestPlan((prev) => {
      const flows = new Set(prev[deviceKey]);
      if (flows.has(flow)) {
        flows.delete(flow);
      } else {
        flows.add(flow);
      }
      return { ...prev, [deviceKey]: Array.from(flows) };
    });
  };

  const handleDownloadPlan = () => {
    const data = Object.entries(testPlan).map(([deviceKey, flows]) => {
      const [device_model, os_version] = deviceKey.split('_');
      return { device_model, os_version, flows: flows.join(',') };
    });
    const csvContent =
      'Device Model,OS Version,Test Flows\n' +
      data.map(row =>
        [row.device_model, row.os_version, row.flows].join(',')
      ).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-plan.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">DeviceIQ – Test Matrix Builder</h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Input type="file" accept=".csv" onChange={handleFileUpload} />
          <div className="flex items-center space-x-4 mb-4">
            <label htmlFor="threshold-slider" className="min-w-[140px]">
              Coverage:
            </label>
            <input
              id="threshold-slider"
              type="range"
              min={0}
              max={100}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full"
            />
            <span className="min-w-[40px] text-right">{threshold}%</span>
          </div>
          <Button onClick={handleGenerateMatrix}>Generate Device Matrix</Button>
        </CardContent>
      </Card>

      {matrix.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-xl font-semibold">Test Coverage</h2>
            <div className="flex items-center space-x-4">
              <Progress value={coverage} className="w-full" />
              <span className="min-w-[50px] text-sm font-medium">{coverage}%</span>
            </div>

            {summary && (
              <div className="mb-4 space-y-1 text-sm text-gray-700">
                <div><strong>Total Devices:</strong> {summary.total_devices}</div>
                <div><strong>Included in Matrix:</strong> {summary.included_devices}</div>
                <div><strong>Total Usage %:</strong> {summary.total_usage_percent}</div>
                <div><strong>Covered Usage %:</strong> {summary.covered_usage_percent}</div>
              </div>
            )}

            <Input
              placeholder="Filter by device model or OS version"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="mb-4"
            />

            <h2 className="text-xl font-semibold mt-6">Top Devices by Usage</h2>
            <Table>
              <thead>
                <TableRow>
                  <th className="px-4 py-2 text-left">Device Model</th>
                  <th className="px-4 py-2 text-left">OS Version</th>
                  <th className="px-4 py-2 text-left">Usage %</th>
                  <th className="px-4 py-2 text-left">Test Flows</th>
                </TableRow>
              </thead>
              <TableBody>
                {matrix
                  .filter(device =>
                    device.device_model.toLowerCase().includes(filter.toLowerCase()) ||
                    device.os_version.toLowerCase().includes(filter.toLowerCase())
                  )
                  .map((device, idx) => {
                    const deviceKey = `${device.device_model}_${device.os_version}`;
                    return (
                      <TableRow key={idx}>
                        <TableCell>{device.device_model}</TableCell>
                        <TableCell>{device.os_version}</TableCell>
                        <TableCell>{device.usage_percent}%</TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            {TEST_FLOWS.map((flow) => (
                              <label key={flow} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={testPlan[deviceKey]?.includes(flow)}
                                  onCheckedChange={() =>
                                    handleCheckboxChange(deviceKey, flow)
                                  }
                                />
                                <span>{flow}</span>
                              </label>
                            ))}
                            <span className="text-xs text-gray-500 ml-2">
                              {testPlan[deviceKey]?.length || 0}/{TEST_FLOWS.length} selected
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setTestPlan(prev => ({
                                  ...prev,
                                  [deviceKey]: prev[deviceKey].length === TEST_FLOWS.length ? [] : [...TEST_FLOWS]
                                }))
                              }
                            >
                              {testPlan[deviceKey]?.length === TEST_FLOWS.length ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
            <Button onClick={handleDownloadPlan}>Download Test Plan</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}