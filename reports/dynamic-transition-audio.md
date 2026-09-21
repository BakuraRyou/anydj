# Dynamische Audioausführung

21. September 2026. Die Anpassung verwendet ausschließlich die vorhandenen
20-ms-RMS-Fenster der geladenen Titel. Keine gespeicherten Songkombinationen,
zusätzlichen Modelle oder Tempoänderungen.

`public/transition-audio.js` berechnet einen RMS-Mittelwert über die tatsächlichen
Überlagerungsbereiche, unter Berücksichtigung der Wiedergaberaten. Bei musikalischer
Automatik wird die lineare Mischung anhand einer Schätzung für unkorrelierte
Signale in Richtung eines gleichmäßigeren Energieverlaufs angehoben. Der Faktor
ist auf 2 dB begrenzt und sinkt bei hohen RMS-Pegeln. Endpunkte bleiben erhalten,
einzelne Faderverstärkungen bleiben zwischen 0 und 1. Kanalpegel und Trim zum
Startzeitpunkt gehen in die Kurvenberechnung ein. EQ-Frequenzgänge und tatsächliche
Signal-Korrelation werden nicht simuliert.

Fehlende/ungültige Daten, Stille, derselbe Bibliothekstitel, kurze Wechsel,
stummgeschaltete Kanäle und Starts aus einer mittleren Crossfaderposition verwenden
die bisherigen Kurven. Ein bereits laufendes Zieldeck erhält keinen RMS-Ausgleich.
Die Berechnung wird beim Start auf tatsächliche Positionen und Restlaufzeiten
angepasst. Automatisch gewählte Zeitpunkte und Stile verwenden weiterhin die
bisherige musikalische Bewertung; diese Änderung ergänzt deren Audioausführung.

Beide Fader werden per `setValueCurveAtTime` geplant. Kanalpegel haben separate
GainNodes, sodass ihre Bedienung die geplanten Faderkurven nicht überschreibt.
Abbruch hält zunächst den aktuellen Parameterwert und übergibt geglättet an die
manuelle Steuerung. Die Bassfilter verwenden beim Zurücksetzen ebenfalls diese
Unterbrechungslogik. Grundlage ist die
[Web-Audio-Spezifikation zu AudioParam](https://webaudio.github.io/web-audio-api/#AudioParam).
Grafik und Hörprobe verwenden dieselbe Verstärkungsfunktion wie die Wiedergabe.

Die Anzeige und der Auslöser des Übergangs verwenden weiterhin einen Timer;
Media-Elemente starten weiterhin asynchron. Diese Änderung garantiert deshalb
keinen samplegenauen Start der Titel. RMS ist keine wahrgenommene Lautheit nach
LUFS und keine True-Peak-Messung. Der Master-Limiter bleibt bestehen. Eine
semantische Phrasenerkennung und die Bewertung vorgerenderter Audiomischungen
sind weitere, hier nicht umgesetzte Ausbaustufen. Hörbare Gesamtqualität ist durch
die technischen Tests allein nicht belegt.

Validierung:

- `npm test`: 326 Tests erfolgreich. Neue Tests prüfen unterschiedliche RMS-Pegel,
  Kurvenstile, Grenzen, fehlende Daten, Wiedergaberaten und manuelle Übernahme.
- `node scripts/check-musical-crossfade.mjs --pair --adaptive --preview`: Übergang,
  Bassfilter, Variantenwahl und isolierte Hörprobe im Browser erfolgreich.
- `node scripts/check-musical-crossfade.mjs --pair --adaptive --audio-clock --cancel`:
  Audiokurven laufen bei 450 ms blockiertem UI-Thread weiter; Abbruch und
  anschließende manuelle Fadersteuerung erfolgreich.
- Browserregressionen mit `--queue --plain` und `--pair --adaptive --cut`:
  zeitbasierte Warteschlange und kurzer Wechsel ebenfalls erfolgreich.
