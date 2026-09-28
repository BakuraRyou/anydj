# Prüfung: dmx-test.mp3 im Show-Modus

**Stand nach der Prüfung:** Die ersten beiden Maßnahmen wurden umgesetzt. [Ergebnisse des Vorher/Nachher-Vergleichs](fix-results.md). Die folgende Diagnose und die ursprüngliche Timeline zeigen den Stand vor diesem Fix.

## Urteil

Der Ablauf enthält eine erkennbare musikalische Dramaturgie und koordinierte Figuren. Eine durchgehend überzeugende, fertig choreografierte Show ist er noch nicht. Das Hauptproblem ist nicht die Zahl der verfügbaren Figuren: Verschiedene Regieebenen geben teils widersprüchliche Anweisungen; langsame Passagen verlieren dadurch Entwicklung, andere verlieren ihre Strahlen vollständig.

## Methode und Grenzen

- Gesamter Titel: 216,111 Sekunden; frische Beat-, Stil-, Struktur- und Instrumentenanalyse.
- Show-Profil, Raumvorlage „Club-Bühne · Publikum & Hintergrund“, 48 Moving Heads plus virtuelle statische Geräte.
- Vollständiger Replay mit 15 Abtastungen/s durch Gruppenbelegung, Raumprojektion, Ruhezonen und Motoren. Vier repräsentative Quellrollen; nicht die gespeicherte Gerätekonfiguration des Nutzers.
- Static-Support wird ebenfalls gespeist, seine absolute Helligkeit ist wegen der repräsentativen Quelle keine Abnahmegröße. Leistungswerte sind normierte Softwarewerte, keine Luxmessung.
- Kein GPU-/Frametime-Test, keine Prüfung realer DMX-Geräte, keine audiovisuelle Zuschauerabnahme. Wahrnehmung von Blendung, Nebeldichte, Farben, emotionalem Höhepunkt und Stroboskopverträglichkeit bleibt offen. 15 Hz kann sehr kurze Aussetzer übersehen.
- Die Bewertungen unten sind gestalterische Schlussfolgerungen aus Musikmerkmalen und berechneten Bahnen, kein Nachweis allgemeingültiger Publikumserwartungen.

[Zeitverlauf](timeline.svg) · [Messwerte](measurements.json)

## Was bereits funktioniert

| Gesichtspunkt | Befund |
| --- | --- |
| Musikalisches Timing | Alle 66 geplanten Aktionen liegen exakt auf erkannten Beats. Das bestätigt Konsistenz mit dem Beatgrid, nicht automatisch dessen akustische Richtigkeit. |
| Symmetrie | Gleichzeitig leuchtende Spiegelpartner bleiben nach der Raumprojektion bis auf numerische Rundung symmetrisch; maximale Abweichung unter 1e-12 m. |
| Bildsprache | 29 Show-Bilder, acht Grundformen, zusätzlich zwölf ausgewählte Gruppenkompositionen. Median der Bilddauer 7,17 s; keine Show-Bilder kürzer als 2 s. |
| Grobe Dramaturgie | Zurückhaltender Anfang, Aufbau, stärkere Einsätze, Rücknahme um 127,8 s, späterer Höhepunkt ab 170,8 s und Schlussrücknahme. |
| Kontrast des späteren Höhepunkts | Um 178 s sind während der Übergabe alle 48 Moving Heads sichtbar; um 146 s nur zwölf. Die Gruppengröße vermittelt damit eine größere räumliche Wirkung. |
| Oberflächen | Höhepunkte erzwingen keine Rückwand mehr. Tatsächliche Wandprojektionen sind nur ein Teil der Raumbewegung. |

## Konkrete Schwächen

### 1. Hohe Priorität: auslaufende Intensität löscht eine laufende Figur

**132,4–135,0 s:** Kein Moving Head ist über der Prüfschwelle von 1 % Leistung. Gleichzeitig beschreibt die Show-Regie eine aktive `flow/arc`-Figur mit 50 % Belegung. `musicalDarknessAt` meldet dort keine musikalische Dunkelpause.

Ursache: `dmx-activity.js`, `cuesFor`/`activityAt`, erzeugt für 127,77–134,96 s eine fallende Entwicklung (`finishDark:true`). Ihre normierte Entwicklung erreicht null und löscht die Strahlen, obwohl der Show-Plan die Figur weiterführen will. Statische Restbeleuchtung bleibt im Replay sichtbar; das ist kein vollständiger Raum-Blackout.

Bewertung: Eine Rücknahme ist plausibel, das vollständige Verschwinden der bewegten Figur ist derzeit nicht mit der Show-Regie abgestimmt. Hier braucht es eine gemeinsame Entscheidung über Dunkelheit, keinen pauschalen Helligkeitsaufschlag.

### 2. Hohe Priorität: ruhige Entwicklung wird als Stillstand interpretiert

**25,69–47,18 s:** durchgehend dieselbe `held/tiers`-Grundfigur, insgesamt 21,49 s. Von 29,6–40,2 s liegen die sichtbaren Strahlen im Mittel unter 0,1°/s. Von 41,07–46,27 s tritt ein weiterer langer Stillstand auf.

**142,10–155,98 s:** erneut `held/tiers`, 13,88 s. Von 146,67–153,0 s fast keine Bewegung.

Die Bewegungsanalyse hat bei 40,01 s bereits `edge-ladder` und bei 142,10 s `box-frame` vorgesehen. `showGroupMotionAt` verwirft jedoch sämtliche Gruppenbewegung für `held`. Entwicklung geht verloren, obwohl sie schon geplant wurde.

Bewertung: Ein bewusst gehaltenes Bild kann wirken. Wiederholt lange Standardposen ohne Entwicklung sind dagegen ein nachvollziehbarer Ursprung der Monotonie. Eine ruhige, gemeinsam geführte Entwicklung sollte möglich bleiben, ohne daraus einen schnellen Effekt zu machen.

### 3. Mittlere Priorität: dieselbe Dramaturgie-Schablone für verschiedene Höhepunkte

**99,12–127,77 s:** cross → wings → ribbon → parallel.

**170,75–199,41 s:** cross → wings → parallel → ribbon.

Wiedererkennbare Motive sind positiv. Die nahezu gleiche Reihenfolge begrenzt aber die Steigerung. Die Gruppenkompositionen unterscheiden sich stärker als diese Grundformen; es ist daher keine identische Animation. Sinnvoll wäre eine bewusst entwickelte Wiederaufnahme mit veränderter räumlicher Größe, Gruppenverteilung und einer klaren Auflösung.

### 4. Prüfkandidat: große Fahrten in weichen Passagen

Die größten sichtbaren Winkeländerungen häufen sich unter anderem um 55,6 s, 86,2 s, 122,4 s und 157,6 s. Einzelne Strahlen erreichen etwa 80–86°/s als räumliche Richtungsänderung. Das ist kein nachgewiesener Motorfehler: gleichzeitiger Pan/Tilt kann eine höhere räumliche Winkelgeschwindigkeit ergeben als eine einzelne Achse.

Gestalterisch sollten diese Stellen mit Ton angesehen werden: Passt die Fahrt zur musikalischen Entwicklung oder ist sie nur der Weg zur nächsten Fläche? Dies lässt sich nicht aus einem Geschwindigkeitsgrenzwert entscheiden.

## Priorität für die nächste Verbesserung

1. Show-Regie und Intensitätsentwicklung müssen dieselbe Entscheidung über Dunkelheit treffen.
2. `held` in bewusst statische Pose und ruhig entwickelte Figur unterscheiden; vorhandene Gruppenentwicklung nicht pauschal verwerfen.
3. Höhepunkte als Wiederaufnahme und Steigerung planen, nicht nur die Reihenfolge einiger Formen tauschen.
4. Danach audiovisuelle Abnahme insbesondere bei 25–47 s, 127–142 s und 155–178 s. Erst dann können subjektive Wirkung und tatsächliche Raumdarstellung bewertet werden.

Für diese Prüfung wurde kein Laufzeitverhalten geändert. Die Messung zeigt Prioritäten für gezielte Änderungen, nicht eine bestandene Gesamt-Abnahme.
