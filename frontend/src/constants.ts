export const MODE = {
  url: "url",
  file: "file",
};

export const ENGINE = {
  groq: "groq",
  local: "local",
};

export const MODES: readonly string[] = [MODE.url, MODE.file];

export const STORAGE_KEYS = {
  uiLang: "vat_ui_lang_v2",
  dark: "vat_dark",
  mode: "vat_mode",
  language: "vat_language",
  format: "vat_format",
  engine: "vat_engine",
};

export const DEFAULTS = {
  language: "ru",
  format: "txt",
  engine: ENGINE.groq,
  mode: MODE.url,
};
