import { STORAGE_KEYS } from "@/constants";

export type UiLang = "ru" | "en";

export function toUiLang(value: string): UiLang {
  return value === "en" ? "en" : "ru";
}

export const UI_LANGS: { code: UiLang; label: string }[] = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

export type Strings = {
  tagline: string;
  connectionLost: string;
  a11ySettings: string;
  a11yTheme: string;
  a11yLogout: string;
  source: string;
  tabLink: string;
  tabFile: string;
  urlPlaceholder: string;
  cookiesOn: string;
  cookiesOff: string;
  dropHint: string;
  labelLanguage: string;
  labelFormat: string;
  transcribe: string;
  transcribing: string;
  progress: string;
  showLog: string;
  removeFile: string;
  statusPreparing: string;
  statusDownloading: string;
  statusModel: string;
  statusCompressing: string;
  statusSplitting: string;
  statusTranscribing: string;
  statusPart: string;
  largeFileHint: string;
  errorTitle: string;
  copy: string;
  copied: string;
  download: string;
  footer: string;
  loginSubtitle: string;
  loginPasswordLabel: string;
  loginSubmit: string;
  loginFailed: string;
  settingsTitle: string;
  settingsDesc: string;
  uiLangEyebrow: string;
  groqEyebrow: string;
  groqDesc: string;
  groqPlaceholder: string;
  groqSave: string;
  groqSaved: string;
  groqRemove: string;
  groqGetKey: string;
  modeEyebrow: string;
  modeNote: string;
  cookiesEyebrow: string;
  cookiesDesc: string;
  cookiesConnected: string;
  cookiesReplace: string;
  cookiesUpload: string;
  cookiesGuide: string;
  cookiesStep1: string;
  cookiesStep2: string;
  cookiesStep3: string;
  cookiesStep4: string;
  cookiesStep5: string;
  cookiesStoreLink: string;
  engineLabels: Record<string, string>;
  engineUnavailable: string;
  formatLabels: Record<string, string>;
  spokenLabels: Record<string, string>;
};

export const STRINGS: Record<UiLang, Strings> = {
  ru: {
    tagline: "Расшифровка видео и аудио в текст",
    connectionLost: "Соединение с сервером потеряно",
    a11ySettings: "Настройки",
    a11yTheme: "Тема",
    a11yLogout: "Выйти",
    source: "Источник",
    tabLink: "Ссылка",
    tabFile: "Файл",
    urlPlaceholder: "https://youtube.com/watch?v=…",
    cookiesOn: "YouTube cookies подключены — ролики с ограничениями доступны",
    cookiesOff: "YouTube просит подтвердить, что вы не робот? Настроить cookies →",
    dropHint: "Перетащи аудио/видео сюда или нажми, чтобы выбрать",
    labelLanguage: "Язык записи",
    labelFormat: "Формат",
    transcribe: "Транскрибировать",
    transcribing: "Транскрибирую…",
    progress: "Прогресс",
    showLog: "Подробный журнал",
    removeFile: "Убрать файл",
    statusPreparing: "Готовлю…",
    statusDownloading: "Скачиваю запись…",
    statusModel: "Загружаю модель…",
    statusCompressing: "Сжимаю аудио…",
    statusSplitting: "Разбиваю на части…",
    statusTranscribing: "Распознаю речь…",
    statusPart: "Распознаю часть {n} из {total}…",
    largeFileHint: "Большие файлы могут занять несколько минут — это нормально.",
    errorTitle: "Ошибка",
    copy: "Копировать",
    copied: "Скопировано",
    download: "Скачать",
    footer: "Работает на Whisper (Groq) и faster-whisper",
    loginSubtitle: "Расшифровка видео и аудио в текст",
    loginPasswordLabel: "Пароль доступа",
    loginSubmit: "Войти",
    loginFailed: "Не удалось войти",
    settingsTitle: "Настройки",
    settingsDesc: "Язык интерфейса, доступ и загрузка с YouTube",
    uiLangEyebrow: "Язык интерфейса",
    groqEyebrow: "Groq API-ключ",
    groqDesc:
      "Нужен для облачного движка «Онлайн» (быстрый). Движок «На устройстве» работает и без ключа. Ключ хранится только у тебя на компьютере.",
    groqPlaceholder: "gsk_…",
    groqSave: "Сохранить",
    groqSaved: "Ключ сохранён",
    groqRemove: "Удалить",
    groqGetKey: "Получить ключ",
    modeEyebrow: "Режим распознавания",
    modeNote:
      "«Онлайн» работает через облако и быстрее. «На устройстве» медленнее, зато запись никуда не отправляется.",
    cookiesEyebrow: "YouTube cookies",
    cookiesDesc:
      "Нужны, только если YouTube просит подтвердить, что вы не робот. Загрузите cookies.txt — он хранится локально на этом компьютере и используется для загрузок по ссылке.",
    cookiesConnected: "подключён",
    cookiesReplace: "Заменить",
    cookiesUpload: "Загрузить cookies.txt",
    cookiesGuide: "Как получить cookies.txt?",
    cookiesStep1: "Установите расширение «Get cookies.txt LOCALLY» (Chrome, Edge или Firefox).",
    cookiesStep2: "Откройте окно в режиме инкогнито и войдите на youtube.com.",
    cookiesStep3: "Откройте новую вкладку и закройте вкладку YouTube — чтобы сессия не обновилась.",
    cookiesStep4: "Нажмите на иконку расширения → Export: скачается cookies.txt (не выходя из инкогнито).",
    cookiesStep5: "Закройте окно инкогнито и загрузите cookies.txt здесь.",
    cookiesStoreLink: "Открыть расширение в Chrome Web Store",
    engineLabels: { groq: "Онлайн · быстро", local: "На устройстве · приватно" },
    engineUnavailable: "недоступно",
    formatLabels: {
      txt: "Текст (TXT)",
      docx: "Word (DOCX)",
      pdf: "PDF",
      srt: "Субтитры (SRT)",
      vtt: "Субтитры (VTT)",
      json: "JSON (для разработчиков)",
    },
    spokenLabels: { ru: "Русский", en: "Английский" },
  },
  en: {
    tagline: "Turn video and audio into text",
    connectionLost: "Lost connection to the server",
    a11ySettings: "Settings",
    a11yTheme: "Theme",
    a11yLogout: "Log out",
    source: "Source",
    tabLink: "Link",
    tabFile: "File",
    urlPlaceholder: "https://youtube.com/watch?v=…",
    cookiesOn: "YouTube cookies connected — age/region-restricted videos work",
    cookiesOff: "YouTube asking you to confirm you're not a bot? Set up cookies →",
    dropHint: "Drop audio/video here, or click to choose",
    labelLanguage: "Spoken language",
    labelFormat: "Format",
    transcribe: "Transcribe",
    transcribing: "Transcribing…",
    progress: "Progress",
    showLog: "Detailed log",
    removeFile: "Remove file",
    statusPreparing: "Preparing…",
    statusDownloading: "Downloading…",
    statusModel: "Loading model…",
    statusCompressing: "Compressing audio…",
    statusSplitting: "Splitting into parts…",
    statusTranscribing: "Transcribing…",
    statusPart: "Transcribing part {n} of {total}…",
    largeFileHint: "Large files can take a few minutes — that's normal.",
    errorTitle: "Error",
    copy: "Copy",
    copied: "Copied",
    download: "Download",
    footer: "Powered by Whisper (Groq) and faster-whisper",
    loginSubtitle: "Turn video and audio into text",
    loginPasswordLabel: "Access password",
    loginSubmit: "Sign in",
    loginFailed: "Couldn't sign in",
    settingsTitle: "Settings",
    settingsDesc: "Interface language, access and YouTube downloads",
    uiLangEyebrow: "Interface language",
    groqEyebrow: "Groq API key",
    groqDesc:
      "Needed for the cloud \"Online\" engine (fast). The \"On device\" engine works without it. The key is stored only on your computer.",
    groqPlaceholder: "gsk_…",
    groqSave: "Save",
    groqSaved: "Key saved",
    groqRemove: "Remove",
    groqGetKey: "Get a key",
    modeEyebrow: "Recognition mode",
    modeNote:
      "\"Online\" runs in the cloud and is faster. \"On device\" is slower but nothing leaves your machine.",
    cookiesEyebrow: "YouTube cookies",
    cookiesDesc:
      "Only needed when YouTube asks you to confirm you're not a bot. Upload cookies.txt — it's stored locally on this computer and used for link downloads.",
    cookiesConnected: "connected",
    cookiesReplace: "Replace",
    cookiesUpload: "Upload cookies.txt",
    cookiesGuide: "How do I get a cookies.txt?",
    cookiesStep1: "Install the \"Get cookies.txt LOCALLY\" extension (Chrome, Edge or Firefox).",
    cookiesStep2: "Open a private/incognito window and sign in to youtube.com.",
    cookiesStep3: "Open a new tab and close the YouTube tab, so the session isn't refreshed.",
    cookiesStep4: "Click the extension icon → Export: it downloads cookies.txt (stay in incognito).",
    cookiesStep5: "Close the incognito window, then upload cookies.txt here.",
    cookiesStoreLink: "Open the extension in the Chrome Web Store",
    engineLabels: { groq: "Online · fast", local: "On device · private" },
    engineUnavailable: "unavailable",
    formatLabels: {
      txt: "Text (TXT)",
      docx: "Word (DOCX)",
      pdf: "PDF",
      srt: "Subtitles (SRT)",
      vtt: "Subtitles (VTT)",
      json: "JSON (for developers)",
    },
    spokenLabels: { ru: "Russian", en: "English" },
  },
};

export function getInitialUiLang(): UiLang {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.uiLang);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    return "ru";
  }
  return "ru";
}
