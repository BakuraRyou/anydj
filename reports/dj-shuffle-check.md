# Shuffle aus der lokalen Bibliothek

- „Shuffle · alle Dateien“ füllt die aktuelle Warteschlange auf bis zu drei Titel.
- Start bleibt eine eigene Aktion; Ausschalten lässt vorhandene Einträge stehen.
- Die Suche begrenzt die Auswahl nicht. Aktuelle und eingereihte Titel sind ausgeschlossen.
- Verfügbare Titel werden pro Runde einmal ausgewählt; danach beginnt eine neue Runde.
- Fehlende, geänderte oder fehlgeschlagene Dateien werden übersprungen.
- Gespeicherte Listen werden nicht geändert; Start einer gespeicherten Liste beendet Shuffle.
- Leeren schaltet Shuffle aus. Nach Neuladen ist Shuffle zunächst ausgeschaltet.

Prüfung: vier Unit-Tests in test/dj-shuffle.test.mjs erfolgreich. Lokaler
Headless-Chrome-Test mit zwei generierten Demo-Tracks: Start ohne manuelle
Queue-Befüllung, automatischer Übergang, Nachfüllen, Ausschalten und Leeren
bestanden; keine Browserfehler. Die Prüfung erfolgt mit Browseranalyse ohne
physische Lampen. Build: node scripts/build-web.mjs. Kein Live-Deployment.

Reproduktion: node test/dj-shuffle.test.mjs; nach dem Build
node scripts/check-dj-shuffle.mjs.
