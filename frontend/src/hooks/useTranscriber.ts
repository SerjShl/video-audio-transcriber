import { useEffect, useRef, useState } from "react";

import { MODE } from "@/constants";
import type { Strings } from "@/i18n";
import { deriveStage } from "@/lib/stage";
import { JobEventType, type Result, Status } from "@/types";

export type StartPayload = {
  mode: string;
  url: string;
  file: File | null;
  language: string;
  format: string;
  engine: string;
};

export function useTranscriber(t: Strings) {
  const [status, setStatus] = useState<Status>(Status.Idle);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const running = status === Status.Running;

  useEffect(() => {
    if (status !== Status.Running) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => () => esRef.current?.close(), []);

  async function start(payload: StartPayload): Promise<void> {
    setStatus(Status.Running);
    setLogs([]);
    setResult(null);
    setJobId(null);
    setError(null);

    const body = new FormData();
    body.append("language", payload.language);
    body.append("format", payload.format);
    body.append("engine", payload.engine);
    if (payload.mode === MODE.url) {
      body.append("url", payload.url.trim());
    } else if (payload.file) {
      body.append("file", payload.file);
    }

    try {
      const res = await fetch("/api/jobs", { method: "POST", body });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `${t.errorTitle} (${res.status})`);
      }
      const { jobId: id } = await res.json();
      setJobId(id);

      const es = new EventSource(`/api/jobs/${id}/events`);
      esRef.current = es;
      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === JobEventType.Log) {
          setLogs((prev) => [...prev, data.line]);
        } else if (data.type === JobEventType.Done) {
          setResult(data.result);
          setStatus(Status.Done);
          es.close();
        } else if (data.type === JobEventType.Error) {
          setError(data.message);
          setStatus(Status.Error);
          es.close();
        }
      };
      es.onerror = () => {
        es.close();
        setStatus((s) => (s === Status.Done ? s : Status.Error));
        setError((e) => e ?? t.connectionLost);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(Status.Error);
    }
  }

  function reset(): void {
    esRef.current?.close();
    setStatus(Status.Idle);
    setLogs([]);
    setResult(null);
    setJobId(null);
    setError(null);
  }

  return {
    status,
    running,
    logs,
    result,
    jobId,
    error,
    elapsed,
    stage: deriveStage(logs, t),
    start,
    reset,
  };
}
