import {
  AlertCircle,
  CheckCircle2,
  Cookie,
  Copy,
  Download,
  FileAudio,
  Link2,
  Loader2,
  LogOut,
  Moon,
  Radio,
  Settings2,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { type DragEvent, type FormEvent, useEffect, useRef, useState } from "react";

import { LoginScreen } from "@/components/LoginScreen";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Waveform } from "@/components/Waveform";
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
import { DEFAULTS, MODE, MODES, STORAGE_KEYS } from "@/constants";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useTranscriber } from "@/hooks/useTranscriber";
import { STRINGS, type UiLang, getInitialUiLang } from "@/i18n";
import { formatBytes, formatElapsed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Cookies, EngineInfo } from "@/types";

const SPOKEN_CODES = ["ru", "en"];
const FORMAT_ORDER = ["txt", "docx", "pdf", "srt", "vtt", "json"];

export default function App() {
  const [uiLang, setUiLang] = useState<UiLang>(getInitialUiLang);
  const t = STRINGS[uiLang];
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE_KEYS.dark) !== "0");

  const [authChecked, setAuthChecked] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cookies, setCookies] = useState<Cookies>({ present: false, name: null });
  const [cookiesBusy, setCookiesBusy] = useState(false);
  const [groqKeySet, setGroqKeySet] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [groqBusy, setGroqBusy] = useState(false);

  const [mode, setMode] = usePersistentState(STORAGE_KEYS.mode, DEFAULTS.mode, MODES);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [language, setLanguage] = usePersistentState(STORAGE_KEYS.language, DEFAULTS.language);
  const [format, setFormat] = usePersistentState(STORAGE_KEYS.format, DEFAULTS.format);
  const [engine, setEngine] = usePersistentState(STORAGE_KEYS.engine, DEFAULTS.engine);
  const [engines, setEngines] = useState<EngineInfo[]>([
    { name: "groq", available: true, note: "" },
  ]);
  const [formats, setFormats] = useState<string[]>(["txt", "srt", "vtt", "json", "docx", "pdf"]);

  const job = useTranscriber(t);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEYS.dark, dark ? "1" : "0");
    } catch {
      return;
    }
  }, [dark]);

  useEffect(() => {
    document.documentElement.lang = uiLang;
    try {
      localStorage.setItem(STORAGE_KEYS.uiLang, uiLang);
    } catch {
      return;
    }
  }, [uiLang]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job.logs]);

  function loadEngines() {
    fetch("/api/engines")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setEngines(d.engines);
        setFormats(d.formats);
        const saved = localStorage.getItem(STORAGE_KEYS.engine);
        const available = d.engines
          .filter((e: EngineInfo) => e.available)
          .map((e: EngineInfo) => e.name);
        setEngine(saved && available.includes(saved) ? saved : d.default);
      })
      .catch(() => {});
  }

  function loadSettings() {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAuthRequired(Boolean(d.authRequired));
        setGroqKeySet(Boolean(d.groqKeySet));
        if (d.cookies) setCookies(d.cookies);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setAuthRequired(Boolean(d.required));
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
    job.reset();
    setAuthed(false);
    setSettingsOpen(false);
  }

  async function saveGroqKey() {
    setGroqBusy(true);
    try {
      const res = await fetch("/api/groq-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: groqKeyInput.trim() }),
      });
      if (res.ok) {
        setGroqKeySet(Boolean((await res.json()).groqKeySet));
        setGroqKeyInput("");
        loadEngines();
      }
    } finally {
      setGroqBusy(false);
    }
  }

  async function clearGroqKey() {
    setGroqBusy(true);
    try {
      const res = await fetch("/api/groq-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "" }),
      });
      if (res.ok) {
        setGroqKeySet(false);
        loadEngines();
      }
    } finally {
      setGroqBusy(false);
    }
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

  const running = job.running;

  function canSubmit(): boolean {
    if (running) return false;
    if (mode === MODE.url) return url.trim().length > 0;
    return file !== null;
  }

  const orderedFormats = [
    ...FORMAT_ORDER.filter((f) => formats.includes(f)),
    ...formats.filter((f) => !FORMAT_ORDER.includes(f)),
  ];

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function copyResult() {
    if (!job.result) return;
    navigator.clipboard.writeText(job.result.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadResult() {
    if (job.jobId) window.location.href = `/api/jobs/${job.jobId}/download`;
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Waveform bars={7} className="h-8 text-primary" />
      </div>
    );
  }

  if (authRequired && !authed) {
    return (
      <LoginScreen
        t={t}
        password={password}
        onPasswordChange={setPassword}
        onSubmit={submitLogin}
        error={loginError}
        submitting={loggingIn}
        uiLang={uiLang}
        onUiLang={setUiLang}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 md:py-12">
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
            <Tabs value={mode} onValueChange={setMode}>
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

            <Button
              onClick={() => job.start({ mode, url, file, language, format, engine })}
              disabled={!canSubmit()}
              size="lg"
              className="h-12 w-full text-[0.95rem] font-semibold"
            >
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

        {(running || job.logs.length > 0) && (
          <Card className="glass border animate-fade-up">
            <CardContent className="flex flex-col gap-3 py-5">
              <div className="flex items-center gap-3">
                {running ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                )}
                <span className="flex-1 text-sm font-medium">
                  {running ? job.stage : t.progress}
                </span>
                {running && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatElapsed(job.elapsed)}
                  </span>
                )}
              </div>
              {running && <p className="text-xs text-muted-foreground/80">{t.largeFileHint}</p>}
              {job.logs.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
                    {t.showLog}
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-background/60 p-3 font-mono text-[11px] leading-relaxed">
                    {job.logs.map((line, i) => (
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

        {job.error && (
          <Card className="border-destructive/50 bg-destructive/5 animate-fade-up">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{t.errorTitle}</p>
                <p className="text-muted-foreground">{job.error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {job.result && (
          <Card className="glass border shadow-lift animate-fade-up">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="truncate">{job.result.filename}</span>
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
                value={job.result.text}
                className="min-h-[240px] resize-y bg-background/60 font-mono text-sm leading-relaxed"
              />
            </CardContent>
          </Card>
        )}

        <footer className="pt-2 text-center text-xs text-muted-foreground/60">{t.footer}</footer>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        t={t}
        uiLang={uiLang}
        onUiLang={setUiLang}
        engines={engines}
        engine={engine}
        onEngine={setEngine}
        groqKeySet={groqKeySet}
        groqKeyInput={groqKeyInput}
        onGroqKeyInput={setGroqKeyInput}
        groqBusy={groqBusy}
        onSaveGroqKey={saveGroqKey}
        onClearGroqKey={clearGroqKey}
        cookies={cookies}
        cookiesBusy={cookiesBusy}
        onUploadCookies={uploadCookies}
        onClearCookies={clearCookies}
      />
    </div>
  );
}
