# Interaktive Einführung ins DJ-Pult

Einstieg: das runde Hilfeicon unten rechts, identisch mit dem Kategorien-Paket. Es gibt keinen zusätzlichen Hilfe-Button in der Kopfzeile.

Die Integration verwendet die **unveränderte originale Komponente** aus `Animatus/Modules/packages/tutorial/src/frontend/Tutorial.tsx`. Damit sind Auswahl, Spotlight und Abdunklung, Positionierung, Fortschritt, Zurück/Weiter, aktionsabhängige Schritte, Überspringen, Escape sowie Abschluss- und Rückkehranimation gemeinsam implementiert. Ein erneuter Klick auf das Icon öffnet wie in den anderen Apps die Aufgabenauswahl. Die vorherige eigene Tutorial-Oberfläche und deren CSS wurden entfernt.

Die Inhalte stehen in `public/tutorial.json` (Animatus-TutorialDocument, Version 2): Party mit 17 Schritten und DJ mit 39 Schritten einschließlich Grundlagen. Ohne geladene lokale Titel wird der Schritt zum Einreihen ausgelassen. Die Dateiauswahl ist freiwillig, damit die Einführung auch ohne Musikdateien durchlaufen werden kann. Interaktive Schritte haben entsprechend der gemeinsamen Komponente keinen separaten Knopf zum Überspringen einzelner Schritte; „Tutorial überspringen“ beendet die gesamte Führung.

## Pflege und Build

- `src/tutorial/dj-tutorial.jsx`: kleine Einbindung der Originalkomponente und der JSON-Inhalte. Tastatureingaben in den Tutorial-Bedienelementen lösen keine Deck-Hotkeys aus.
- `npm run build:tutorial`: erzeugt `public/dj-tutorial.js` einschließlich React und der originalen Animatus-Komponente. Es werden keine Bibliotheken von einem CDN geladen. Der Build verwendet die bereits installierten Abhängigkeiten des benachbarten Animatus-Repositories.
- Falls das Animatus-Repository woanders liegt: `ANIMATUS_MODULES_ROOT=/pfad/zu/Animatus/Modules npm run build:tutorial`.
- Nach Änderungen an den JSON-Inhalten oder der gemeinsamen Komponente zuerst `npm run build:tutorial`, dann bei Bedarf `npm run build:web` ausführen. Das fertige Bundle ist im Projekt enthalten; reguläre Web-/Hosting-Builds benötigen das benachbarte Repository nicht.
- `public/tutorial.json` bleibt zusätzlich als direkt importierbare Datei im Web-Build enthalten.

## Prüfung

`node scripts/check-dj-tutorial.mjs` verwendet ausschließlich den vorhandenen Server (Standard: `https://127.0.0.1:3030`, überschreibbar mit `ANYDJ_TEST_URL`) und ein eigenes temporäres Browserprofil. Geprüft werden beide Wege bei 1440 und 390 Pixel Breite, das schwebende Hilfeicon, die Originalnavigation und Fortschrittsanzeige, interaktive Bereichsöffnungen, Schritte bei leerer Bibliothek, Überspringen und Abschluss mit Rückkehranimation sowie Escape. Ergebnisse stehen in `reports/dj-tutorial-check.json`.
