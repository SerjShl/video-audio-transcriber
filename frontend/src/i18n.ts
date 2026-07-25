// Lightweight UI internationalisation. The transcription content language
// (what Whisper listens for) is separate — this only translates the interface.

export type UiLang = "ru" | "en";

export const UI_LANGS: { code: UiLang; label: string }[] = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

type Strings = {
  tagline: string;
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
  accessEyebrow: string;
  accessToggle: string;
  accessOnDesc: string;
  accessNeedPassword: string;
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
  cookiesStoreLink: string;
  engineLabels: Record<string, string>;
  engineUnavailable: string;
  formatLabels: Record<string, string>;
};

export const STRINGS: Record<UiLang, Strings> = {
  ru: {
    tagline: "Расшифровка видео и аудио в текст",
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
    accessEyebrow: "Доступ",
    accessToggle: "Требовать пароль для входа",
    accessOnDesc: "Когда включено — сайт открывается только по паролю.",
    accessNeedPassword: "Задайте APP_PASSWORD на сервере, чтобы включить.",
    modeEyebrow: "Режим распознавания",
    modeNote:
      "«Онлайн» работает через облако и быстрее. «На устройстве» медленнее, зато запись никуда не отправляется.",
    cookiesEyebrow: "YouTube cookies",
    cookiesDesc:
      "Нужны, только если YouTube просит подтвердить, что вы не робот. Загрузите cookies.txt один раз — он хранится на сервере и применяется ко всем загрузкам по ссылке, поэтому остальным ничего настраивать не нужно.",
    cookiesConnected: "подключён",
    cookiesReplace: "Заменить",
    cookiesUpload: "Загрузить cookies.txt",
    cookiesGuide: "Как получить cookies.txt?",
    cookiesStep1: "Установите расширение «Get cookies.txt LOCALLY» для Chrome, Edge или Firefox.",
    cookiesStep2: "Откройте youtube.com и войдите в свой аккаунт.",
    cookiesStep3: "Нажмите на иконку расширения → Export: скачается файл cookies.txt.",
    cookiesStep4:
      "Загрузите его здесь. Обновляйте раз в пару месяцев или если перестанет работать.",
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
  },
  en: {
    tagline: "Turn video and audio into text",
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
    accessEyebrow: "Access",
    accessToggle: "Require a password to enter",
    accessOnDesc: "When on, the site opens only with the password.",
    accessNeedPassword: "Set APP_PASSWORD on the server to enable this.",
    modeEyebrow: "Recognition mode",
    modeNote:
      "\"Online\" runs in the cloud and is faster. \"On device\" is slower but nothing leaves your machine.",
    cookiesEyebrow: "YouTube cookies",
    cookiesDesc:
      "Only needed when YouTube asks you to confirm you're not a bot. Upload cookies.txt once — it's stored on the server and used for every link, so nobody else has to set anything up.",
    cookiesConnected: "connected",
    cookiesReplace: "Replace",
    cookiesUpload: "Upload cookies.txt",
    cookiesGuide: "How do I get a cookies.txt?",
    cookiesStep1: "Install the \"Get cookies.txt LOCALLY\" extension for Chrome, Edge or Firefox.",
    cookiesStep2: "Open youtube.com and sign in to your account.",
    cookiesStep3: "Click the extension icon → Export: it downloads a cookies.txt file.",
    cookiesStep4: "Upload it here. Refresh it every couple of months or when downloads start failing.",
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
  },
};

export function getInitialUiLang(): UiLang {
  try {
    const saved = localStorage.getItem("vat_ui_lang");
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ru")
    ? "ru"
    : "en";
}
