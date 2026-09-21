# Statische Web-Demo — 2026-09-20

- Build: `npm run build:web`, Ausgabe `dist/web/` (ca. 384 KiB).
- Fertiges Upload-Archiv: `dist/anydj-web.zip` (ca. 109 KiB).
- Startseite + DJ-Anwendung; keine Modelle, Python-Laufzeiten, Serverdateien, Musikaufnahmen oder Lampenkonfigurationen im Web-Paket.
- Analyse im Browser, separate Web-Bibliothek, lokale synthetische Demo-Tracks.
- Keine direkte Lampensteuerung; keine KI-Songstruktur und kein Auto Beat in der Web-Ausgabe.

Chrome-Test über einen reinen statischen HTTP-Server unter `/preview/anydj/`:

- Startseite bei 1280 und 390 Pixeln ohne horizontalen Überlauf.
- Beide Demo-Tracks erfolgreich analysiert, Status „Browseranalyse fertig“.
- Beide Decks geladen, Audio abgespielt, gemischte Farbvorschau aktiv.
- Warteschlange gefüllt; Analyse-Cache nach Neuladen wiederhergestellt.
- Mobilansicht der DJ-Anwendung ohne horizontalen Überlauf.
- Nach Wiedergabe und Neuladen inklusive Wartezeit auf Verbindungs-Timer: **0 API-Anfragen, 0 Uploads, 0 Browserfehler**.
- Bestehender DJ-Browsertest mit KI-Simulation, Farbauswahl, Auto Beat und Cache ebenfalls erfolgreich.
- Gesamte Testsuite: **210 bestanden**, keine Fehler.

Lokale Vorschau mit `npm run preview:web`; öffentliches Hosting wurde nicht durchgeführt.
Hosting-Anleitung: `web/README.md`. Browserabdeckung bisher Chrome; kein realer Mobilgeräte-Test.
