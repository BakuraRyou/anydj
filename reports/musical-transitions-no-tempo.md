# Musikalische Übergänge ohne Tempoänderung

Die bisherige Auto-Beat-Regelung veränderte playbackRate beim Start und laufend
während der Wiedergabe. Das entsprach nicht dem gewünschten Zweck und wurde
entfernt. Der Schalter heißt jetzt „Musikalische Übergänge“ und steuert die
Startauswahl für Auto-Crossfade und Warteschlange.

Bei aktivem Schalter werden Taktanfänge bzw. darauf liegende Abschnittsgrenzen
nahe dem Songende bevorzugt. Fehlt ein brauchbares Raster oder ist der Schalter
aus, gilt der zeitbasierte Start. Die Dauer des Crossfades bleibt einstellbar.
Ein manuell gestarteter Crossfade erfolgt weiterhin sofort. Der normale
Play-Start verschiebt keine Beatphase mehr. Originaltempo bleibt bestehen,
sofern es nicht mit Tempo-Regler oder Sync ausdrücklich verändert wurde.

Prüfung mit echten erzeugten Audiodateien und unterschiedlichen simulierten
Beat-Rastern (120 und 100 BPM):
- Musikalischer Start bei ungefähr 8 statt 9 Sekunden.
- Bei ausgeschalteter Option Start bei ungefähr 9 Sekunden.
- Musikalischer Übergang auch aus der Warteschlange.
- Alle drei Läufe prüfen sämtliche playbackRate-Schreibzugriffe: kein Wert
  weicht vom Originaltempo 1 ab, auch nicht kurzzeitig beim Start.
- Die vorhandenen DJ-Performance-Prüfungen prüfen manuelles Tempo und Sync
  weiterhin getrennt von der musikalischen Startauswahl.

Die Auswahl bleibt eine Heuristik auf Basis der vorhandenen Songanalyse,
kein harmonisches Mixing und keine garantierte musikalische Eignung jedes Paars.
