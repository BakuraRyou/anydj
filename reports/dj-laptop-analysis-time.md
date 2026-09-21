**Laufzeitanalyse: vollständige Songberechnung in AnyDj**

Untersucht wird die lokale Desktop-/Server-Version mit installierten Modellen und eingeschalteter Option „KI-Songaufbau“. Die reine Web-Demo führt diese vollständige Modellpipeline nicht aus. Netzübertragungen zu einem entfernten Hosting-Server gehören nicht zu dieser Abschätzung.

**Was vollständig berechnet bedeutet**

Die Anwendung arbeitet in zwei Stufen. Zuerst dekodiert sie die Datei, erkennt Beats mit Beat This!, ermittelt den Stilverlauf mit Discogs-EffNet und erzeugt im Worker aus Pegel-, Spektral- und Melodieinformationen eine erste Lichtshow. Danach ist der Track spielbereit.

Anschließend analysiert All-In-One einschließlich Demucs den Songaufbau und die Instrumentenspuren. Daraus entstehen Abschnitts-, Instrumenten- und Intensitätsinformationen; die Lichtshow wird erneut berechnet und gespeichert. Erst danach ist der Track vollständig vorbereitet.

Diese Schritte werden für einen Song im Wesentlichen nacheinander ausgeführt. `prepareTracks()` und `refineTracks()` verhindern auch eine gleichzeitige Basis- und Strukturvorbereitung verschiedener Songs in diesem DJ-Pult. Währenddessen ist Wiedergabe möglich, sie ist aber keine Garantie für gleichbleibende Analysegeschwindigkeit.

Quellen: [DJ-Vorbereitung](../public/dj.js), [Show-Worker](../public/show-worker.js), [Strukturadapter](../scripts/song-structure.py).

**Neue Messung mit dem aktuellen Stand – 21.09.2026**

Datei: `RobbieWilliamsBoddies.mp3`, 263,70 Sekunden beziehungsweise 4:24 Minuten. Rechner: Intel Core i9-14900HX, 32 logische CPUs und 31,1 GiB gemeldeter RAM, Linux x64. Dies ist die Referenzmessung auf einem leistungsfähigen Laptop, keine Messung der unten definierten durchschnittlichen Zielklasse.

| Berechnungsschritt | Gemessene Zeit |
|---|---:|
| Stereo-Dekodierung auf 16 kHz einschließlich Einlesen | 0,28 s |
| Mono-Aufbereitung für die Modelle | 0,02 s |
| Beat This!, einschließlich neuem Modellprozess | 4,65 s |
| Discogs-EffNet, einschließlich neuem Modellprozess | 0,97 s |
| Signalanalyse und erste Lichtshow | 0,96 s |
| **Erste Basis-Show bereit** | **6,89 s** |
| Erneute Dekodierung für Struktur auf 44,1 kHz Stereo | 0,20 s |
| All-In-One, Demucs und Instrumentenmerkmale | 170,80 s |
| Abschließende Lichtshow-Berechnung | 0,24 s |
| **Vollständige Berechnung gesamt** | **178,13 s = 2:58 min** |

Rund **96 %** der Gesamtzeit entfallen auf Struktur und Instrumente. Die eigentliche Erzeugung der verfeinerten Lichtshow ist mit 0,24 Sekunden praktisch nicht der Engpass. Die jüngsten Änderungen an Farbübergängen und Scheinwerferdarstellung laufen überwiegend während der Wiedergabe; dieser Benchmark weist dort keinen relevanten Berechnungsengpass nach.

Die komplette Analyse benötigte **0,676 × Songdauer**. Die Messung enthält Prozessstart und Modellladen, aber keine Modelldownloads und keinen Ergebnis-Cache. Betriebssystem-/Bibliotheks-Caches wurden nicht geleert. Die Maschine war nicht für einen kontrollierten Laborversuch isoliert. Eine Prozessmomentaufnahme während der Strukturphase zeigte etwa 660 % CPU-Auslastung und 5.074.060 KiB RSS (rund 4,84 GiB); das ist weder Spitzen-RAM noch der Speicherbedarf der gesamten App.

Die aktuelle Messung ist langsamer als frühere Messungen desselben Titels. Ohne identische Last-, Temperatur-, Bibliotheks- und Versionsbedingungen lässt sich diese Differenz nicht eindeutig einer Ursache zuordnen. Für die folgende Planung hat deshalb der neue Messwert Vorrang.

Rohdaten: [Aktueller vollständiger Benchmark](full-analysis-benchmark.json). Messskript: [benchmark-full-analysis.mjs](../scripts/benchmark-full-analysis.mjs).

**Vorhandene Messungen**

| Messung | Songlänge | Basisanalyse | Vollständige Berechnung |
|---|---:|---:|---:|
| Bodies, Instrumentenbenchmark | 4:24 min | 5,69 s, ohne Dekodierung | 103,48 s |
| Scatman, Instrumentenbenchmark | 3:38 min | 5,75 s, ohne Dekodierung | 89,99 s |
| DJ-Mashup, Abschnittsbenchmark | 4:36 min | 6,36 s, ohne Dekodierung | 120,25 s |
| Bodies, gepackte Desktop-App | ca. 4:24 min | nicht separat protokolliert | 121,4 s |
| Extended-Track, separate Modellprüfung | 5:23 min | Beat 13,5 s + Stil 2,8 s | allein Struktur/Instrumente 239,03 s |

Die ersten beiden Gesamtwerte enthalten Dekodierung und erneute Showberechnung. Der Extended-Track ist kein vollständiger App-Benchmark: Schon die drei gemessenen Modellschritte summieren sich auf rund 255 Sekunden; Dekodierung und Showaufbau kommen hinzu. Die älteren Berichte protokollieren Hardware und Lastzustand nicht vollständig. Deshalb sind die Unterschiede kein belastbarer Vergleich einzelner CPUs oder Musikgenres.

Quellen: [Instrumentenmessung](instrument-analysis-benchmark.json), [Abschnittsmessung](section-contrast-benchmark.json), [Desktop-App-Prüfung](desktop-ai-bundle-check.md), [Extended-Track-Prüfung](track-analysis-recheck.md). Angaben über automatische Zeitlimits in älteren Berichten beschreiben damalige Versionen; der aktuelle Code hat diese Limits entfernt.

**Übertragung auf einen durchschnittlichen DJ-Laptop**

Für diese Planung bedeutet „durchschnittlich“: ein Laptop mit ungefähr 4–8 leistungsfähigen CPU-Kernen, 16 GB RAM, SSD und Netzbetrieb, ohne zugesicherte GPU-Beschleunigung. Das ist eine definierte Zielklasse, keine erhobene Statistik über DJ-Hardware. Die Wirkung von Hintergrundlast, Energiesparmodus und Kühlung ist nicht vermessen.

Als vorsichtige Planung rechne ich für diese Zielklasse mit einer **1,5–3-mal längeren Berechnungszeit als im neuen Referenzlauf**. Dieser Faktor ist ausdrücklich eine Szenarioannahme, kein gemessener Vergleich zwischen konkreten Laptopmodellen. Aus 0,676 × Songdauer werden so ungefähr **1–2 × Songdauer**. Die Schwankung der vorhandenen Messungen unterstreicht, dass diese Spanne keine garantierte Obergrenze und kein statistisches Konfidenzintervall ist.

| Songlänge | Grobe Planung für vollständige Neuberechnung |
|---|---:|
| 3 Minuten | etwa 3–6 Minuten |
| 4 Minuten | etwa 4–8 Minuten |
| 5 Minuten | etwa 5–10 Minuten |
| 8 Minuten | etwa 8–16 Minuten |

Für einen üblichen 4–5-Minuten-Titel ergibt sich damit **etwa 4–10 Minuten bis zur vollständigen Analyse**. Für die erste spielbare Basis-Show sind unter diesen Annahmen grob **10–30 Sekunden** ein brauchbares Planungsbudget: Die gemessenen 6,89 Sekunden ergeben beim angenommenen Hardwarefaktor etwa 10–21 Sekunden; der übrige Spielraum berücksichtigt nicht gemessenen App-Overhead. Die Tabelle setzt eine freie Analysewarteschlange voraus. Leistungsfähige Geräte können schneller sein, langsame oder ausgelastete Geräte auch langsamer. Längere Songs sind nur näherungsweise proportional skalierbar; Prozessstart und Modellladen verursachen zusätzliche feste Kosten.

**Cache, Ersteinrichtung und Hardwaregrenzen**

Bei einem gültigen gespeicherten Vollergebnis entfallen die Modellberechnungen. Es bleiben Laden, Darstellen und gegebenenfalls Audiozugriff; hierfür liegt keine neue separate Zeitmessung vor. Der Cache hängt unter anderem von Dateiidentität, Show-Version und Berechnungsoptionen ab. Änderungen können deshalb eine erneute Analyse auslösen. Ein gespeichertes Teilergebnis ist kein vollständig vorbereiteter Song. Siehe [Show-Cache](../public/dj-library.js).

Modellinstallation und Downloads sind nicht pro Song enthalten. Im vollständigen Desktop-Paket sind Modelle bereits enthalten. Bei einer Entwicklungsinstallation hängt die Einrichtung von vorhandenen Dateien und der Verbindung ab; dafür lässt sich aus den Messungen keine seriöse Minutenangabe ableiten. Neue Analyseprozesse laden die Modelle weiterhin erneut. „Kein Ergebnis-Cache“ bedeutet außerdem nicht, dass auch der Betriebssystem-Dateicache kalt war.

Die aufwendige Struktur-/Instrumentenpipeline ist derzeit ausdrücklich CPU-basiert. Beat This! erlaubt separat CUDA, standardmäßig wird aber ebenfalls die CPU verwendet; Discogs-EffNet verwendet den CPU-Provider. Eine vorhandene Grafikkarte beschleunigt daher nicht automatisch die vollständige Analyse. Beat This! und Struktur nutzen höchstens acht Torch-Threads, Stil höchstens zwei ONNX-Inferenzthreads. Eine CPU mit doppelt so vielen logischen Threads ist deshalb nicht automatisch doppelt so schnell. Siehe [Beat-Adapter](../scripts/beat-this.py), [Stil-Adapter](../scripts/music-style.py), [Strukturadapter](../scripts/song-structure.py).

**Konsequenz für den DJ-Betrieb**

Neue Titel sollten vor dem Set vollständig vorbereitet werden. Für 20 bisher unanalysierte Titel à 4–5 Minuten ergibt das mit obiger Planung grob **1 Stunde 20 Minuten bis 3 Stunden 20 Minuten** reine Analysezeit bei serieller Verarbeitung, ohne zusätzliche Warteschlange. Bereits gültig vorbereitete Titel verursachen diese Kosten nicht erneut.

Für eine belastbare Produktangabe fehlen Messreihen auf repräsentativen Geräten: mehrere Songs verschiedener Länge, kalter und wiederholter Start, Netz-/Akkubetrieb sowie parallele Wiedergabe. Sinnvoll wären Median und 90. Perzentil getrennt für „spielbereit“ und „vollständig“. Die gegenwärtigen Zahlen sind belastbare Einzelmessungen plus ausdrücklich gekennzeichnete Kapazitätsplanung, keine allgemeine Laufzeitgarantie.

**Reproduzieren**

`node scripts/benchmark-full-analysis.mjs /pfad/zum/song.mp3 /tmp/anydj-benchmark.json`

Das Skript nutzt installierte Modelle, neue Modellprozesse ohne Ergebnis-Cache und den aktuellen Show-Worker. Es protokolliert Hardware und Einzelschritte. FFmpeg ersetzt dabei die Browserdekodierung; HTTP, IndexedDB-Speicherung und UI-Aufbau werden nicht mitgemessen. Temporäre Audiodateien werden anschließend entfernt, bestehende Show-Caches bleiben unverändert.
