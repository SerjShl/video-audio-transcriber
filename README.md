# Video/Audio Transcriber

Скрипт для транскрибации видео и аудио по ссылке (YouTube и сотни других сайтов) или из локальных файлов через Groq Whisper API.

## Требования

- Node.js
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — для скачивания по ссылке
- [ffmpeg](https://ffmpeg.org/) (включая `ffprobe`) — для конвертации и нарезки больших файлов

> Скрипт проверяет наличие этих утилит при запуске и подсказывает, чего не хватает.
> Держите yt-dlp в актуальной версии (`yt-dlp -U` или `winget upgrade yt-dlp`) — устаревшая версия часто перестаёт скачивать с YouTube.

## Установка

1. Установите yt-dlp и ffmpeg:
```bash
winget install yt-dlp
winget install ffmpeg
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте `.env` файл и добавьте API ключ Groq:
```
GROQ_API_KEY=gsk_...
```

Получить ключ: https://console.groq.com/keys

## Использование

```bash
npm run transcribe <URL> [язык] [--keep]
npm run transcribe <путь к файлу> [язык]
npm run transcribe scan [язык]
```

Язык по умолчанию: `ru`

### Примеры

```bash
npm run transcribe https://youtube.com/watch?v=... ru
npm run transcribe https://vimeo.com/... en
npm run transcribe ./video.mp4 en
npm run transcribe scan ru
```

### Быстрые команды

```bash
npm run scan_ru   # все файлы из input/, язык: ru
npm run scan_en   # все файлы из input/, язык: en
```

## Возможности

- **Любые ссылки.** Поддерживается всё, что умеет yt-dlp — YouTube, Vimeo, X/Twitter, TikTok и другие.
- **Автообработка больших файлов.** Файлы больше 25 MB сжимаются через ffmpeg, а слишком длинные записи автоматически режутся на части и склеиваются в один транскрипт.
- **Аккуратное форматирование.** Текст разбивается на абзацы по сегментам Whisper, без разрывов на сокращениях и числах.
- **Параллельный `scan`.** Файлы из `input/` обрабатываются одновременно (по умолчанию 3, см. `SCAN_CONCURRENCY`).

## Флаги и переменные окружения

| Параметр | Описание |
| --- | --- |
| `--keep` | Не удалять скачанное аудио после транскрибации (остаётся в `downloads/`). |
| `YT_DLP_BROWSER` | Браузер для cookies, если YouTube требует «Sign in to confirm you're not a bot» (`chrome`, `edge`, `firefox`, `brave`, ...). |
| `KEEP_AUDIO=true` | То же, что флаг `--keep`. |
| `SCAN_CONCURRENCY` | Сколько файлов обрабатывать параллельно в режиме `scan` (по умолчанию 3). |

Пример с cookies из браузера:
```bash
# в .env: YT_DLP_BROWSER=chrome
npm run transcribe https://youtube.com/watch?v=... ru
```

## Результат

Транскрипты сохраняются в папку `transcripts/` в формате `.txt`.

## Поддерживаемые форматы

Режим `scan` подхватывает из `input/`: mp4, mp3, wav, m4a, webm.
По прямому пути к файлу принимается любой формат, который умеет читать ffmpeg (mov, mkv, avi и др.).
