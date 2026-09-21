# Gemeinsamer Übergangsplan für zwei Titel

Stand: 20. September 2026. Ergänzt den vorherigen Audit in `musical-transition-audit.md`.

Sobald beide Decks vorbereitete Shows haben, vergleicht der Planer begrenzte
Ein-/Ausstiegskandidaten anhand vorhandener Instrumentenaktivität, Energie und
Beat-Abweichung. Die Auswahl wird gecacht und bei Änderungen an Shows, Cue,
Tempo, Dauer oder musikalischem Modus erneuert. Während eines Übergangs bleibt
sie fest. Die Vorschau zeigt die Variante im Mixer.

Drei Varianten: sanfter Crossfade, Bassübergabe über separate Low-Shelf-Filter,
kurze Überlagerung über eine steilere Crossfader-Kurve. Die Dauer ist durch die
Nutzereinstellung und die Restspielzeiten beider Titel begrenzt. Manuelles
Überblenden plant ab der aktuellen Position. Kein automatisches Time-Stretching,
keine Änderung der manuellen EQ-Regler. Ende und Abbruch setzen Übergangsfilter
zurück. Ohne Instrumentendaten gelten die bisherigen musikalischen Startregeln.

## Prüfung

- `npm test`: 266 Tests erfolgreich, einschließlich Paarwahl, Cue-Grenzen,
  kurzer Titel, manueller Startposition und monotoner Überblendkurve.
- Browser: Paarplan mit Bassübergabe, Abbruch und Filterreset; feste Übergänge
  ohne musikalischen Modus; Warteschlangen-Nachladen nach mehreren Übergängen.
- Layout: 1440, 1024 und 390 Pixel; kein horizontaler Überlauf.
- Browserprüfungen verwenden synthetische Audiodateien und deterministische
  Analyseantworten. Sie bestätigen Steuerung und Audioparameter, nicht die
  subjektive Qualität einer Mischung realer Songs.

## Grenzen

Heuristische Bewertung vorhandener KI-Instrumentenverläufe, kein neu trainiertes
Mix-Modell. Keine garantierte Hook-Erkennung, Harmonieprüfung oder Echo-/Stem-
Remixes. Sehr unterschiedliche Tempi werden durch kürzere Überlagerung behandelt,
nicht synchronisiert. Fehlende Analyse und verspätet bereitgestellte Titel können
keinen optimalen Übergang garantieren. Hörtests mit unterschiedlichen echten
Songpaaren bleiben zur weiteren Feinabstimmung sinnvoll.
