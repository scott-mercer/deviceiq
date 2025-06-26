import { useEffect, useRef, useState } from "react";

export function useAppiumLogs(url: string) {
  const [logs, setLogs] = useState<Array<{ log: string; device: any }>>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    wsRef.current = new WebSocket(url);
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => [...prev, data]);
      } catch (e) {
        // Ignore parse errors
      }
    };
    return () => {
      wsRef.current?.close();
    };
  }, [url]);

  return logs;
}

export function AppiumLogViewer({ wsUrl }: { wsUrl: string }) {
  const logs = useAppiumLogs(wsUrl);
  return (
    <div style={{ fontFamily: "monospace", background: "#111", color: "#0f0", padding: 16, borderRadius: 8, maxHeight: 400, overflowY: "auto" }}>
      <h3>Appium Logs</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {logs.map((entry, idx) => (
          <li key={idx}>
            <span>{entry.log}</span>
            {entry.device && (
              <span style={{ color: "#0ff", marginLeft: 8 }}>
                [Device: {entry.device.device_id}, Status: {entry.device.status}]
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
