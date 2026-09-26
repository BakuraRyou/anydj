# Atomic Damage: Bewertung des aktuellen Show-Modus

Stand: 26.09.2026. Analyse des vorhandenen Arbeitsstands; keine Änderung der Show-Engine.

## Ergebnis

Eine deutlich ausdrucksstärkere automatische Show ist mit der vorhandenen Architektur realistisch. Das zentrale Problem liegt in der Übersetzung musikalischer Merkmale in räumliche Bilder: kräftige Musik führt über lange Strecken zum selben Parallelbild. Zusätzliche Beat-Ziele verstärken diese Wiederholung und lassen zu wenig Zeit für große, erkennbare Formen.

## Grundlage und Grenzen

- Lokale Datei: `/home/erikh/Musik/Timecode - lightshow - Atomic Damage -MA3D.mp3`, dekodierte Dauer 111,943 Sekunden.
- Den gesamten Titel neu mit den installierten Beat- und Stilmodellen sowie `show-worker.js` ausgewertet. Einstellungen: automatische Anordnung/Farbwahl, Helligkeit 5–100; anschließend aktuelles Show-Profil angewandt.
- Keine Struktur-/Stem-Analyse für diesen Lauf. Es handelt sich um den vorhandenen Analysepfad ohne diese Verfeinerung, nicht um eine Rekonstruktion des gespeicherten Nutzersongs oder Nutzerraums. Vorhandene manuelle Eingriffe wurden nicht übernommen.
- Die vorhandene Aufnahme `__mock/anydj_show_lateral_review-2026-09-26.mp4` visuell anhand von zwölf Bildern im Abstand von zwei Sekunden geprüft. Sie zeigt Songsekunden 12–36 im Testraum. Diese Aufnahme wurde nicht mit dem neuen Analyseergebnis neu gerendert.
- Referenz: [520 lighting show MAE, wong kim chuen](https://www.youtube.com/watch?v=Q3aCtuhyVaQ), ca. 61 Sekunden. Heruntergeladene Videospur anhand von zwanzig Bildern im Abstand von drei Sekunden geprüft. Kein Hörurteil oder Nachweis exakter audiovisueller Synchronität aus dieser Bildauswahl.
- 35 vorhandene Tests für Show-Profil, Bewegungscues, Bewegungsplan und Analyseexport bestanden. Das belegt technische Regressionseigenschaften, keine künstlerische Qualität.

Die ältere Projektdokumentation nennt 111 Show-Cues. Der neue Lauf erzeugt 183. Diese Zahlen stammen aus unterschiedlichen Analysebedingungen; daraus wird keine Vorher/Nachher-Verbesserung abgeleitet.

## Messwerte des neuen Laufs

| Merkmal | Ergebnis |
|---|---:|
| Erkannte Beats / Taktanfänge | 217 / 58 |
| Abschnitte / daraus gebildete Szenen | 21 / 27 |
| Als `impact` klassifizierte Zeit | 84 s, ca. 75 % |
| Show-Aktionen | 24 `hit`, 159 `answer`, 0 `launch` |
| Bewegungsplan | 210 Cues einschließlich Startpose |
| Formzuordnung nach der Startpose | 180 parallel, 25 Fächer, 4 Kreuz |
| Durch Motorgrenzen verkürzte Fahrten | 201 von 209 |
| Auf weniger als halben Zielweg verkürzte Fahrten | 179 von 209 |
| Median des erreichbaren Anteils am angeforderten Zielweg | ca. 14 % |

Der letzte Wert bezeichnet den einzelnen Weg vom vorherigen Cue zum angeforderten Ziel vor Begrenzung. Er bedeutet nicht, dass die gesamte sichtbare Bewegung oder die mögliche Motorreichweite nur 14 % beträgt. Gemessen wurde vor Raumprojektion und dem zusätzlichen Raummotor; physische Geräte wurden nicht getestet.

Besonders aussagekräftige Abschnitte:

- 22–36 s: ausschließlich Parallelziele zwischen 22,02 und 35,52 s.
- 44–58 s: erneut Parallelziele zwischen 44,02 und 57,52 s.
- 60–98 s: Parallelziele von 60,04 bis 97,50 s, obwohl der Szenenplan mehrere Phrasen unterscheidet.
- Der neue Lauf erkennt keinen Aufbau. Das beweist nicht, dass im Audio kein Aufbau vorkommt; es zeigt, dass die aktuelle Interpretation dort keine Aufbauaktionen liefern kann.

Vollständige Szenentimeline und Zählungen: `atomic-damage-evaluation.json`. Messung der vorbereiteten Motorbegrenzung: `atomic-damage-motor-audit.json`.

## Warum die Show ähnlich bleibt

### 1. Drei Formen überdecken die vorhandene Vielfalt

`public/dj-show-profile.js:83` und `public/dmx-moving-cues.js:302` reduzieren das Bild auf `cross`, `parallel` oder `fan`: Höhepunkt → Kreuz, Impact → parallel, sonst Fächer. Die 25 Varianten aus `dmx-light-scenes.js` werden im Show-Bewegungspfad nicht als Geometrie verwendet. Beispielsweise erzeugen die Szenenvarianten `wall` und `tiers` hier dieselbe Formfamilie.

### 2. Gleiche räumliche Grammatik

`showMovingCues` verwendet Sinus/Cosinus über 8 oder 16 Beats. Parallelstrahlen schwenken gemeinsam; Fächer und Kreuze ändern ihre Öffnung. Die Höhenbewegung ist überwiegend gemeinsam und klein. Phrasengrenzen setzen die Phase wieder relativ zum Szenenstart. Auch bei korrekter Beat-Bindung bleibt das Bewegungsmotiv ähnlich.

### 3. Zu viele Ziele für den angeforderten Weg

Kräftige Passagen erhalten Ziele auf jedem Beat, dazu weitere musikalische Ereignisse. `motionReach` kürzt den Weg anhand von Geschwindigkeit, Beschleunigung und Ruck. Die Grenzen sind sinnvoll; die Planung sollte vorab passende Wege und Ankunftsabstände wählen. Eine Erhöhung der Grenzwerte würde das gestalterische Problem nicht lösen.

### 4. Wiederholte Akzentdramaturgie

159 von 183 Show-Aktionen sind Gruppenantworten. Farben wechseln nach `ordinal % 2`; selektierte Akzente werden mit `0.78 + value * 0.3` in einen hohen, engen Pegelbereich gesetzt und haben dieselbe Abklingzeit von 220 ms. Dadurch ähneln sich gewöhnliche Betonungen und besondere Ereignisse. Im Show-Präsenzpfad sind außerhalb der Gruppenaktion grundsätzlich alle Geräte vorgesehen, statt die Szenenbesetzung vollständig zu übernehmen.

### 5. Lautheit dominiert die Szenenrolle

`lightingScenes` kann hohe Energie mit rhythmischem Antrieb und Peak-Label zu einem anhaltenden Impact-Bild machen. Für diesen Titel betrifft das drei Viertel der Laufzeit. Ein dauerhafter lauter Abschnitt braucht eine eigene Groove-Gestaltung; ein kurzer Einsatz sollte als Ereignis innerhalb dieses Abschnitts behandelbar sein.

### 6. Geometrie kennt das Rig nur eingeschränkt

`movingDevicePoses(..., formation: 'designed')` interpoliert vier Rollen entlang der X-Reihenfolge. Gerätereihen in unterschiedlicher Tiefe oder Höhe sind dort keine eigenen musikalischen Gruppen. Ein geometrisches Kreuz oder ein gemeinsamer Schnittpunkt sollte aus realen Montagepositionen und einem Ziel im Raum berechnet werden; ein umgekehrter Pan-Fächer garantiert keinen bestimmten Schnittpunkt.

## Was aus der Referenz übertragbar ist

In der Bildfolge sieht man klar unterschiedliche Besetzungen: wenige isolierte Strahlen, breite Fächer, sich kreuzende diagonale Bündel, parallele Vorhänge und dicht gefüllte Bilder. Obere und untere Geräteebenen erzeugen Gegenrichtungen und räumliche Tiefe. Breite helle Bilder wechseln mit stark reduzierten Bildern.

Diese Kontraste sind übertragbar. Eine Installation mit acht Heads in einer Reihe kann allerdings nicht dieselbe räumliche Komposition wie mehrere Geräteebenen erzeugen. Perspektive, Strahlbreite und sichtbarer Haze beeinflussen zusätzlich den Eindruck. Der Raumplan muss die tatsächliche Installation abbilden; zusätzliche virtuelle Geräte wären kein Beleg für die Qualität des realen Setups.

## Empfohlene Weiterentwicklung

### A. Eine gemeinsame Partitur für Show

Den vorhandenen Szenenplan um eine Show-Partitur erweitern. Pro musikalischer Phrase: Formfamilie, räumliches Ziel, beteiligte Gruppen, Farbidentität, Bewegungsart, Übergang und Ereignisakzente. Bestehende Beat-/Phrasen-/Klangmerkmale bleiben die Eingangsdaten. Farbe, Dimmer, Gerätebesetzung und Bewegung lesen dieselbe Entscheidung.

Sinnvolle Anbindung:

- `show-arrangement.js`: musikalische Merkmale und Ereignisse.
- `dmx-light-scenes.js`: Abschnittsrolle, Motivgedächtnis und Wahl des Bildes.
- `dj-show-profile.js` / `show-action.js`: gemeinsame Aktionen und Akzentstärken.
- `dmx-moving-cues.js`: geplante Fahrten und Ankunftszeitpunkte.
- Raumprojektion und Gerätezuordnung: Zielgeometrie für die tatsächliche Installation.

Die aktuelle Raumplan-Oberfläche bleibt zuständig. Kein neuer Zugang zum veralteten Gerätemanager erforderlich.

### B. Form, Bewegung und Akzent unabhängig kombinieren

Zum Start sechs deutlich lesbare Familien: paralleler Vorhang, offener Fächer, zusammenlaufendes V, Kreuz aus Spiegelpaaren, zwei Flügel, gestaffelte Höhen. Jede Familie kann gehalten, langsam geöffnet, seitlich geführt oder durch Gruppen nacheinander sichtbar gemacht werden. Seltene große Bilder bleiben markanten Einsätzen vorbehalten.

Beispiel für eine rhythmische Phrase: zuerst ein schmales stehendes Bild mit Bassantworten links/rechts; bei einer passenden Phrasengrenze Öffnung zum Fächer; bei einem belegten Fill kurze Gruppenfolge; auf einem stärkeren Eintritt breites gemeinsames Bild. Diese Folge ist ein Entwurf, keine für Atomic Damage nachgewiesene Transkription und kein fester Ablauf für alle Songs.

### C. Drei musikalische Zeitebenen

- Songabschnitt: Charakter, Farbidentität, räumliche Größe und Dichte.
- Phrase/Takte: Form etablieren, entwickeln, halten, wieder aufgreifen.
- Einzelereignis: kurze Helligkeitsbetonung, Gruppenantwort oder besondere Ankunft.

Eine große Motorfahrt darf mehrere Beats dauern, während Dimmer/Präsenz einzelne Schläge ausdrücken. Die Ankunft wird vorausgeplant; unmögliche Wege führen zur Wahl einer anderen Figur oder längeren Fahrt. Ein Szenenwechsel muss früh genug vorbereitet werden, damit sein Bild beim musikalischen Einsatz lesbar ist.

### D. Übertragbarkeit auf andere Lieder

Relative Merkmale innerhalb des Songs verwenden: lokaler Kontrast, Attack-Dichte, Verhältnis von rhythmischem zu gehaltenem Material, spektrale Änderung und belastbarer Instrumentenfokus. Lautheit allein ist kein Höhepunkt. Instrumentenzuordnung nur bei ausreichender Konfidenz; ohne Stems sind allgemeine akustische Rollen möglich.

Wiederkehrende Motive behalten eine erkennbar verwandte Form. Eine Variantenhistorie verhindert unbeabsichtigte Dauerwiederholung, ohne bei konstantem Material zwanghaft Formen zu wechseln. Variable Taktarten und Tempi nutzen die erkannten Zeitpunkte; bei unsicherem Raster langsamere, klanggetriebene Bilder statt erfundener Taktschläge.

### E. Abnahme an sichtbaren Ergebnissen

1. Zuerst Atomic Damage vollständig mit einer eingefrorenen Analyse, gleichem Raum, Kamera und Pegel vergleichen; besonders 22–36 und 60–98 Sekunden.
2. Danach mehrere kontrastierende echte Titel: gleichmäßiger Dance-Groove, Pop mit Gesang, Rock, ruhiges/flächiges Material, wechselndes Tempo oder unregelmäßiger Takt.
3. Formfamilien über Zeit, wiederholte Aktionen, Halte-/Fahrtanteil und gekürzte Wege protokollieren. Keine starre Mindestzahl von Formen für jeden Song.
4. Prüfen, ob geplante Figuren nach Raumprojektion tatsächlich erkennbar sind und auf dem geplanten Ereignis ankommen. Ein Cue auf dem Beat allein genügt nicht.
5. Bei physischem DMX separat mit realen Pan-/Tilt-Grenzen, Kalibrierung und Latenzen abnehmen.
6. Den Analyseexport profilabhängig machen: `light-review.js` exportiert aktuell ausdrücklich `balanced`, auch wenn die Show untersucht werden soll. Die enthaltenen Referenzcues sind deshalb keine unmittelbare Show-Abnahme.

## Realistische Einschätzung

Die nötigen Grundbausteine sind vorhanden. Für eine erste deutlich unterscheidbare Show sind kein neues Trainingsverfahren und kein Modell pro Song nötig. Hauptarbeit sind die gemeinsame Regie, räumlich verlässliche Figuren und eine musikalische Abnahme an echten Titeln.

Ein überzeugender automatischer Entwurf für viele Titel ist realistisch. Eine handprogrammierte Timecode-Show für jeden beliebigen Song automatisch gleichwertig zu ersetzen ist kein seriöses Versprechen. Der nächste sinnvolle Entwicklungsschritt ist ein begrenzter Vergleich mit sechs Formfamilien und erreichbaren Fahrten, bevor weitere Effekte ergänzt werden.
