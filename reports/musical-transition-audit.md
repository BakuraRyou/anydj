# Prüfung der musikalischen Übergänge

Stand: 20. September 2026. Codeprüfung des Startpunkts, Einstiegs, Audiomixers, Abbruchs, Warteschlangenverbrauchs und Deck-Nachladens; Browsertests mit echten Audiodateien und kontrollierten Analyseergebnissen. Kein subjektiver Hörvergleich unterschiedlicher Musikgenres.

## Aktuelles Verhalten

- `public/musical-transition.js`: Ausstieg frühestens in der zweiten Songhälfte. Kandidaten liegen höchstens vier Sekunden (bei Originaltempo) vor dem normalen Startpunkt Dauer minus Fade-Länge; Abschnittsgrenzen auf Downbeats erhalten Vorrang. Ohne brauchbares Raster gilt der feste Zeitmodus.
- Eingang: erster plausibler Downbeat zwischen Cue und Cue + 2 Sekunden. Keine Suche nach einer Hook, kein Vergleich beider Songs.
- Übergangsdauer: Sekundenwert, begrenzt durch verbleibende Spielzeit beider Decks; keine automatische Wahl ganzer Phrasen.
- Audio: lineare Deck-Gains, per 25-ms-UI-Timer mit kurzer AudioParam-Glättung aktualisiert. Kein automatischer Basswechsel, Filter, Echo oder Stem-Mix. Lineare Gains können in der Mitte bei unkorrelierten Songs einen Pegelabfall verursachen; eine andere Kurve erfordert Headroom- und Hörtests.
- Musikalische Übergänge verändern die Abspielgeschwindigkeit nicht. Bei unterschiedlichen Tempi bleiben die Beats während längerer Überlagerungen deshalb nicht synchron.
- Warteschlange: konsumiert erst nach erfolgreichem Start, behandelt ein natürliches Ende während verzögertem Start als Übergabe und lädt das freie Deck nach. Ende der Liste leert das freigewordene Deck.

## Gefundener und korrigierter Fehler

Der manuelle Überblenden-Knopf berücksichtigte den musikalischen Einstieg außerhalb einer laufenden Warteschlange nicht. Reproduziert: Cue 0,6 s blieb unverändert, obwohl ein Downbeat bei 2,4 s lag und die Option aktiviert war. Der Knopf berücksichtigt jetzt die Option unabhängig von der Warteschlange. Der manuell angeforderte Übergang beginnt weiterhin sofort; er wartet nicht automatisch auf den nächsten Ausgangstakt.

## Erweiterungsentwurf

1. Kompakte Merkmale pro Beat/Phrase dauerhaft vorbereiten: Bass-/Mitten-/Höhenenergie, Lautheit, Transienten, lokale Harmonie, Gesangs- und Schlagzeugaktivität. Die derzeitigen Analysefenster werden nach Strukturverfeinerung verworfen; Lichtfarben sind kein geeigneter Ersatz für Audio-Merkmale.
2. Benachbarte Songs gemeinsam bewerten: Ausstieg, Einstieg, Phrasenlänge, Tempoverträglichkeit, Gesangskollision, Bassüberlagerung, Energieverlauf und Konfidenz. Plan nach Wahl der nächsten Datei fixieren; bei Umordnung, Cue- oder Tempoänderung neu berechnen.
3. Wenige nachvollziehbare Übergangstypen: kurzer/weicher Crossfade, Bassübergabe mit EQ, Echo-Ausklang mit prägnantem Einstieg, Hook-Einstieg nach erkannter Gesangspause. Nicht jeder Refrain ist automatisch eine geeignete Hook.
4. Effekte und Gains auf der AudioContext-Zeitachse planen; bei Abbruch/Seek/Stopp alle Automation und Effektfahnen kontrolliert zurücksetzen, Nutzer-EQ erhalten. Aufnahme, Kopfhörer und Licht erhalten denselben Übergangszeitplan.
5. Vorhandene lokale Modelle weiterverwenden: Beat This! für Raster; All-In-One für Abschnitte; Demucs für Instrumententrennung. Aktuell werden nur Aktivitätsmerkmale gespeichert, keine getrennt abspielbaren Stems. Echter Vocal-/Stem-Mix benötigt zusätzliche Wiedergabe- und Cache-Unterstützung.
6. Optional später ein kleines gelerntes Bewertungsmodell aus bewerteten Übergangspaaren. Ein Musik-Embedding-Modell kann Ähnlichkeit unterstützen, ersetzt aber keine zeitliche Übergangsplanung. Ein Sprachmodell ist nicht für die zeitkritische Audiosteuerung vorgesehen.

## Validierung

- Unit-Tests: `test/musical-transition.test.mjs`, `test/beat-sync.test.mjs`, `test/dj.test.mjs`.
- `scripts/check-musical-crossfade.mjs`: musikalischer Auto-Modus für Decks, `--queue`, fester Vergleich `--queue --plain`, manueller musikalischer Einstieg `--manual`; 120/100-BPM-Raster ohne automatische Tempoänderung.
- `scripts/check-dj-deck-refill.mjs`: acht unterschiedliche Titel, sieben Übergaben, manueller Übergang, verzögerter Start über das alte Songende hinaus, Nachladen und Leeren des freien Decks.

Referenzen: https://github.com/CPJKU/beat_this · https://github.com/mir-aidj/all-in-one · https://github.com/facebookresearch/demucs
