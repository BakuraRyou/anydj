# Gespeicherte DJ-Lichtshows

IndexedDB `wiz-dj-library` erhält in Version 3 einen separaten `shows`-Store.
Trackreferenzen, Ordnereinstellungen und Warteschlange bleiben erhalten.
Gespeichert werden die unveränderte Basis-Show, noch benötigte Analysefenster
und der Zustand der Teilanalysen. Party/Disco werden beim Laden auf die Basis
angewandt. Nach abgeschlossener Strukturverfeinerung ersetzt deren Ergebnis
die Basis im Speicher; die nicht mehr benötigten Analysefenster entfallen.

Cache-Abgleich: Track-ID, Dateiname, Größe, Änderungsdatum, SHOW_PLAN_VERSION
und Gestaltungsoptionen. Dies ist ein Metadatenvergleich, kein Inhalts-Hash.
Abweichungen führen zur normalen Neuberechnung. Beim Entfernen von Tracks
werden deren gespeicherte Shows ebenfalls entfernt. Speicherfehler lassen die
aktuelle Show nutzbar und zeigen einen Hinweis in der Bibliothek.

## Validierung

- 163 Tests erfolgreich, einschließlich Cache-Abgleich für geänderte Dateien,
  Optionen und Versionen sowie fehlende/unvollständige Datensätze.
- `node scripts/check-dj-show-cache.mjs`: stummer Chrome-Demo-Test mit generierten
  WAV/MP3-Dateien und simulierten Modellantworten; keine echten Lampen.
- Bestehende IndexedDB-Version 2 auf 3 migriert, gespeicherte Queue erhalten.
- Zwei Tracks berechnet und gespeichert. Nach echtem Seiten-Reload Shows und
  ausstehende Analysefenster wiederhergestellt. Musikdateien erneut importiert,
  Deck geladen: **0 erneute Analyseaufrufe**.
- Geänderte Datei-Metadaten und Optionen verworfen; gespeicherten vollständigen
  Analysezustand sowie Löschen eines Cache-Eintrags geprüft.
- Drei Queue-Einträge mit zwei automatischen Crossfades, Reihenfolge, Entfernen,
  Wiederherstellung ohne Autoplay und Layout auf drei Bildschirmgrößen geprüft.
- Rohresultat: `dj-show-cache-browser-check.json`; keine Browser-Ausnahmen.

## Grenzen

Die Speicherung gilt für Browserprofil und Origin (Adresse inklusive Port).
Audio wird nicht gespeichert. Dateiberechtigungen/erneutes Verknüpfen bleiben
bei Bedarf erforderlich. Löschen der Browserdaten oder browserseitiges Freigeben
von Speicher entfernt den Cache. Speicherquotenfehler wurden nicht künstlich
im Browser erzeugt. Bereits vor Einführung dieser Funktion berechnete, nicht
persistierte Shows müssen einmal neu vorbereitet werden.
