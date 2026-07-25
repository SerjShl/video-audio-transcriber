import {
  AlertCircle,
  CheckCircle2,
  Cookie,
  Copy,
  Download,
  ExternalLink,
  FileAudio,
  HelpCircle,
  Languages,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { type DragEvent, type FormEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { STRINGS, UI_LANGS, type UiLang, getInitialUiLang } from "@/i18n";

type Status = "idle" | "running" | "done" | "error";
type Result = { text: string; filename: string; format: string };
type EngineInfo = { name: string; available: boolean; note: string };
type Cookies = { present: boolean; name: string | null };

// Spoken languages Whisper listens for (labels come from the UI locale).
const SPOKEN_CODES = ["ru", "en"];

const FORMAT_ORDER = ["txt", "docx", "pdf", "srt", "vtt", "json"];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Turn the pipeline's raw stdout lines into one friendly status label.
function deriveStage(logs: string[], strings: (typeof STRINGS)["ru"]) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i].toLowerCase();
    const part = line.match(/part\s+(\d+)\/(\d+)/);
    if (part) return strings.statusPart.replace("{n}", part[1]).replace("{total}", part[2]);
    if (line.includes("transcrib") || line.includes("🎤")) return strings.statusTranscribing;
    if (line.includes("loading local model") || line.includes("📦")) return strings.statusModel;
    if (line.includes("compress")) return strings.statusCompressing;
    if (line.includes("split")) return strings.statusSplitting;
    if (line.includes("download") || line.includes("⬇")) return strings.statusDownloading;
  }
  return strings.statusPreparing;
}

function Waveform({ bars = 5, className }: { bars?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current animate-wave"
          style={{ height: "0.9rem", animationDelay: `${i * 0.11}s` }}
        />
      ))}
    </span>
  );
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [uiLang, setUiLang] = useState<UiLang>(getInitialUiLang);
  const t = STRINGS[uiLang];

  // --- auth ---
  const [authChecked, setAuthChecked] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // --- settings ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cookies, setCookies] = useState<Cookies>({ present: false, name: null });
  const [cookiesBusy, setCookiesBusy] = useState(false);

  // --- form ---
  const [mode, setMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const [language, setLanguage] = useState(() => localStorage.getItem("vat_language") || "ru");
  const [format, setFormat] = useState(() => localStorage.getItem("vat_format") || "txt");
  const [engine, setEngine] = useState("groq");
  const [engines, setEngines] = useState<EngineInfo[]>([
    { name: "groq", available: true, note: "" },
  ]);
  const [formats, setFormats] = useState<string[]>(["txt", "srt", "vtt", "json", "docx", "pdf"]);

  // --- job ---
  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    document.documentElement.lang = uiLang;
    try {
      localStorage.setItem("vat_ui_lang", uiLang);
    } catch {
      /* ignore */
    }
  }, [uiLang]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem("vat_language", language);
    } catch {
      /* ignore */
    }
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem("vat_format", format);
    } catch {
      /* ignore */
    }
  }, [format]);

  // Elapsed timer while a job runs.
  useEffect(() => {
    if (status !== "running") return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => () => esRef.current?.close(), []);

  function loadEngines() {
    fetch("/api/engines")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setEngines(d.engines);
        setFormats(d.formats);
        setEngine(d.default);
      })
      .catch(() => {});
  }

  function loadSettings() {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAuthRequired(Boolean(d.authRequired));
        setPasswordConfigured(Boolean(d.passwordConfigured));
        if (d.cookies) setCookies(d.cookies);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setAuthRequired(Boolean(d.required));
        setPasswordConfigured(Boolean(d.passwordConfigured));
        setAuthed(Boolean(d.authed));
        if (d.authed) {
          loadEngines();
          loadSettings();
        }
      })
      .catch(() => {
        setAuthed(true);
        loadEngines();
        loadSettings();
      })
      .finally(() => setAuthChecked(true));
  }, []);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || t.loginFailed);
      }
      setAuthed(true);
      setPassword("");
      loadEngines();
      loadSettings();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    esRef.current?.close();
    setAuthed(false);
    setSettingsOpen(false);
    setStatus("idle");
    setResult(null);
    setLogs([]);
    setError(null);
  }

  async function uploadCookies(f: File | null) {
    if (!f) return;
    setCookiesBusy(true);
    try {
      const body = new FormData();
      body.append("cookies", f);
      const res = await fetch("/api/cookies", { method: "POST", body });
      if (res.ok) setCookies((await res.json()).cookies);
    } finally {
      setCookiesBusy(false);
    }
  }

  async function clearCookies() {
    setCookiesBusy(true);
    try {
      const res = await fetch("/api/cookies", { method: "DELETE" });
      if (res.ok) setCookies((await res.json()).cookies);
    } finally {
      setCookiesBusy(false);
    }
  }

  const running = status === "running";
  const canSubmit = running ? false : mode === "url" ? url.trim().length > 0 : file !== null;
  const orderedFormats = [
    ...FORMAT_ORDER.filter((f) => formats.includes(f)),
    ...formats.filter((f) => !FORMAT_ORDER.includes(f)),
  ];

  async function start() {
    setStatus("running");
    setLogs([]);
    setResult(null);
    setJobId(null);
    setError(null);

    const body = new FormData();
    body.append("language", language);
    body.append("format", format);
    body.append("engine", engine);
    if (mode === "url") {
      body.append("url", url.trim());
    } else if (file) {
      body.append("file", file);
    }

    try {
      const res = await fetch("/api/jobs", { method: "POST", body });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `${t.errorTitle} (${res.status})`);
      }
      const { jobId } = await res.json();
      setJobId(jobId);

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
        setError((e) => e ?? (uiLang === "ru" ? "Соединение с сервером потеряно" : "Lost connection to the server"));
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
    if (!result) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadResult() {
    if (jobId) window.location.href = `/api/jobs/${jobId}/download`;
  }

  const uiLangSwitcher = (
    <Select value={uiLang} onValueChange={(v) => setUiLang(v as UiLang)}>
      <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-accent focus:ring-0">
        <Languages className="h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {UI_LANGS.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // --- gate: still checking -------------------------------------------------
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Waveform bars={7} className="h-8 text-primary" />
      </div>
    );
  }

  // --- gate: login screen ---------------------------------------------------
  if (authRequired && !authed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-glow">
              <Radio className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Transcriber</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.loginSubtitle}</p>
          </div>
          <div className="glass rounded-2xl border p-6 shadow-lift">
            <form onSubmit={submitLogin} className="flex flex-col gap-3">
              <Label className="eyebrow flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> {t.loginPasswordLabel}
              </Label>
              <Input
                type="password"
                autoFocus
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 text-center tracking-widest"
              />
              {loginError && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {loginError}
                </p>
              )}
              <Button type="submit" size="lg" disabled={loggingIn || !password} className="mt-1 w-full">
                {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : t.loginSubmit}
              </Button>
            </form>
          </div>
          <div className="mt-4 flex justify-center">{uiLangSwitcher}</div>
        </div>
      </div>
    );
  }

  // --- main app -------------------------------------------------------------
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 md:py-12">
        {/* Header */}
        <header className="flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-glow">
              <Radio className="h-6 w-6" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-rec-pulse" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold leading-none tracking-tight">
                Transcriber
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">{t.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label={t.a11ySettings}>
              <Settings2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label={t.a11yTheme}>
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {authRequired && (
              <Button variant="ghost" size="icon" onClick={logout} aria-label={t.a11yLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </header>

        {/* Console */}
        <Card className="glass border shadow-lift animate-fade-up" style={{ animationDelay: "0.06s" }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t.source}</span>
              <Badge variant="secondary" className="font-medium">
                {t.engineLabels[engine] ?? engine}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "url" | "file")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="gap-2">
                  <Link2 className="h-4 w-4" /> {t.tabLink}
                </TabsTrigger>
                <TabsTrigger value="file" className="gap-2">
                  <Upload className="h-4 w-4" /> {t.tabFile}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url">
                <Input
                  type="url"
                  placeholder={t.urlPlaceholder}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={running}
                  className="h-11"
                />
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Cookie className={cn("h-3.5 w-3.5", cookies.present ? "text-primary" : "opacity-60")} />
                  {cookies.present ? t.cookiesOn : t.cookiesOff}
                </button>
              </TabsContent>

              <TabsContent value="file">
                {file ? (
                  <div className="flex items-center gap-3 rounded-xl border bg-background/50 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FileAudio className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setFile(null)}
                      disabled={running}
                      aria-label={t.removeFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center transition-colors",
                      dragging ? "border-primary bg-primary/5" : "border-input hover:bg-accent/40",
                    )}
                  >
                    <FileAudio className="h-9 w-9 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t.dropHint}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="audio/*,video/*"
                      disabled={running}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="eyebrow">{t.labelLanguage}</Label>
                <Select value={language} onValueChange={setLanguage} disabled={running}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPOKEN_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {t.spokenLabels[code] ?? code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="eyebrow">{t.labelFormat}</Label>
                <Select value={format} onValueChange={setFormat} disabled={running}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedFormats.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t.formatLabels[f] ?? f.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={start} disabled={!canSubmit} size="lg" className="h-12 w-full text-[0.95rem] font-semibold">
              {running ? (
                <>
                  <Waveform className="text-primary-foreground" /> {t.transcribing}
                </>
              ) : (
                <>
                  <Radio className="h-4 w-4" /> {t.transcribe}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Progress */}
        {(running || logs.length > 0) && (
          <Card className="glass border animate-fade-up">
            <CardContent className="flex flex-col gap-3 py-5">
              <div className="flex items-center gap-3">
                {running ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                )}
                <span className="flex-1 text-sm font-medium">
                  {running ? deriveStage(logs, t) : t.progress}
                </span>
                {running && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatElapsed(elapsed)}
                  </span>
                )}
              </div>
              {running && <p className="text-xs text-muted-foreground/80">{t.largeFileHint}</p>}
              {logs.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
                    {t.showLog}
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-background/60 p-3 font-mono text-[11px] leading-relaxed">
                    {logs.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap text-muted-foreground">
                        {line}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/5 animate-fade-up">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{t.errorTitle}</p>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className="glass border shadow-lift animate-fade-up">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="truncate">{result.filename}</span>
              </CardTitle>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={copyResult}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  {copied ? t.copied : t.copy}
                </Button>
                <Button size="sm" onClick={downloadResult}>
                  <Download className="h-4 w-4" /> {t.download}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                readOnly
                value={result.text}
                className="min-h-[240px] resize-y bg-background/60 font-mono text-sm leading-relaxed"
              />
            </CardContent>
          </Card>
        )}

        <footer className="pt-2 text-center text-xs text-muted-foreground/60">{t.footer}</footer>
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> {t.settingsTitle}
            </DialogTitle>
            <DialogDescription>{t.settingsDesc}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 pt-1">
            {/* Interface language */}
            <section className="rounded-xl border bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary" />
                <span className="eyebrow">{t.uiLangEyebrow}</span>
              </div>
              <Select value={uiLang} onValueChange={(v) => setUiLang(v as UiLang)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            {/* Access (informational — governed by APP_PASSWORD on the server) */}
            <section className="rounded-xl border bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="eyebrow">{t.accessEyebrow}</span>
              </div>
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    passwordConfigured ? "bg-primary" : "bg-muted-foreground/40",
                  )}
                />
                <div>
                  <p className="text-sm font-medium">
                    {passwordConfigured ? t.accessProtected : t.accessOpen}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {passwordConfigured ? t.accessProtectedDesc : t.accessOpenDesc}
                  </p>
                </div>
              </div>
            </section>

            {/* Recognition mode (only when more than one engine is around) */}
            {engines.length > 1 && (
              <section className="rounded-xl border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  <span className="eyebrow">{t.modeEyebrow}</span>
                </div>
                <Select value={engine} onValueChange={setEngine}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {engines.map((e) => (
                      <SelectItem key={e.name} value={e.name} disabled={!e.available}>
                        {t.engineLabels[e.name] ?? e.name}
                        {e.available ? "" : ` · ${t.engineUnavailable}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.modeNote}</p>
              </section>
            )}

            {/* Cookies */}
            <section className="rounded-xl border bg-background/50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Cookie className="h-4 w-4 text-primary" />
                <span className="eyebrow">{t.cookiesEyebrow}</span>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t.cookiesDesc}</p>

              {cookies.present ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  <span className="flex items-center gap-2 truncate text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">
                      {cookies.name} · {t.cookiesConnected}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <RefreshCw className="h-3.5 w-3.5" /> {t.cookiesReplace}
                      <input
                        type="file"
                        accept=".txt"
                        className="hidden"
                        disabled={cookiesBusy}
                        onChange={(e) => uploadCookies(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <Button variant="ghost" size="sm" onClick={clearCookies} disabled={cookiesBusy}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40">
                  {cookiesBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {t.cookiesUpload}
                  <input
                    type="file"
                    accept=".txt"
                    className="hidden"
                    disabled={cookiesBusy}
                    onChange={(e) => uploadCookies(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              <details className="mt-3">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary">
                  <HelpCircle className="h-3.5 w-3.5" /> {t.cookiesGuide}
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                  <li>{t.cookiesStep1}</li>
                  <li>{t.cookiesStep2}</li>
                  <li>{t.cookiesStep3}</li>
                  <li>{t.cookiesStep4}</li>
                </ol>
                <a
                  href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t.cookiesStoreLink} <ExternalLink className="h-3 w-3" />
                </a>
              </details>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
