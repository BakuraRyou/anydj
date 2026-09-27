# Automatik: Aufnahme vom 27.09.2026, 12:27

## Beobachtung und Abgleich

Video: `__mock/anydj_preview_epic-2026-09-27_12.27.mp4`, 25,77 s. Einzelbilder im Abstand von 2 s sowie eine Sequenz mit 4 Bildern/s geprüft. UI bei Video-Sekunde 1: Automatisch, Deck B 100 %, `dmx-test.mp3` bei 1:42; Deck A `This Feeling (Radio Edit).mp3` hat 0 %. Sichtbar sind große wechselnde Bodenbahnen bei vergleichsweise beständiger Bühnenbeleuchtung.

Frische vollständige CPU-Analyse der lokalen `dmx-test.mp3` mit Beat-, Stil-, Struktur- und Instrumentenanalyse und aktuellem Compiler; kein Browsercache übernommen. Anschließend Offline-Raumtrace mit dem Club-Bühne-Preset, 48 Moving Heads, 30 Hz, Songzeit 101–127 s. Gespeicherte UI-Overrides, Quellfilter und GPU wurden nicht reproduziert. Die Zuordnung zum exakt im Video geladenen Plan bleibt deshalb unbestätigt. Keine auditive Bewertung vorgenommen.

## Reproduzierbarer Mechanismus

- 99,12–106,28 s: folding-gates / diagonal-sweep.
- 106,28–120,62 s: rising-steps / depth-wave über zwei Analyseabschnitte.
- 120,62–127,77 s: unison-sweep / parallel-sweep.
- In diesen Abschnitten werden 3,92–4,89 Attack-Ereignisse/s erkannt. `density = clamp(rate / 4)` und `motionDrive = max(..., density * confidence)` erzeugen 0,98–1,0 Bewegungsantrieb.
- Dieselbe Attack-Dichte bevorzugt lebhafte Formfamilien und vergrößert zusätzlich `pace` und `extent`. Tempo, Ausladung und Formauswahl werden damit gemeinsam stärker, obwohl eine hohe Anschlagsdichte nicht automatisch große Raumbewegungen begründet.
- `describeMotion` addiert Passagefortschritt und taktbezogene Phase. In der Tiefenwelle resultieren ca. 1,75–1,78 rad/s, also ein Umlauf in ca. 3,5–3,6 s.
- `depth-wave` versetzt die Phase nach Paarposition und Reihe (`phase-r*pi*.6-row*.45`) und fährt eine große Tiefenauslenkung. Die Paare bleiben rechnerisch gespiegelt; das Gesamtbild ist absichtlich zeitlich aufgefächert. Sichtbare Unordnung kann daher auch ohne verlorene technische Synchronisation entstehen.
- Im Club-Preset besitzen Bühnenköpfe zusätzlich Wandziele. `wallChoreography` leitet dieselbe Tiefenkoordinate ab y=0,48 zunehmend auf die Wand um. Eine zyklische Tiefenwelle kann so zusätzlich zwischen Boden- und Wandausrichtung pendeln. Dieser Mechanismus ist bestätigt; sein Anteil am konkreten Video ist ohne gespeicherten Raumzustand nicht isoliert.

Der Trace zeigt bis ca. 2,95 Grad Richtungsänderung pro 1/30 s. Große Bodenfleckstrecken allein belegen daher keine springenden Motoren: Die Projektion flacher Strahlen verstärkt kleine Winkeländerungen. Keine Aussage über Live-FPS.

## Nebenbefund, nicht Hauptdiagnose

Die vorläufige Analyse ohne Strukturmodell erzeugt zusätzlich einen Zweisekundenabschnitt bei 112–114 s. Passagegebundene Phase beschleunigt ihn, die Viertel-Dauer-Grenze verkürzt die Überblendung auf 0,5 s. Im vollständigen Plan existiert dieser Abschnitt nicht; er erklärt deshalb nicht nachweislich die Aufnahme.

## Konsequenz für einen gezielten Fix

Attack-Dichte sollte rhythmische Akzente steuern können, ohne automatisch Geschwindigkeit, Ausladung und Formfamilie gemeinsam zu maximieren. Geordnete große Bewegungen brauchen einen kontinuierlichen Bewegungsbogen; räumliche Auffächerung sollte eine bewusste lokale Entscheidung sein. Boden-/Wandwechsel sollten als gemeinsame Gruppenentscheidung geplant werden, nicht als Nebenwirkung jeder Tiefenwelle. Diese Aufnahme zunächst unverändert als Vergleich behalten. In dieser Diagnose wurden keine Laufzeitänderungen vorgenommen.

## Umsetzung und Prüfung

Nach der Diagnose umgesetzt (Show-Plan 46, Bewegungsplan 11):

- Attack-Dichte bleibt als Akzentinformation erhalten; sie maximiert nicht mehr Bewegungsantrieb, Tempo, Ausladung und bevorzugte Formfamilien gemeinsam.
- Zyklische Figuren verwenden eine einzelne taktabhängige Phase, ohne zusätzliche Rotation pro Analyseabschnitt. Ohne Beat-Raster gibt es einen kontinuierlichen zeitbasierten Ersatz. Geordnete Gesten und Aufbauten behalten ihren Passageverlauf.
- Der Bewegungsplan legt Boden, Wand oder einen Aufbau zur Wand fest. Automatisch und Show reichen diesen gemeinsamen Wert einschließlich Überblendung und Bewegungsvorausschau bis zur Raumzuordnung durch. Bestehende Ruhezonen haben weiterhin Vorrang. Andere Modi behalten ihre bisherige Wandzuordnung.
- Regressionstests prüfen unveränderte Bewegungsphase bei kurzen Zwischenfragmenten, gemeinsame Oberflächenwahl über 24 Bühnenköpfe und kontinuierliche Oberflächenübergabe. Zwei frühere Tests wurden von erzwungener Beschleunigung auf erhaltene Akzente und kontinuierliche Bewegung umgestellt.

Offline-Nachprüfung der vorhandenen vollständigen Analyse, mit neu erzeugtem Bewegungsplan: An den Songzeiten 105/111/114/120/126 s liegt die Phasengeschwindigkeit jetzt zwischen 0,78 und 1,02 rad/s (vorher ca. 1,75–1,81 rad/s). Die Formauswahl hat sich ebenfalls geändert, daher kein isolierter Geschwindigkeitstest derselben Geometrie. Der Raumtrace bleibt innerhalb der vorhandenen Motorbegrenzung (max. ca. 2,97 Grad pro 1/30 s). Keine globale Helligkeitsänderung und keine Änderung der Motorgrenzen.

Gesamte Testsuite: **881 bestanden**, keine Fehler. `git diff --check` ohne Befund. Noch keine visuelle Live-Abnahme mit dem gespeicherten Raumzustand des Videos; keine GPU-Performance-Messung.
