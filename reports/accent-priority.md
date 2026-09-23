# Akzentpriorität statt gefüllter Zwischenräume

23. September 2026 · Show-Version 22 / Arrangement-Version 8.

Auslöser war die Rückmeldung zu RobbieWilliamsBoddies.mp3, 0:10–0:50 und
ungefähr 3:10–3:12. Die Änderungen enthalten keine Titel- oder Zeitbedingungen.

Befund: Zusätzliche Anschläge wurden bei genügend Abstand recht großzügig
zugelassen; gekappte Stärkewerte machten sehr verschiedene Anschläge gleich
wichtig. Bereits gewählte Rasterakzente hatten stets Vorrang. Ruhige Abschnitte
sperrten zusätzliche Anschläge vollständig. Mit vollständiger Instrumentenanalyse
wird 184,73–200,09 Sekunden als ruhige Passage behandelt; der starke gemessene
Pegelanstieg bei 190,26 Sekunden erhielt daher keinen eigenen Lichtakzent.

Änderung:

- Ungekürzte RMS-/Bassanstiege dienen als Rangfolge, getrennt vom begrenzten
  Ausgabewert. Zusätzliche Anschläge benötigen mehr Stärke und bei mittlerer
  Stärke auch mehr Gewicht als die umliegenden Anschläge.
- Bei zeitlichen Konflikten gewinnt der stärkere Kandidat; ein früher schwacher
  Impuls kann den folgenden stärkeren nicht allein durch seine Reihenfolge sperren.
- Raster und zusätzliche Anschläge werden gemeinsam ausgewählt. Nahe am Raster
  liegende Anschläge werden nicht doppelt ausgegeben. Taktanfänge behalten einen
  kleinen Prioritätsvorteil.
- Ruhige Abschnitte erlauben einzelne außergewöhnlich starke Anschläge mit
  deutlichem Kontrast und weiterhin großem Mindestabstand. Fehlende Schlagzeug-
  Dominanz darf solche klaren Gesamtpegelanstiege nicht pauschal ausschließen.
- Reihenfolge, Mindestabstände und Pegelgrenzen bleiben deterministisch. Alle
  Berechnungen erfolgen bei der Show-Vorbereitung. Version 22 erneuert den Cache.

Validierung mit vollständiger Originaldatei: FFmpeg, Stereo 16 kHz, vorhandene
Beat-This-/Stildaten dieser Datei und frisch ausgeführte vollständige lokale
Struktur-/Instrumentenanalyse. Die gleichen Eingabedaten wurden mit dem vorherigen
und dem geänderten Algorithmus ausgewertet, automatische Show, Minimum 5 / Maximum 100.
FFmpeg- und Browserdekodierung können geringfügige Zeitabweichungen haben.

| Bereich | Vorher | Nachher |
| --- | ---: | ---: |
| Zusätzliche Zwischenakzente 10–50 s | 27 | 15 |
| Alle ausgewählten Akzente 10–50 s | 111 | 97 |
| Berechnete Helligkeit bei 190,26 s | 24 % | 63 % |

Im Bereich 190–192 s ersetzt der deutliche Anschlag bei 190,26 s den schwachen
Rasterakzent bei 190,04 s. Diese Zahlen belegen die geänderte Auswahl, nicht die
musikalische Richtigkeit jeder Entscheidung. Die Hör-/Seh-Abnahme an realen
Lampen steht aus; es wurden keine Lampen angesteuert.

- `npm test`: 400 Tests erfolgreich. Neue Fälle sichern schwache Unterteilungen,
  erhaltene Rasterakzente, starke Synkopen und den Vorrang starker Einzelereignisse
  in ruhigen Passagen ab.
- `node scripts/check-section-lighting.mjs`: Browserprüfung erfolgreich,
  einschließlich Speicherung, manueller Abschnittsbearbeitung und mobiler Ansicht.
- [Messdaten](accent-priority-boddies.json).
- [Interaktiver Vergleich](accent-priority-comparison.html): lokal im Browser öffnen;
  verwendet die Original-MP3 im Projektordner. Zwei Lichtvorschauen zeigen die
  alten und neuen berechneten Werte synchron zum selben Audio.
