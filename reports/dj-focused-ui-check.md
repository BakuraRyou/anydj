# Reduzierte Bedienhierarchie

- Standardansicht priorisiert Track, Wellenform, Position und Play/Cue.
- Ein Einstieg „Deck einstellen“ bündelt Cue-Verwaltung, Lautstärke/Pegel, Mix-Werkzeuge und Lichtgestaltung. Aktive Loops, Vorhören und manuelles Tempo bleiben in der Zusammenfassung erkennbar.
- Lichtoptionen sind einklappbar; Lichtshow und Übergänge bleiben getrennt.
- Erfolgreiche Analysemeldungen werden visuell ausgeblendet; Fortschritt und Fehler bleiben sichtbar.
- Der obere Arbeitsbereich ist auf maximal 480 px begrenzt. Bibliothek und Warteschlange erhalten den übrigen Platz.

Prüfung:
- `node scripts/check-dj-layout.mjs`: Desktop 1440 px, Tablet 1024 px, Mobil 390 px; kein horizontaler Überlauf, Bedienung und Fokus erfolgreich.
- `node scripts/check-dj-focused-ui.mjs`: Zwei echte Audiodateien, Hauptaktionen ohne Scrollen sichtbar, abgeschlossene Analyse ausgeblendet, aktives Tempo bei geschlossenen Deck-Einstellungen erkennbar, Wiedergabe und Stopp erfolgreich; keine JavaScript-Ausnahmen.
- Vorschau: `reports/ux-focused-loaded.png`.
