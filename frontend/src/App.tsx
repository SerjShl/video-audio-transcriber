import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileAudio,
  Link2,
  Loader2,
  Mic,
  Moon,
  Sun,
  Upload,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Status = "idle" | "running" | "done" | "error";
type Result = { text: string; filename: string; format: string };
type EngineInfo = { name: string; available: boolean; note: string };

const ENGINE_LABELS: Record<string, string> = {
  groq: "Groq · cloud",
  local: "faster-whisper · offline",
};

export default function App() {
  const [dark, setDark] = useState(true);
  const [mode, setMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const [language, setLanguage] = useState("ru");
  const [format, setFormat] = useState("txt");
  const [engine, setEngine] = useState("groq");
  const [engines, setEngines] = useState<EngineInfo[]>([
    { name: "groq", available: true, note: "" },
  ]);
  const [formats, setFormats] = useState<string[]>(["txt", "srt", "vtt", "json"]);

  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    fetch("/api/engines")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setEngines(d.engines);
        setFormats(d.formats);
        setEngine(d.default);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => () => esRef.current?.close(), []);

  const running = status === "running";
  const canSubmit = running ? false : mode === "url" ? url.trim().length > 0 : file !== null;

  async function start() {
    setStatus("running");
    setLogs([]);
    setResult(null);
    setError(null);

    const body = new FormData();
    body.append("language", language.trim() || "ru");
    body.append("format", format);
    body.append("engine", engine);
    if (mode === "url") body.append("url", url.trim());
    else if (file) body.append("file", file);

    try {
      const res = await fetch("/api/jobs", { method: "POST", body });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `Request failed (${res.status})`);
      }
      const { jobId } = await res.json();

      const es = new EventSource(`/api/jobs/${jobId}/events`);
      esRef.current = es;
      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "log") {
          setLogs((prev) => [...prev, data.line]);
        } else if (data.type === "done") {
          setResult(data.result);
          setStatus("done");
          es.close();
        } else if (data.type === "error") {
          setError(data.message);
          setStatus("error");
          es.close();
        }
      };
      es.onerror = () => {
        es.close();
        setStatus((s) => (s === "done" ? s : "error"));
        setError((e) => e ?? "Connection to the server was lost");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function copyResult() {
    if (result) navigator.clipboard.writeText(result.text);
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Mic className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Transcriber</h1>
              <p className="text-sm text-muted-foreground">
                YouTube, любой URL или файл → текст и субтитры
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Theme">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </header>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-base font-medium">
              Источник
              <Badge variant="secondary">{ENGINE_LABELS[engine] ?? engine}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "url" | "file")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="gap-2">
                  <Link2 className="h-4 w-4" /> Ссылка
                </TabsTrigger>
                <TabsTrigger value="file" className="gap-2">
                  <Upload className="h-4 w-4" /> Файл
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url">
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={running}
                />
              </TabsContent>

              <TabsContent value="file">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center transition-colors ${
                    dragging ? "border-primary bg-primary/5" : "border-input hover:bg-accent/40"
                  }`}
                >
                  <FileAudio className="h-8 w-8 text-muted-foreground" />
                  {file ? (
                    <span className="text-sm font-medium">{file.name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Перетащи аудио/видео сюда или нажми, чтобы выбрать
                    </span>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="audio/*,video/*"
                    disabled={running}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="language">Язык</Label>
                <Input
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={running}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Формат</Label>
                <Select value={format} onValueChange={setFormat} disabled={running}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Движок</Label>
                <Select value={engine} onValueChange={setEngine} disabled={running}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {engines.map((e) => (
                      <SelectItem key={e.name} value={e.name} disabled={!e.available}>
                        {e.name}
                        {e.note ? ` · ${e.note}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={start} disabled={!canSubmit} size="lg" className="w-full">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Транскрибирую…
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" /> Транскрибировать
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {(running || logs.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Прогресс</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                {logs.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Ошибка</p>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {result.filename}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyResult}>
                  <Copy className="h-4 w-4" /> Копировать
                </Button>
                <Button variant="outline" size="sm" onClick={downloadResult}>
                  <Download className="h-4 w-4" /> Скачать
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                readOnly
                value={result.text}
                className="min-h-[220px] font-mono text-sm"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
