# Referenzstudie: Lichtpositionen, Grundlicht und Dunst

## Referenz und Rekonstruktion

Untersucht wurde [520 lighting show MAE](https://www.youtube.com/watch?v=Q3aCtuhyVaQ), insbesondere das Bild bei **00:24**. Die zuvor lokal gesicherte Videodatei wurde direkt ausgewertet. Der erneute Webabruf der YouTube-Seite schlug fehl; die Bilder stammen aus der Videodatei.

[Video und AnyDj nebeneinander](../__mock/reference-light-study.jpg)

Die Rekonstruktion ist eine manuelle Annäherung aus einer einzigen Kameraperspektive. Sichtbare Quellen wurden zugeordnet, nicht automatisch vermessen. Raumtiefe, reale Metermaße, Geräteoptik und Kamerabelichtung sind unbekannt.

| Gruppe | Angenäherte Quellen | Position im Modell | Farbe |
|---|---:|---|---|
| Obere Hauptreihe | 8 | x −4,1…3,9; y 6; Höhe 4,2 | Magenta |
| Untere Hauptreihe | 6 | x −5,2…5,2; y 6; Höhe 0,4 | Magenta |
| Obere versetzte Reihe | 8 | x −4,65…4,65; y 6,3; Höhe 4,25 | Blau |

Die Werte sind Modellkoordinaten mit angenommener Skalierung. Insbesondere die dritte Reihe kann in Wirklichkeit anders aufgebaut sein. Ihre sichtbaren Mehrfachstrahlen wurden nicht als unabhängige zusätzliche Scheinwerfer ausgegeben. Die Kamera wurde an die Bildpositionen der oberen und unteren Quellen angenähert; die Strahlwinkel wurden auf 10°, 8° und 18° geschätzt.

Die vollständige Szene liegt in [light-reference-24.json](../scripts/fixtures/light-reference-24.json). Sie verändert keinen gespeicherten Raumplan.

## Konkrete Änderungen

1. **Breites Grundlicht:** Die Standardkegel von `spot` und `bar` waren mit etwa 14° beziehungsweise 11° zu eng für die gewünschte Grundlichtdarstellung. Ihre neuen Standardwinkel betragen ungefähr 46° beziehungsweise 53°. Der Radius wird nicht mehr auf die 1,8 m der engen Moving-Head-Kegel begrenzt. Luftstreuung ist bei diesen breiten Quellen wesentlich schwächer als bei engen Beams.
2. **Gerätespezifischer Winkel:** `beamAngle` kann den Standardwinkel für die Vorschau ersetzen. Das ist eine numerische Szeneneigenschaft, noch kein neues Bedienelement. Die Standardwerte ersetzen keine realen Gerätedaten; ein echter enger Spot darf weiterhin eng eingestellt werden.
3. **Dunst:** WebGPU und WebGL modulieren die Strahlen mit einer weichen, räumlich verankerten Dichtevariation. Sie bewegt sich nicht mit dem Kopf mit. Es gibt keine zusätzliche Nebelgeometrie oder Vollbildpass. Canvas behält die gleichmäßige, günstigere Näherung.
4. **Vergleichbare Varianten:** `layout.hazeDetail=false` deaktiviert die Struktur; `layout.hazeDensity=0` entfernt Luftstrahlen, während Lichtflächen und Linsen erhalten bleiben. Diese Eigenschaften sind derzeit Szenenparameter, keine UI-Regler.

[Separates Grundlichtbeispiel mit zwei Scheinwerfern](../__mock/reference-wash-room.png), Szene: [light-wash-room.json](../scripts/fixtures/light-wash-room.json).

Breitere Kegel gehen auch in die gemeinsame Berechnung der Lichtflächen und Freiräume ein. Dadurch können bisher knappe Platzierungen neben ausgeschlossenen Bereichen konservativer behandelt werden.

## Was der Vergleich zeigt

Die Rekonstruktion trifft die Anordnung und die grundlegende Farbszene. Sie erreicht **noch nicht die Bildwirkung des Videos**. Die obere blaue Fächerstruktur besteht in der Referenz aus mehreren Teilstrahlen; unsere Szene enthält einfache Kegel. Ebenso fehlen projizierte Gobomuster, ein echtes räumliches Nebelvolumen und die Belichtungs-/Überstrahlungseigenschaften der Referenzkamera. Der dunkle Bühnenhintergrund ist nicht identisch mit unserem geschlossenen Raum. Diese Abweichungen begrenzen den Bildvergleich; eine numerische Bildähnlichkeitskennzahl wäre irreführend.

Die räumliche Dichtevariation verbessert nur die Gleichmäßigkeit der Strahlen. Sie ist **kein Ersatz** für die fehlenden optischen Formen und keine vollständige Simulation von Nebel zwischen allen Objekten. Schatten beliebiger Gegenstände bleiben ebenfalls außerhalb dieser Näherung.

## Performancevergleich

Identische endgültige Referenzszene, 640×360, 22 Quellen, 40 Frames pro Backend, zehn Aufwärmframes. Für WebGPU wird nach jedem Frame `queue.onSubmittedWorkDone()` abgewartet, für WebGL `finish()` aufgerufen. Somit sind dies synchronisierte Framekosten statt bloßer Zeiten zum Einreichen der Befehle. Die Messung läuft auf Software-Vulkan, nicht auf der Grafikkarte des Nutzers.

| Backend | Gleichmäßiger Dunst, Median / p95 | Räumliche Struktur, Median / p95 |
|---|---:|---:|
| WebGPU | 26,2 / 39,6 ms | 26,5 / 35,6 ms |
| WebGL | 6,4 / 10,6 ms | 6,2 / 9,4 ms |
| Canvas | 8,7 / 14,0 ms | 10,2 / 14,6 ms |

Canvas verwendet in beiden Fällen dieselbe Darstellung; seine Differenz veranschaulicht die Laufstreuung. Die Messung zeigt keinen belastbaren großen Aufpreis für die Struktur. Sie beweist weder konstante FPS bei Full HD noch einen generellen Vorteil von WebGL gegenüber WebGPU. WebGPU verwendet zudem 4× MSAA; die Softwarepfade sind unterschiedlich.

**Empfohlener weiterer Ausbau:** Zuerst begrenzte Prismensplits und Gobos passend zu realen Geräteprofilen. Wenige zusätzliche Strahlflächen versprechen hier mehr Ähnlichkeit als aufwendiger Vollbildnebel. Erst danach Bloom bei reduzierter Auflösung prüfen, zusammen mit Hardwaremessungen bei der tatsächlich verwendeten Auflösung. Eine vollständige Volumenintegration ist aufgrund dieser Vergleichsbilder noch nicht gerechtfertigt.

## Reproduktion

```sh
GPU_SYNC=1 STAGE_SCENE_FILE=scripts/fixtures/light-reference-24.json \
SNAPSHOT_PREFIX=/tmp/reference \
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
xvfb-run -a node scripts/check-dmx-stage-gpu.mjs
```

Zusätzlich `STAGE_HAZE_DETAIL=0` für gleichmäßigen Dunst. Für Grundlicht `STAGE_SCENE_FILE=scripts/fixtures/light-wash-room.json` setzen. Der Test schreibt Bilder aller drei Renderer, prüft WebGPU-/WebGL-Bildübereinstimmung, Kontextverlust und Ressourcenfreigabe. Ohne Szenendatei läuft weiterhin der Test mit 20 bewegten Köpfen.

59 gezielte Tests bestanden, einschließlich breiter Lichtflächen, Winkelvariation und Luft ohne Dunst bei weiterhin sichtbaren Lichtflächen.

Gesamtsuite: **734 Tests, 731 bestanden, drei bereits bekannte Fehler** in `rhythm-recovery.test.mjs` und `stage-motion.test.mjs` (Schlagzeug-/Entwicklungs-Cues und Anzahl langsamer Bewegungs-Cues). Keine neuen Fehler gegenüber dem zuvor dokumentierten Stand.
