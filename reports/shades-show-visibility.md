# Show: Bewegung und Sichtbarkeit gemeinsam prüfen

## Anlass und Befund

Im Video `anydj_preview_epic-2026-09-27_00.21.mp4` läuft auf Deck A
`Shades.mp3`, ungefähr ab 0:36. Die kurzen Belichtungen lassen einzelne
abweichende Ausrichtungen besonders auffallen. Aus dem Video allein lässt sich
deren Ursache nicht eindeutig bestimmen.

Die Prüfung der Bewegungskette hat zwei reproduzierbare Fehler ergeben:

- Dunkle Köpfe konnten ohne zusätzliche Gruppenbewegung ihre Motorbewegung
  anhalten, obwohl das Show-Bild weiterlief. Beim nächsten Einblenden folgten
  sie deshalb nicht mehr derselben Bahn wie durchgehend sichtbare Köpfe.
- Bei vorhandener Gruppenbewegung konnte die Gewichtung der Gruppen die
  Auswahl und Aktionsmasken des Show-Bildes überschreiben. Damit erschienen
  Köpfe, die die Show zu diesem Zeitpunkt ausblenden wollte.

Aktive Show-Bilder lassen ihre Köpfe jetzt auch dunkel der Bewegung folgen.
Die Show-Auswahl und ihre Aktionsmasken bleiben für die Sichtbarkeit maßgeblich.
Gehaltene Bilder, Stille und manuelle Rhythmen erhalten keine zusätzliche
Freigabe für laufende Show-Bewegung. Die Änderungen erhöhen keine Lichtleistung.

## Prüfung

- 849 Tests erfolgreich, darunter drei neue Regressionstests für Masken nach
  räumlicher Gruppierung, Motorphasen bei dunklen Köpfen und Ruhe-/manuelle Fälle.
- Die Motorprüfung vergleicht 240 aufeinanderfolgende Frames eines dauerhaft
  sichtbaren Kopfes mit einem zwischenzeitlich vollständig dunklen Kopf.
  Beide folgen derselben Bahn; das dunkle Gerät bleibt dabei ausgeschaltet.
- `Shades.mp3` wurde frisch einschließlich Struktur-/Instrumentenanalyse
  ausgewertet. Die Offline-Wiedergabe von 36–45 s verwendet den Raum
  „Club Bühne Publikum und Hintergrund“, 48 Moving Heads, 30 Messungen/s,
  berechnete Farben und Belichtungen, Raumbegrenzungen und Motorsimulation.
- 248 Wiedereinblendungen über alle Köpfe. Größte Richtungsänderung zwischen
  zwei Messungen ca. 2,94°, bei Wiedereinblendungen ca. 2,92°. Auftreffpunkte
  können dabei auf entfernten Flächen mehrere Meter wandern; die Entfernung
  allein ist kein verlässliches Maß für einen Richtungssprung.

Reproduzierbar mit einem exportierten Analyseplan:

```sh
node scripts/review-show-visibility.mjs plan.json /tmp/show-trace.json 36 45
```

Die Datei enthält pro Kopf und Zeitpunkt die Sichtbarkeit, das geplante
Raumziel, das Ziel nach Routing/Motoren, Richtungsänderung und Wiedereinblendung.

## Aussagegrenzen

Dies ist keine exakte Wiederholung des aufgenommenen Browserzustands.
Gespeicherte Bedienwerte, der vorgeschaltete Positionsfilter, Vorhersage und
GPU-Rendering werden nicht nachgebildet. Die beiden Codefehler sind behoben;
ob damit alle sichtbaren Auffälligkeiten des Videos verschwinden, muss am
laufenden Bild geprüft werden. Die Show-Cache-Version wurde auf 40 angehoben.
