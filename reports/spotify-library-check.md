# Spotify-Bibliothek: Prüfung

Implementiert: Quellen-Tabs, PKCE-Anmeldung im separaten Fenster, Token-Erneuerung,
Playlists und Lieblingssongs, Suche (zehn Treffer pro API-Seite), Playlist-Link,
Pagination, bestätigte lokale Zuordnungen, Deck A/B, Drag & Drop, Sammel-Einreihen
und Speichern vollständiger geladener Ansichten als lokale DJ-Liste.

Die öffentliche API wird ausschließlich für Metadaten verwendet. Spotify-Audio
wird weder heruntergeladen noch analysiert, aufgezeichnet oder gemischt. Fehlende
Zuordnungen werden gezählt und beim Einreihen ausgelassen. Dateien ohne aktuellen
Dateizugriff müssen neu verbunden werden. Wiederholungen bleiben erhalten.

## Automatisierte Ergebnisse

- `node --test test/app.test.mjs test/dj-show-cache.test.mjs test/spotify.test.mjs`:
  35 Tests bestanden.
- `npm run build:web`: erfolgreich, inklusive Callback-Seite und Provider-Modulen.
- `node scripts/check-spotify.mjs`: bestanden, simulierte Spotify-Antworten;
  tatsächliches Callback-Modul mit PKCE-Code-Austausch und BroadcastChannel-Übergabe,
  Zuordnung, Queue, DJ-Liste, echte lokale Audio-Wiedergabe, Pagination, Lieblingssongs,
  Suche, Trennen ohne Audio-Unterbrechung, Unterordner-Hosting und Mobilansicht.
- Syntaxprüfung der geänderten JavaScript-Einstiegspunkte und `git diff --check`:
  bestanden.
- Sichtprüfung: `/tmp/anydj-spotify-1280.png` und `/tmp/anydj-spotify-390.png`.

## Grenzen der Verifikation

Kein Live-Spotify-Konto und keine Client ID wurden bereitgestellt. Tatsächliche
Spotify-App-Freigabe, Kontoberechtigungen und Live-Anmeldung bleiben manuell zu
prüfen. Der Electron-Fensterhandler wurde angepasst und syntaktisch geprüft;
ein Electron-Laufzeittest war ohne installiertes Electron-Binary nicht möglich.

Der bestehende Test `scripts/check-web.mjs` scheitert an seiner Erwartung, dass
`#autoBeat` in der Web-Ausgabe deaktiviert ist. Diese deaktivierende Zuweisung
existiert im aktuellen Arbeitsstand nicht; der Spotify-Umbau ändert diesen
Schalter nicht. Eine temporäre Testkopie ohne diese einzelne Erwartung besteht
alle übrigen Prüfungen (Demo-Audio, Analyse, Queue, Cache, mobile Breite, keine
ungefragten API-Anfragen oder Uploads). Der ursprüngliche Test bleibt unverändert.
