**Lokale KI für WiZ Local – Untersuchung vom 20.09.2026**

Empfehlung: Die vorhandene Audiopipeline und den Editor um eine optionale lokale Gestaltung mit dem bereits installierten `qwen3.5:4b` erweitern. Das Modell wählt Paletten und Effekte pro musikalischem Motiv; Anwendungscode bestimmt Zeitpunkte, Wiederholungen, Übergänge und erlaubte Helligkeit. Für eine verbesserte Musikerkennung anschließend Beat This! separat evaluieren. All-In-One ist der fachlich passendere Kandidat für Strophe/Refrain, aber die aufwendigere Integration.

Dies ist eine Architektur- und Machbarkeitsbewertung mit echtem lokalem LLM-Test. Ein Qualitätsvergleich verschiedener Audiomodelle und ein Sichtvergleich an der Lampe wurden nicht durchgeführt. Die Empfehlung ist deshalb kein Nachweis, dass diese Kombination bereits die schönste Lichtshow erzeugt.

**Vorhandene Grundlage und Hardware**

- Intel Core i9-14900HX, ungefähr 32 GB RAM; bei der ersten Prüfung rund 10 GiB verfügbar.
- NVIDIA RTX 5070 Laptop GPU: 8151 MiB Grafikspeicher, davon bei der Abfrage 7443 MiB frei. Der Treiber funktioniert; die erste Abfrage scheiterte an der eingeschränkten Ausführungsumgebung.
- Ollama läuft lokal. `qwen3.5:4b` ist als Q4_K_M vorhanden; kein Modelldownload war nötig.
- Im Test meldet Ollama bei 4096 Kontexttokens rund 3,13 GB GPU-Belegung für dieses Modell. Das ist eine Momentaufnahme für diesen Test, keine allgemeine Obergrenze.
- FFmpeg ist vorhanden. Im geprüften System-Python fehlen PyTorch, Beat This!, All-In-One, Demucs und Basic Pitch. Andere virtuelle Umgebungen wurden nicht untersucht.

`public/show-worker.js` analysiert die MP3 im Browser. `public/show-plan.js` erzeugt eine Partitur und Lichtbilder im Abstand von 125 ms. Die heutigen Abschnittsnamen beschreiben heuristisch Energie und Klang, keine verifiziert erkannten Strophen oder Refrains. `public/melody-analysis.js` schätzt die Melodie aus dem Gesamtmix.

`public/editor-model.js` enthält bereits validierbare Farbpunkte mit Zeit, Farbe, Helligkeit, Weißtemperatur und Übergang. `public/editor.js` speichert Entwürfe anhand von Datei-Hash und Lampe. Das ist der kleinste sinnvolle Einstiegspunkt für generierte, nachträglich bearbeitbare Shows.

`lib/music.mjs` sendet nominal alle 125 ms, wartet auf laufende Befehle und verwirft dadurch überholte Zwischenzustände. Diese 8 Hz sind ein Softwaretakt, keine gemessene Lampenleistung. KI verbessert weder WLAN-Latenz noch die physische Reaktion der Lampe. Aktuell gibt es eine Musiksitzung für eine Lampe; eine räumliche Show mit mehreren Lampen wäre ein eigenes Vorhaben.

**Vergleich der Kandidaten**

| Ansatz | Beitrag für uns | Aufwand / Grenze | Bewertung |
| --- | --- | --- | --- |
| Bestehende Analyse plus feste Gestaltungsregeln | Schnell, reproduzierbar, bereits integriert | Musikalische Abschnittserkennung bleibt heuristisch | Unverzichtbare Vergleichsbasis und Rückfalloption |
| Qwen3.5 4B über lokales Ollama | Stilvorgaben und Zuordnung von Farben/Effekten zu vorhandenen Merkmalen | Erkennt aus dieser Texteingabe keine zusätzlichen Beats oder Instrumente | Bester sofort nutzbarer Gestaltungskandidat |
| Beat This! | Beats und Taktanfänge aus Audio | Python/PyTorch nötig; keine Strophe/Refrain-Erkennung | Bevorzugter erster Ausbau der Audioanalyse |
| All-In-One | Beats, Taktanfänge und funktionale Songabschnitte | Größere Pipeline mit Quellentrennung und zusätzlichen Abhängigkeiten | Passender Ausbau für musikalische Dramaturgie, zunächst isolierter Versuch |
| Demucs plus Basic Pitch | Getrennte Spuren und daraus geschätzte Noten | Mehr Rechenzeit; eine dominierende Melodie ist damit nicht automatisch identifiziert | Später, falls Melodiequalität der entscheidende Engpass ist |
| Größeres allgemeines Sprachmodell | Möglicherweise bessere Planung | Mehr Speicher; fehlende Audioinformationen werden dadurch nicht ersetzt | Aktuell kein begründeter Mehrwert gegenüber dem vorhandenen 4B-Modell |

Qwen3.5 4B ist in Ollama verfügbar. Hier nutzen wir ausschließlich Textmerkmale; die dokumentierte Bildfähigkeit hilft dieser Pipeline nicht. [Ollama-Modellseite](https://ollama.com/library/qwen3.5)

Beat This! bietet Beat- und Downbeat-Ausgabe, CPU-Betrieb und GPU-Betrieb. Das normale Modell umfasst ungefähr 78 MB Gewichte, die kleine Variante ungefähr 8,1 MB; das ist ausdrücklich nicht der vollständige Speicherbedarf von PyTorch und Inferenz. Code und veröffentlichte Gewichte stehen unter MIT. Zunächst `final0` ohne optionales DBN mit unserem bisherigen Tracker vergleichen. [Offizielles Repository](https://github.com/CPJKU/beat_this)

All-In-One liefert musikalische Abschnittsgrenzen und Labels wie Intro, Strophe und Refrain. Das Original benötigt unter Linux unter anderem NATTEN und nutzt Demucs. Der Community-Fork `all-in-one-infer` beschreibt eine Variante ohne NATTEN mit reinem PyTorch. Das macht ihn zum Installationskandidaten, aber Kompatibilität und Qualität wurden hier nicht getestet. Version und Gewichte sollten im Versuch festgehalten werden. [Original](https://github.com/mir-aidj/all-in-one), [Fork-Dokumentation](https://github.com/openmirlab/all-in-one-infer/blob/main/README.md)

Das ursprüngliche Demucs-Repository ist archiviert. Basic Pitch arbeitet laut Hersteller am besten mit einem Instrument zur selben Zeit. Beide sind damit zusätzliche Spezialwerkzeuge und kein direkter Ersatz für unseren Show-Planer. [Demucs](https://github.com/facebookresearch/demucs), [Basic Pitch](https://github.com/spotify/basic-pitch)

**Was tatsächlich getestet wurde**

Die vorhandene Datei `RobbieWilliamsBoddies.mp3` wurde mit FFmpeg als Stereo-PCM bei 16 kHz dekodiert und anschließend mit denselben Analysemodulen wie im Worker verarbeitet. Das ist keine Messung der Browserlaufzeit. Die reine Analyse einschließlich Show-Kompilierung, ohne FFmpeg-Dekodierung, dauerte ungefähr 0,93 Sekunden.

Ergebnis für 263,70 Sekunden Musik: 507 erkannte Beat-Ereignisse, 21 heuristische Abschnitte, 2110 Lichtbilder und ungefähr 46,7 % zeitliche Abdeckung der geschätzten Melodiespur. Die Abdeckung sagt nichts über die Richtigkeit der Noten aus. Aus den Abschnitten wurden zwölf zeitlich verteilte Grenzen als Testanker ausgewählt; sie sind keine manuell bestätigte Songstruktur.

Anfragen gingen ausschließlich an `127.0.0.1:11434`. Das Modell erhielt die zwölf Anker mit Zeit, Energiewert, Abschnittsart und Motivnummer. Es erhielt weder Audio noch Liedtext. Die Zeitpunkte der erzeugten Editorpunkte wurden vom Testprogramm zugeordnet, nicht vom Modell erfunden. Keine Testanfrage steuerte eine Lampe an.

| Versuch | Gesamtdauer | Ergebnis |
| --- | ---: | --- |
| Freie Farbpunkte, ruhig | 11,18 s, davon 6,47 s Modellladen | Editorformat gültig, geprüfte Helligkeits-/Übergangsregeln und Motivfarben eingehalten |
| Freie Farbpunkte, dramatisch | 4,34 s | Format gültig, aber Helligkeitsvorgaben und gleiche Farbe pro wiederkehrendem Motiv verletzt |
| Wiederholung ruhig | 4,21 s | Identisches Ergebnis im selben Testaufbau |

Die ruhige Variante verwendete durchgehend dieselbe Farbe. Das ist zulässig, zeigt aber, dass formale Gültigkeit keine abwechslungsreiche Gestaltung garantiert. Die dramatische Variante verwendete teilweise Helligkeiten unter dem verlangten Mindestwert und wechselnde Farben für dasselbe Motiv. Temperatur 0 und JSON-Schema verhindern solche inhaltlichen Fehler nicht. Die Wiederholung ist eine Einzelbeobachtung, keine Garantie geräte- oder versionsübergreifender Deterministik.

Daraufhin wurde die Aufgabe eingeschränkt: Das Modell darf für jede vorgegebene Motivnummer nur eine Farbe aus vier erlaubten Farben wählen. Anwendungscode setzt anschließend Zeitpunkte, Helligkeit und Übergänge. Beide Varianten erzeugten gültige Zuordnungen mit vier unterschiedlichen Farben. Die genauen Zeiten und Ergebnisse stehen in `local-ai-evaluation.json` unter `boundedRuns`.

Diese zweite Variante ist technisch überzeugender: gleiche Motive erhalten konstruktiv dieselbe Farbe, und Helligkeitsgrenzen hängen nicht vom Befolgen eines Prompts ab. Es wurde damit die Schnittstelle geprüft, nicht die ästhetische Überlegenheit gegenüber einer festen Palettenzuordnung. Für die reine Auswahl von vier Farben allein wäre ein LLM unnötig; sein späterer Mehrwert muss aus individuellen Stilwünschen und einer reicheren, aber begrenzten Auswahl an Gestaltungsmöglichkeiten entstehen.

Ollama unterstützt JSON-Schemas für strukturierte Ausgaben. Zusätzlich muss unser Code Referenzen, Bereiche und musikalische Regeln validieren. [Ollama-Dokumentation](https://docs.ollama.com/capabilities/structured-outputs)

**Konkrete Einbindung**

1. Einen kompakten Analysevertrag einführen: Audio-Hash, Dauer, Analyseversion, Beat-Zeitpunkte, optionale Taktanfänge, Abschnitte, Motivgruppen, Energie und vorhandene Unsicherheitsangaben. Unbekannte Werte bleiben unbekannt. Aus heutiger Heuristik werden keine behaupteten Refrains.
2. Eine optionale Node-Komponente `lib/show-director.mjs` über `fetch` mit Ollama verbinden. Modell und Loopback-Adresse werden serverseitig konfiguriert. Dafür braucht die bestehende Node-App kein KI-SDK und keine neue npm-Abhängigkeit.
3. Als Modellantwort einen versionierten Gestaltungsplan verwenden: bekannte Motiv-IDs, Paletten-/Effekt-IDs, begrenzte Intensitätsklassen und Übergangsarten. Wiederkehrende Motive werden zentral referenziert. Startzeiten und Taktgrenzen liefert die Audioanalyse. Der Compiler setzt feste Grenzen und verarbeitet nur bekannte Effekte.
4. Im Editor „KI-Entwurf erstellen“ ergänzen: Stil auswählen, Vorschau anzeigen, Farbpunkte weiter bearbeiten. Vorhandene Entwürfe mit Undo erhalten. Generierung ist ein eigener Auftrag mit Fortschritt und Abbruch; ein veraltetes Ergebnis darf nach Datei-/Lampenwechsel nicht angewendet werden.
5. Die automatische Show zunächst getrennt behandeln. Ihre Tests verlangen, dass bei gleichen Beats die Helligkeit unabhängig von Klangfarbe und Stimmung bleibt. KI-gesteuerte Helligkeitsdramaturgie gehört deshalb in einen ausdrücklich ausgewählten Gestaltungsmodus, wie ihn der Editor bereits ermöglicht.
6. Generierte Pläne mit Audio-Hash, Analyse-/Modellversion, Prompt-/Schemaversion, Stil und Gerätegrenzen zwischenspeichern. Reines Nachstellen eines Reglers darf keine erneute Modellanfrage erfordern. Bei Modellfehlern bleibt die vorhandene lokale Show verfügbar.
7. Anschließend einen austauschbaren Python-Analyseprozess ergänzen, zuerst für Beat This!. Node verwaltet einen begrenzten Auftrag und liest strukturierte Ergebnisse. Python verarbeitet Audio außerhalb des HTTP-Prozesses. Modelle erst laden, wenn sie gebraucht werden; große Audioanalyse und LLM-Inferenz auf 8 GB VRAM vorzugsweise nacheinander betreiben.

Die aktuelle JSON-API hat ein Limit von 8 KiB und keine Audio-Uploadroute. Stufe 1 benötigt nur kleine Zusammenfassungen. Für vollständige Audiomodelle braucht es einen eigenen begrenzten Upload-/Auftragsweg und temporäre Dateien; das globale JSON-Limit einfach auf MP3-Größe zu erhöhen wäre keine passende Umsetzung. Browser und Server müssen dieselbe Zeitbasis verwenden, weil unterschiedliche MP3-Decoder Zeitversatz erzeugen können. Ein gemeinsames PCM/WAV-Zeitnormal und eine überprüfte Zuordnung zur Wiedergabe gehören zum Audioadapter.

**Wie wir über die endgültige Qualität entscheiden**

Für den nächsten Vergleich fünf bis zehn Lieder verschiedener Art auswählen: klarer Popbeat, ruhige Musik, dichter Rockmix, elektronische Musik und mindestens ein Stück mit wechselndem Tempo. Die vorhandene MP3 bildet nur einen Fall ab.

- Drei Abläufe vergleichen: bisherige Show; verbesserte Audioanalyse mit festen Gestaltungsregeln; identische verbesserte Analyse plus KI-Gestaltung. So bleibt erkennbar, welcher Teil den Nutzen bringt.
- Beats und Taktanfänge an ausgewählten Passagen manuell markieren; Fehlereignisse, ausgelassene Beats und zeitliche Abweichung getrennt auswerten. Abschnittsgrenzen ebenfalls stichprobenartig prüfen.
- Kalten/warmen Start, RAM/VRAM, Abbruchverhalten und Cache messen. Keine Laufzeit anderer GPUs als Versprechen übernehmen.
- Bei gleichem Audio und identischen Helligkeitsgrenzen anonymisierte A/B-Vorschauen bewerten: musikalische Passung, Wiedererkennung, Ruhe, Höhepunkte und gewünschter Stil. Eine zusätzliche Stilbewertung ist nötig; gültiges JSON zählt dafür nicht.
- Die tatsächliche Lampe auf Latenz und Schwankungen prüfen. Gegebenenfalls Vorlauf und Effektdauer daran anpassen; Modellpräzision unterhalb der Ausgabegenauigkeit bringt keinen sichtbaren Vorteil.

Einführung erst bei gültigen Plänen ohne Grenzverletzungen, stabiler Wiedergabe und einer nachvollziehbaren Präferenz gegenüber der Vergleichsbasis. Wenn die KI keinen erkennbaren Vorteil bringt, bleibt der regelbasierte Gestalter die bessere Lösung. Eigene Modelle trainieren ist derzeit nicht sinnvoll: Uns fehlen bewertete Musik-/Lichtshow-Paare, und vorhandene Modelle reichen für den ersten Vergleich.

**Reproduzierbarkeit und Umfang**

`node reports/evaluate-local-ai.mjs` erstellt die Baseline neu und setzt den Ergebnisbericht zurück. Danach führt `node reports/evaluate-local-ai.mjs --infer` drei freie lokale Modellanfragen aus; `node reports/evaluate-local-ai.mjs --bounded` ergänzt zwei eingeschränkte Anfragen. Dafür muss Ollama bereits laufen und `qwen3.5:4b` vorhanden sein. Das Skript ist ein Evaluationswerkzeug, kein produktiver Adapter. Es verändert keine Lampen und keine Laufzeitdateien der App.

Die bestehenden Tests in `test/show-plan.test.mjs` und `test/melody-analysis.test.mjs` liefen erfolgreich. Neue Modelle oder Python-Pakete wurden nicht installiert. Erstellt wurden dieses Dokument, das reproduzierbare Evaluationsskript und seine JSON-Ergebnisse.
