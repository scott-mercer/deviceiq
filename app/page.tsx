'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { AppiumLogViewer } from "@/components/AppiumLogViewer";

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
  const [groupBy, setGroupBy] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [page, setPage] = useState<'home' | 'analytics' | 'testplans' | 'devicelab'>('home');
  const [analyticsData, setAnalyticsData] = useState<{
    usage_distribution: any[];
    cumulative_curve: any[];
    os_version_breakdown: any[];
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [pinnedDevices, setPinnedDevices] = useState<Set<string>>(new Set());
  const [excludedDevices, setExcludedDevices] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  type ExecutionStatus = 'pending' | 'running' | 'passed' | 'failed';
  const [executionResults, setExecutionResults] = useState<Record<string, Record<string, ExecutionStatus>>>({});
  const [testPlans, setTestPlans] = useState<{ id: string; name: string; data: any }[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [deviceLabPrompt, setDeviceLabPrompt] = useState("");
  const [deviceLabResponse, setDeviceLabResponse] = useState<string | null>(null);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [deviceType, setDeviceType] = useState<"simulator" | "real" | "farm" | "">("");
  const [deviceScreenUrl, setDeviceScreenUrl] = useState<string | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<string | null>(null);

  type DeviceLabStep = {
    prompt: string;
    code: string;
    result: string; // e.g. "success", "error", etc.
    output?: string; // logs, errors, etc.
    screenshotUrl?: string;
  };

  const [deviceLabSteps, setDeviceLabSteps] = useState<DeviceLabStep[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [executing, setExecuting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
      setMatrix([]);
      setSummary(null);
      setTestPlan({});
      setCoverage(0);
      setErrorMsg('');
    }
  };

  const handleGenerateMatrix = async () => {
    if (!csvFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('file', csvFile);

    const res = await fetch(
      `http://localhost:8000/upload-csv/?coverage_threshold=${threshold}${groupBy ? `&group_by=${groupBy}` : ""}`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'x-api-key': 'your-secret-api-key', // Must match backend
        },
      }
    );

    if (!res.ok) {
      const error = await res.json();
      setErrorMsg(error.detail || "Unknown error");
      setLoading(false);
      return;
    }
    setErrorMsg('');

    const result = await res.json();

    // Apply exclusion
    let filteredMatrix = result.matrix.filter((device: any) => {
      const key = `${device.device_model}_${device.os_version}`;
      return !excludedDevices.has(key);
    });

    // Always include pinned devices
    const pinnedRows = result.matrix.filter((device: any) => {
      const key = `${device.device_model}_${device.os_version}`;
      return pinnedDevices.has(key);
    });

    // Remove duplicates if a pinned device is already in filteredMatrix
    const pinnedKeys = new Set(pinnedRows.map((d: any) => `${d.device_model}_${d.os_version}`));
    filteredMatrix = [
      ...pinnedRows,
      ...filteredMatrix.filter((d: any) => !pinnedKeys.has(`${d.device_model}_${d.os_version}`))
    ];

    setMatrix(filteredMatrix);

    // Default plan: all flows enabled per device
    const defaultPlan: Record<string, string[]> = {};
    filteredMatrix.forEach((device: { device_model: string; os_version: string; usage_percent: number }) => {
      const key = `${device.device_model}_${device.os_version}`;
      defaultPlan[key] = [...TEST_FLOWS];
    });
    setTestPlan(defaultPlan);

    // Calculate total coverage
    setCoverage(result.summary.covered_usage_percent);

    setSummary(result.summary);
    setLoading(false);
  };

  const handleFetchAnalytics = async () => {
    if (!csvFile) return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    setAnalyticsData(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await fetch(
        `http://localhost:8000/analytics/${groupBy ? `?group_by=${groupBy}` : ""}`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'x-api-key': 'your-secret-api-key',
          },
        }
      );
      if (!res.ok) {
        const error = await res.json();
        setAnalyticsError(error.detail || "Unknown error");
        setAnalyticsLoading(false);
        return;
      }
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      setAnalyticsError('Failed to fetch analytics');
    }
    setAnalyticsLoading(false);
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
    const data = matrix
      .filter(device => {
        const deviceKey = `${device.device_model}_${device.os_version}`;
        return !excludedDevices.has(deviceKey);
      })
      .map(device => {
        const deviceKey = `${device.device_model}_${device.os_version}`;
        return {
          device_model: device.device_model,
          os_version: device.os_version,
          flows: testPlan[deviceKey] || []
        };
      });

    let blob, filename;
    if (exportFormat === 'json') {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      filename = 'test-plan.json';
    } else {
      const csvContent =
        'Device Model,OS Version,Test Flows\n' +
        data.map(row =>
          [row.device_model, row.os_version, row.flows.join('|')].join(',')
        ).join('\n');
      blob = new Blob([csvContent], { type: 'text/csv' });
      filename = 'test-plan.csv';
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Colors for pie chart
  const COLORS = ['#4ade80', '#f87171'];

  // Data for analytics charts
  const coverageData = [
    { name: 'Covered', value: summary?.covered_usage_percent ?? 0 },
    { name: 'Uncovered', value: summary ? summary.total_usage_percent - summary.covered_usage_percent : 0 }
  ];

  useEffect(() => {
    const covered = matrix.reduce((sum, d) => {
      const key = `${d.device_model}_${d.os_version}`;
      return excludedDevices.has(key) ? sum : sum + (d.usage_percent || 0);
    }, 0);
    setCoverage(Number(covered.toFixed(2)));
  }, [matrix, excludedDevices]);

  // Helper to update status
  const updateExecutionStatus = (deviceKey: string, flow: string, status: ExecutionStatus) => {
    setExecutionResults(prev => ({
      ...prev,
      [deviceKey]: {
        ...(prev[deviceKey] || {}),
        [flow]: status
      }
    }));
  };

  // Helper to import a plan
  const handleImportPlan = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setTestPlans(prev => [
            ...prev,
            { id: Date.now().toString(), name: file.name, data }
          ]);
        } catch {
          alert("Invalid plan file.");
        }
      };
      reader.readAsText(file);
    }
  };

  // Helper to download a plan
  const handleDownloadSavedPlan = (plan: { id: string; name: string; data: any }) => {
    const blob = new Blob([JSON.stringify(plan.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = plan.name.endsWith('.json') ? plan.name : `${plan.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to delete a plan
  const handleDeletePlan = (id: string) => {
    setTestPlans(prev => prev.filter(plan => plan.id !== id));
    if (selectedPlan === id) setSelectedPlan(null);
  };

  // Simulate device connection
  const handleConnectDevice = (type: "simulator" | "real" | "farm") => {
    setDeviceType(type);
    setDeviceConnected(true);
  };

  // Simulate prompt-to-code (replace with Grok integration)
  const handlePromptSubmit = async () => {
    setDeviceLabResponse("Generating Appium script...");
    // TODO: Replace this with a call to your Grok/LLM backend
    setTimeout(() => {
      setDeviceLabResponse(
        `// Example Appium code for: "${deviceLabPrompt}"\n\nconst { Builder } = require('appium');\n// ...generated steps...`
      );
    }, 1200);
  };

  // Simulate AI + execution (replace with real backend)
  const handleAddStep = async () => {
    setExecuting(true);
    // 1. Generate code from prompt (call your LLM backend)
    const code = `// Appium code for: ${currentPrompt}\n// ...`;
    // 2. Execute code on device (call your backend)
    const result = "success"; // or "error"
    const output = "Step executed successfully.";
    // 3. Optionally, get screenshot URL
    const screenshotUrl = undefined;
    setDeviceLabSteps(prev => [
      ...prev,
      { prompt: currentPrompt, code, result, output, screenshotUrl }
    ]);
    setCurrentPrompt("");
    setExecuting(false);
  };

  return (
    <div>
      {/* Navigation Bar */}
      <nav className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="text-2xl font-bold tracking-tight">DeviceIQ</div>
        <div className="flex space-x-6">
          <a
            href="#"
            className={`hover:text-blue-400 transition ${page === 'home' ? 'font-semibold underline underline-offset-4' : ''}`}
            onClick={() => setPage('home')}
          >
            Home
          </a>
          <a
            href="#"
            className={`hover:text-blue-400 transition ${page === 'analytics' ? 'font-semibold underline underline-offset-4' : ''}`}
            onClick={() => setPage('analytics')}
          >
            Analytics
          </a>
          <a
            href="#"
            className={`hover:text-blue-400 transition ${page === 'testplans' ? 'font-semibold underline underline-offset-4' : ''}`}
            onClick={() => setPage('testplans')}
          >
            Test Plans
          </a>
          <a
            href="#"
            className={`hover:text-blue-400 transition ${page === 'devicelab' ? 'font-semibold underline underline-offset-4' : ''}`}
            onClick={() => setPage('devicelab')}
          >
            Device Lab
          </a>
          <a href="#" className="hover:text-blue-400 transition">Settings</a>
          <a href="#" className="hover:text-blue-400 transition">Docs</a>
          <button
            className="hover:text-blue-400 transition"
            onClick={() => setAboutOpen(true)}
            style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer" }}
          >
            About
          </button>
        </div>
      </nav>

      {/* About Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
              onClick={() => setAboutOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4">🚀 Project Summary</h2>
            <p className="mb-4">
              DeviceIQ is an AI-assisted platform that helps mobile teams intelligently prioritize and orchestrate testing across real-world devices based on actual user behavior. By ingesting device usage analytics (e.g., from Firebase or CSV exports), DeviceIQ generates a targeted test matrix and maps key test flows to specific device+OS combinations — maximizing coverage while minimizing redundant testing.
            </p>
            <div>
              <strong>The MVP allows teams to:</strong>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Upload real device usage data</li>
                <li>Automatically generate a prioritized device matrix</li>
                <li>Visually see how much of their user base is covered</li>
                <li>Assign test flows (e.g., Login, Checkout) to each device</li>
                <li>Prepare for downstream test orchestration using Appium or other runners</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {page === 'home' && (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold mb-6">DeviceIQ Home</h1>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="mb-4">
                <label htmlFor="csv-upload" className="mr-2">Upload CSV:</label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="w-full"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="threshold-slider" className="mr-2">
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
              <div className="mb-4">
                <label htmlFor="group-by" className="mr-2">Group By:</label>
                <select
                  id="group-by"
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="">None</option>
                  <option value="device_model">Device Model</option>
                  <option value="os_version">OS Version</option>
                  <option value="os_major_version">OS Major Version</option>
                </select>
              </div>
              {errorMsg && (
                <div className="text-red-600 mb-2">{errorMsg}</div>
              )}
              <Button onClick={handleGenerateMatrix} disabled={loading}>
                {loading ? "Generating..." : "Generate Device Matrix"}
              </Button>
              {loading && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>Processing...</span>
                </div>
              )}
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
                    <div><strong>Included in Matrix:</strong> {matrix.length}</div>
                    <div><strong>Total Usage %:</strong> {summary.total_usage_percent}</div>
                    <div><strong>Covered Usage %:</strong> {coverage}</div>
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
                    {matrix.filter(device =>
                      (device.device_model?.toLowerCase().includes(filter.toLowerCase()) ?? false) ||
                      (device.os_version?.toLowerCase().includes(filter.toLowerCase()) ?? false)
                    ).map((device, idx) => {
                      const deviceKey = `${device.device_model}_${device.os_version}`;
                      const isExcluded = excludedDevices.has(deviceKey);
                      return (
                        <TableRow className={idx % 2 === 0 ? "bg-gray-50" : ""} key={idx}>
                          <TableCell>{device.device_model}</TableCell>
                          <TableCell>{device.os_version}</TableCell>
                          <TableCell>{device.usage_percent}%</TableCell>
                          <TableCell>
                            <div>
                              {/* Draggable selected flows */}
                              <DragDropContext
                                onDragEnd={result => {
                                  if (!result.destination) return;
                                  const deviceKey = `${device.device_model}_${device.os_version}`;
                                  setTestPlan(prev => {
                                    const flows = Array.from(prev[deviceKey] || []);
                                    const [removed] = flows.splice(result.source.index, 1);
                                    if (result.destination) {
                                      flows.splice(result.destination.index, 0, removed);
                                    }
                                    return { ...prev, [deviceKey]: flows };
                                  });
                                }}
                              >
                                <Droppable droppableId={deviceKey}>
                                  {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                      {(testPlan[deviceKey] || []).map((flow, idx) => (
                                        <Draggable key={flow} draggableId={flow} index={idx}>
                                          {(provided) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              {...provided.dragHandleProps}
                                              className="flex items-center space-x-2 mb-1 bg-gray-100 rounded px-2 py-1"
                                            >
                                              <Checkbox
                                                checked
                                                onCheckedChange={() => handleCheckboxChange(deviceKey, flow)}
                                                disabled={excludedDevices.has(deviceKey)}
                                              />
                                              <span className={excludedDevices.has(deviceKey) ? "text-gray-400 line-through" : ""}>{flow}</span>
                                              <select
                                                value={executionResults[deviceKey]?.[flow] || 'pending'}
                                                onChange={e => updateExecutionStatus(deviceKey, flow, e.target.value as ExecutionStatus)}
                                                className="border rounded px-1 py-0 text-xs"
                                                disabled={excludedDevices.has(deviceKey)}
                                              >
                                                <option value="pending">Pending</option>
                                                <option value="running">Running</option>
                                                <option value="passed">Passed</option>
                                                <option value="failed">Failed</option>
                                              </select>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </DragDropContext>
                              {/* Unselected flows */}
                              <div className="mt-2">
                                {TEST_FLOWS.filter(flow => !(testPlan[deviceKey] || []).includes(flow)).map(flow => (
                                  <div key={flow} className="flex items-center space-x-2 mb-1">
                                    <Checkbox
                                      checked={false}
                                      onCheckedChange={() => handleCheckboxChange(deviceKey, flow)}
                                      disabled={excludedDevices.has(deviceKey)}
                                    />
                                    <span className="text-gray-400 italic">{flow}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 ml-2">
                              {testPlan[deviceKey]?.length || 0}/{TEST_FLOWS.length} selected
                            </span>
                            <div className="flex space-x-2 mt-2">
                              <Button
                                size="sm"
                                variant={pinnedDevices.has(deviceKey) ? "default" : "outline"}
                                onClick={() => {
                                  setPinnedDevices(prev => {
                                    const next = new Set(prev);
                                    next.has(deviceKey) ? next.delete(deviceKey) : next.add(deviceKey);
                                    return next;
                                  });
                                }}
                                disabled={isExcluded}
                              >
                                {pinnedDevices.has(deviceKey) ? "Pinned" : "Pin"}
                              </Button>
                              <Button
                                size="sm"
                                variant={isExcluded ? "destructive" : "outline"}
                                onClick={() => {
                                  setExcludedDevices(prev => {
                                    const next = new Set(prev);
                                    next.has(deviceKey) ? next.delete(deviceKey) : next.add(deviceKey);
                                    return next;
                                  });
                                }}
                              >
                                {isExcluded ? "Excluded" : "Exclude"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center space-x-2 mb-4">
                  <label>Export as:</label>
                  <select
                    value={exportFormat}
                    onChange={e => setExportFormat(e.target.value as 'csv' | 'json')}
                    className="border rounded px-2 py-1"
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <Button onClick={handleDownloadPlan}>Download Test Plan</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {page === 'analytics' && (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
          <h1 className="text-2xl font-bold mb-4">Analytics</h1>
          <Button onClick={handleFetchAnalytics} disabled={analyticsLoading || !csvFile}>
            {analyticsLoading ? "Loading..." : "Show Analytics"}
          </Button>
          {analyticsError && <div className="text-red-600">{analyticsError}</div>}
          {analyticsData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
              {/* Usage Distribution Bar Chart */}
              <div>
                <h2 className="font-semibold mb-2">Device/OS Usage Distribution</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analyticsData.usage_distribution.slice(0, 10)}>
                    <XAxis dataKey="device_model" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="usage_percent" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* OS Version Breakdown Pie Chart */}
              <div>
                <h2 className="font-semibold mb-2">OS Version Breakdown</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analyticsData.os_version_breakdown}
                      dataKey="usage_percent"
                      nameKey="os_version"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {analyticsData.os_version_breakdown.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Cumulative Coverage Line Chart */}
              <div className="col-span-2">
                <h2 className="font-semibold mb-2">Cumulative Coverage Curve</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analyticsData.cumulative_curve}>
                    <XAxis dataKey="device_model" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cumulative_coverage" stroke="#4ade80" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {page === 'testplans' && (
        <div className="p-6 max-w-3xl mx-auto space-y-8">
          <h1 className="text-2xl font-bold mb-4">Test Plans</h1>
          <div className="mb-4">
            <label className="mr-2">Import Plan:</label>
            <Input type="file" accept=".json" onChange={handleImportPlan} />
          </div>
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-2">Saved Plans</h2>
              <ul className="divide-y">
                {testPlans.map(plan => (
                  <li key={plan.id} className="flex items-center justify-between py-2">
                    <span
                      className={`cursor-pointer ${selectedPlan === plan.id ? "font-bold" : ""}`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {plan.name}
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" onClick={() => handleDownloadSavedPlan(plan)}>Download</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeletePlan(plan.id)}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {selectedPlan && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-2">Plan Details</h3>
                {(() => {
                  const plan = testPlans.find(p => p.id === selectedPlan);
                  if (!plan) return null;
                  const rows = Array.isArray(plan.data) ? plan.data : [];
                  return (
                    <>
                      <div className="mb-4 text-sm text-gray-700">
                        <div><strong>Devices:</strong> {rows.length}</div>
                        <div>
                          <strong>Total Flows:</strong>{" "}
                          {rows.reduce((sum, row) => sum + (row.flows?.length || 0), 0)}
                        </div>
                      </div>
                      <Table>
                        <thead>
                          <TableRow>
                            <th className="px-4 py-2 text-left">Device Model</th>
                            <th className="px-4 py-2 text-left">OS Version</th>
                            <th className="px-4 py-2 text-left">Test Flows</th>
                          </TableRow>
                        </thead>
                        <TableBody>
                          {rows.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.device_model}</TableCell>
                              <TableCell>{row.os_version}</TableCell>
                              <TableCell>
                                {(row.flows || []).length > 0
                                  ? (row.flows || []).join(', ')
                                  : <span className="text-gray-400 italic">None</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
          {selectedPlan && (
            <Button
              size="sm"
              onClick={() => {
                const plan = testPlans.find(p => p.id === selectedPlan);
                if (plan && Array.isArray(plan.data)) {
                  // Convert plan.data back to your matrix and testPlan state shape
                  setMatrix(plan.data.map(({ device_model, os_version, usage_percent }) => ({
                    device_model,
                    os_version,
                    usage_percent: usage_percent ?? 0
                  })));
                  const newTestPlan: Record<string, string[]> = {};
                  plan.data.forEach((row: any) => {
                    const key = `${row.device_model}_${row.os_version}`;
                    newTestPlan[key] = row.flows || [];
                  });
                  setTestPlan(newTestPlan);
                  setPage('home');
                }
              }}
            >
              Load into Dashboard
            </Button>
          )}
        </div>
      )}

      {page === "devicelab" && (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold mb-4">Device Lab (Prompt-based Test Designer)</h1>
          {!deviceConnected ? (
            <Card>
              <CardContent className="space-y-4">
                <div>Connect a device to begin:</div>
                <div className="flex space-x-2">
                  <Button onClick={() => handleConnectDevice("simulator")}>Connect Simulator</Button>
                  <Button onClick={() => handleConnectDevice("real")}>Connect Real Device</Button>
                  <Button onClick={() => handleConnectDevice("farm")}>Connect Device Farm</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">Connected:</span>
                  <span className="text-green-600">{deviceType}</span>
                  <Button size="sm" variant="outline" onClick={() => setDeviceConnected(false)}>
                    Disconnect
                  </Button>
                </div>
                {/* Steps so far */}
                <div>
                  <h2 className="font-semibold mb-2">Test Steps</h2>
                  <ol className="space-y-2">
                    {deviceLabSteps.map((step, idx) => (
                      <li key={idx} className="bg-gray-50 rounded p-2">
                        <div className="font-mono text-xs text-gray-700 mb-1">Prompt: {step.prompt}</div>
                        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mb-1">{step.code}</pre>
                        <div className={`text-xs ${step.result === "success" ? "text-green-600" : "text-red-600"}`}>
                          {step.result}: {step.output}
                        </div>
                        {step.screenshotUrl && (
                          <img src={step.screenshotUrl} alt="screenshot" className="mt-2 rounded border" />
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
                {/* Prompt input */}
                <Textarea
                  placeholder="Describe the next step (e.g. 'Tap Login and enter credentials')"
                  value={currentPrompt}
                  onChange={e => setCurrentPrompt(e.target.value)}
                  rows={2}
                  disabled={executing}
                />
                <Button onClick={handleAddStep} disabled={!currentPrompt || executing}>
                  {executing ? "Executing..." : "Add Step & Run"}
                </Button>
                {/* Export full script */}
                {deviceLabSteps.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const fullScript = deviceLabSteps.map(s => s.code).join('\n\n');
                      const blob = new Blob([fullScript], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'appium-test.js';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Export Full Test Script
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}