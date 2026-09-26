# Show-Regie und Strahloptik

26.09.2026. Umsetzung auf dem vorhandenen, bereits veränderten Arbeitsstand.

## Änderungen

- `public/show-score.js`: gemeinsame deterministische Partitur pro Phrase mit sechs Formfamilien: parallel, Fächer, Fokus, Kreuz, Flügel und Höhenstaffelung. Rhythmische Dauerdichte ist eine Groove-Rolle; ein deutlicher Energieeintritt erhält eine gesonderte Akzentrolle. Motivgedächtnis und Verwendungshistorie steuern die Auswahl. Ruhiges, gleichbleibendes Material erhält keine Formenrotation.
- Auch ohne Beat-Raster entwickeln gemessene Energie-, Klangfarben- und Tonhöhenänderungen fließende Bilder; ein konstantes Pad bleibt ruhig.
- `public/dj-show-profile.js`: Farbe bleibt innerhalb eines Phrasenbilds stabil; markante Ereignisse, Eintritte und Taktanfänge steuern Aktionen. Gewöhnliche Anschläge behalten kleinere Dimmerakzente. Die Gerätebesetzung folgt ebenfalls der Partitur.
- `public/dmx-moving-cues.js`: vollständige Zielposen mit ausreichender Fahrzeit. Unerreichbare frühe Ankünfte werden ausgelassen, bis eine passende musikalische Ankunft möglich ist. Normale aktive Formwechsel bleiben beleuchtet. Geplante Dunkelfahrten können ruhige Übergänge auf den nächsten Einsatz vorbereiten. Manuelle Bewegungspausen bleiben verbindlich.
- Die Fokusformation richtet reale Montagepositionen und Höhen auf einen gemeinsamen Raumpunkt aus. Fokusübergänge laufen durch dieselbe Interpolation, Vorschauvorhersage, VR-Übertragung und Raummotorik. Explizite Bewegungsbereiche und Ruhezonen bleiben vorrangig.
- Der Analyseexport verwendet den tatsächlich gewählten Bewegungsmodus und enthält bei Show die neue Partitur.
- Show-Cache-Version 31, Bewegungsplan-Version 34. Bestehende gespeicherte Raum-/Bühnendaten werden nicht gelöscht.
- Für die LAN-/VR-Vorschau wurden fehlende statische Modulfreigaben ergänzt. Keine zusätzlichen API-Aktionen freigegeben.

## Strahloptik und Performance

WebGL, WebGPU und die zwischengespeicherte Canvas-Strahltextur verwenden nun einen helleren Kern, einen breiten schwachen Dunstsaum und den bisherigen weichen Längsverlauf. Es bleiben dieselben Strahlflächen, Zeichenaufrufe und Renderpässe. Die optische Darstellung verändert keine DMX-Leistungswerte, Gerätebesetzung oder Ruhezonen.

Es handelt sich um eine einfache Näherung sichtbarer Strahlen. Eine vollständige volumetrische Nebelsimulation, Schatten im Nebel oder Bloom über das ganze Bild sind damit nicht implementiert. Das offizielle [Three.js-Beispiel zu volumetrischem Licht](https://threejs.org/examples/webgpu_volume_lighting) und [BloomNode](https://threejs.org/docs/pages/BloomNode.html) zeigen mögliche aufwendigere Folgeschritte; für diese Änderung wurde keine neue Renderbibliothek eingebaut.

`check-dmx-stage-gpu.mjs` bestand mit 20 bewegten Heads für WebGPU, WebGL und Canvas einschließlich Kontextverlust und Freigabe der Ressourcen. Ausführung über Xvfb und Software-Vulkan (`lvp_icd.json`). Die gemessenen JavaScript-Aufrufzeiten lagen in diesem Lauf bei ca. 9,1 / 18 / 10,2 ms Median. Sie enthalten keine verlässlich synchronisierte GPU-Laufzeit und belegen keine Hardware-FPS oder Vorher/Nachher-Beschleunigung. Der erste Versuch mit der vorherigen Browserkonfiguration konnte keinen WebGL-Kontext öffnen; der passende Vulkan/Xvfb-Lauf prüfte anschließend alle drei Pfade erfolgreich.

## Atomic Damage

Gleiche lokale Datei und Analysebedingungen wie in der vorherigen Auswertung: vollständiges Audio, installierte Beat-/Stilmodelle, App-Signalanalyse, keine zusätzliche Stem-/Strukturanalyse und keine gespeicherten Nutzerraumeinstellungen.

| Merkmal | Vorher | Neue Show-Regie |
|---|---:|---:|
| Bewegungs-Cues inklusive Start | 210 | 33 |
| Parallelziele | 180 | 8 |
| Verwendete Formfamilien | 3 | 6 |
| Show-Aktionen | 183 | 56 |
| Davon Gruppenantworten | 159 | 29 |
| Unerreichbare vorbereitete Zielwege | 201 verkürzt | 0 |

Die sechs Familien verteilen sich auf 5 Höhenstaffelungen, 5 Kreuze, 8 Parallelbilder, 5 Fächer, 4 Fokusbilder und 6 Flügelbilder. Es gibt 28 Phrasenbilder und zwei geplante dunkle Transfers. Gezählt werden Cue-Ziele; daraus folgen keine gleichen Zeitanteile oder eine automatische Aussage über subjektive Qualität. Die Erreichbarkeitszahl gilt vor der installationsabhängigen Raumprojektion; die abschließenden Raummotoren begrenzen die wirklichen Richtungsänderungen zusätzlich.

Daten: `reports/atomic-damage-show-score.json`.

Vollständige Vorschau mit Originalton: `__mock/anydj_show_score_review-2026-09-26.mp4`, ca. 111,95 Sekunden, 2239 Frames bei 20 fps, acht Heads im Testraum. Bildfolge insbesondere für den bisherigen Wiederholungsabschnitt 60–98 Sekunden geprüft. Die Aufnahme verwendet den Canvas-Pfad mit der neuen Strahltextur und die berechneten Songfarben/Dimmwerte. Sie ist kein Hardwaretest und keine subjektive musikalische Hörabnahme.

## Validierung

Vollständiger Lauf: 726 Tests, davon 723 bestanden und drei unten eingeordnete Fehler im vorhandenen Automatikpfad.

- Tests für unterschiedliche Tempi, Dreiertakte, Gesangsanteile, Aufbauten, kontrastreiche Eintritte, konstante Pads, deterministisches Seeking, vollständige erreichbare Zielposen und Haltemomente.
- Geometrieprüfungen für Fokus bei ungleichmäßigen Montagepositionen und unterschiedlichen Höhen, prädiktive Wiedergabe sowie Geräte-Bewegungsgrenzen.
- Bestehende Raum-, Beam-, VR-, Abschnitts-, Farb- und Show-Tests.
- Show-Profil im Browser auf Desktop/Mobil ausgewählt, zwischen Profilen gewechselt und Persistenz nach Neuladen geprüft.
- Vollständiger Titel im echten Canvas-/Raummotorpfad gerendert; Video- und Audiospur sowie Frameanzahl bestätigt.
- `git diff --check` bestanden.

Der vollständige Testlauf hat weiterhin drei Fehler in `test/rhythm-recovery.test.mjs` (zwei) und `test/stage-motion.test.mjs` (einer). Diese Fälle verwenden den bestehenden ausgewogenen Automatikpfad. Ein isolierter Gegenlauf mit entferntem Show-Score-Import, deaktivierter neuer Show-Funktion und wiederhergestellter ursprünglicher Pose-Interpolation reproduziert dieselben drei Fehler. Die Tests wurden nicht umgeschrieben, um sie für diese Änderung grün zu machen.
