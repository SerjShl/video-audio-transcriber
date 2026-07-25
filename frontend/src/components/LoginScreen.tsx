import { AlertCircle, Languages, Loader2, Lock, Radio } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Strings, UI_LANGS, type UiLang, toUiLang } from "@/i18n";

type Props = {
  t: Strings;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  error: string | null;
  submitting: boolean;
  uiLang: UiLang;
  onUiLang: (lang: UiLang) => void;
};

export function LoginScreen({
  t,
  password,
  onPasswordChange,
  onSubmit,
  error,
  submitting,
  uiLang,
  onUiLang,
}: Props) {
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
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Label className="eyebrow flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> {t.loginPasswordLabel}
            </Label>
            <Input
              type="password"
              autoFocus
              placeholder="••••••••"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="h-11 text-center tracking-widest"
            />
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={submitting || !password} className="mt-1 w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.loginSubmit}
            </Button>
          </form>
        </div>
        <div className="mt-4 flex justify-center">
          <Select value={uiLang} onValueChange={(v) => onUiLang(toUiLang(v))}>
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
        </div>
      </div>
    </div>
  );
}
