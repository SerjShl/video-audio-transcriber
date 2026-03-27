# Video/Audio Transcriber

Скрипт для транскрибации видео и аудио с YouTube или локальных файлов через Groq Whisper API.

## Требования

- Node.js
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (для YouTube)
- [ffmpeg](https://ffmpeg.org/) (для конвертации больших файлов)

## Установка

1. Установите yt-dlp:
```bash
winget install yt-dlp
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
npm run transcribe <YouTube URL> [язык]
npm run transcribe <путь к файлу> [язык]
npm run transcribe scan [язык]
```

Язык по умолчанию: `ru`

### Примеры

```bash
npm run transcribe https://youtube.com/watch?v=... ru
npm run transcribe ./video.mp4 en
npm run transcribe scan ru
```

### Быстрые команды

```bash
npm run scan_ru   # все файлы из input/, язык: ru
npm run scan_en   # все файлы из input/, язык: en
```

## Результат

Транскрипты сохраняются в папку `transcripts/` в формате `.txt`.
Файлы больше 25 MB автоматически конвертируются через ffmpeg перед отправкой.

## Поддерживаемые форматы

mp4, mp3, wav, m4a, webm, avi, mov, mkv
