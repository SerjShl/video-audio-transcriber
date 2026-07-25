import {
  CheckCircle2,
  Cookie,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Languages,
  Loader2,
  Radio,
  RefreshCw,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Strings, UI_LANGS, type UiLang, toUiLang } from "@/i18n";
import type { Cookies, EngineInfo } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: Strings;
  uiLang: UiLang;
  onUiLang: (lang: UiLang) => void;
  engines: EngineInfo[];
  engine: string;
  onEngine: (name: string) => void;
  groqKeySet: boolean;
  groqKeyInput: string;
  onGroqKeyInput: (value: string) => void;
  groqBusy: boolean;
  onSaveGroqKey: () => void;
  onClearGroqKey: () => void;
  cookies: Cookies;
  cookiesBusy: boolean;
  onUploadCookies: (file: File | null) => void;
  onClearCookies: () => void;
};

export function SettingsDialog(props: Props) {
  const { t, engines } = props;
  const availableEngines = engines.filter((e) => e.available);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> {t.settingsTitle}
          </DialogTitle>
          <DialogDescription>{t.settingsDesc}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 pt-1">
          <section className="rounded-xl border bg-background/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              <span className="eyebrow">{t.uiLangEyebrow}</span>
            </div>
            <Select value={props.uiLang} onValueChange={(v) => props.onUiLang(toUiLang(v))}>
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

          <section className="rounded-xl border bg-background/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <span className="eyebrow">{t.groqEyebrow}</span>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t.groqDesc}</p>
            {props.groqKeySet ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {t.groqSaved}
                </span>
                <Button variant="ghost" size="sm" onClick={props.onClearGroqKey} disabled={props.groqBusy}>
                  <Trash2 className="h-4 w-4" /> {t.groqRemove}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={t.groqPlaceholder}
                  value={props.groqKeyInput}
                  onChange={(e) => props.onGroqKeyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") props.onSaveGroqKey();
                  }}
                />
                <Button
                  onClick={props.onSaveGroqKey}
                  disabled={props.groqBusy || !props.groqKeyInput.trim()}
                >
                  {props.groqBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.groqSave}
                </Button>
              </div>
            )}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {t.groqGetKey} <ExternalLink className="h-3 w-3" />
            </a>
          </section>

          {availableEngines.length > 1 && (
            <section className="rounded-xl border bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <span className="eyebrow">{t.modeEyebrow}</span>
              </div>
              <Select value={props.engine} onValueChange={props.onEngine}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableEngines.map((e) => (
                    <SelectItem key={e.name} value={e.name}>
                      {t.engineLabels[e.name] ?? e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.modeNote}</p>
            </section>
          )}

          <section className="rounded-xl border bg-background/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Cookie className="h-4 w-4 text-primary" />
              <span className="eyebrow">{t.cookiesEyebrow}</span>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t.cookiesDesc}</p>

            {props.cookies.present ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                <span className="flex items-center gap-2 truncate text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">
                    {props.cookies.name} · {t.cookiesConnected}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <RefreshCw className="h-3.5 w-3.5" /> {t.cookiesReplace}
                    <input
                      type="file"
                      accept=".txt"
                      className="hidden"
                      disabled={props.cookiesBusy}
                      onChange={(e) => props.onUploadCookies(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={props.onClearCookies}
                    disabled={props.cookiesBusy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40">
                {props.cookiesBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {t.cookiesUpload}
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  disabled={props.cookiesBusy}
                  onChange={(e) => props.onUploadCookies(e.target.files?.[0] ?? null)}
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
                <li>{t.cookiesStep5}</li>
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
  );
}
