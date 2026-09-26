# Prüfung der Tests auf gestalterische Sackgassen

## Umfang und Methode

Alle 126 `test/*.test.mjs` wurden nach Testnamen, importierten Zuständigkeiten und Assertions durchsucht; die auffälligen Tests zur Analyse, Choreografie, Präsenz, Gruppierung und Bewegung wurden im Kontext gelesen. Das Inventar enthält jede Datei und die Zeilen der mechanisch erkannten Kandidaten. Ein Kandidat ist ausdrücklich kein nachgewiesener Fehler. Die 802 statisch erfassten Testtitel sind keine Laufzeit-Testzählung; dynamisch erzeugte Tests erklären Abweichungen.

Dies ist eine Prüfung mit konkreten Änderungsempfehlungen. Produktionscode und Tests wurden in diesem Durchgang nicht verändert. Nicht jede Assertion außerhalb der Song-/Lichtsteuerung wurde fachlich im Detail bewertet. Browser-Prüfskripte in `scripts/` gehören nicht zur npm-Testsuite und wurden nicht vollständig ausgeführt oder geprüft. Die alte Gerätemanager-UI und ihre Tests sind gemäß AGENTS.md keine Abnahmekriterien für die aktuelle Raumplanung.

## Wichtigste Befunde

### 1. Hoch: Fast unbewegtes Schlagzeug wird als gewünschtes Verhalten festgeschrieben

`test/dmx-automatic-restraint.test.mjs:36–46`: Bei einem durchgehend rhythmischen Beispiel werden weniger als 1,5 Grad Pan-Spannweite und weniger als 0,02 normierte Tilt-Spannweite verlangt. Der Input hat rhythmischen Antrieb 0,8. Nur ein herausragender Akzent muss davon abweichen.

**Wirkung:** Eine größere, aber flüssige Bewegung bei gleichmäßig kräftiger Musik würde den Test brechen. Das schützt eine konkrete zurückhaltende Interpretation und keine Motorgrenze. Es passt unmittelbar zum berichteten Problem mit Metal. Der Test verursacht die Laufzeitbewegung nicht, aber erschwert deren sinnvolle Änderung.

**Ersatz:** Ruhige, treibende und akzentreiche Varianten derselben synthetischen Passage vergleichen. Erhöhte rhythmische Evidenz soll erkennbare Bewegung ermöglichen; Übergänge müssen stetig und motorisch erreichbar bleiben. Nicht jeder Schlag braucht ein neues Ziel. Die Tests müssen sowohl eingefrorene Ausgabe als auch wahllose Richtungswechsel ablehnen.

### 2. Hoch: Vielfalt wird mit einer Pflicht zum Formwechsel verwechselt

`test/show-score.test.mjs:20–35`: Mindestens fünf verschiedene Formen und keine gleiche Form in benachbarten Bildern; zugleich weniger als halb so viele Bewegungscues wie Beats und mindestens eine Pause über 0,4 Sekunden.

**Wirkung:** Motivrückkehr, bewusst weiterentwickelte gleiche Formen und lange zusammenhängende Fahrten können als Fehler gelten. Die Zahl fünf ist kein Nachweis musikalischer Vielfalt. Dieser Befund betrifft den Show-Modus, nicht automatisch die aktuelle Automatik.

**Ersatz:** Kontrollierte Musikänderungen müssen nachvollziehbar die Entwicklung beeinflussen. Wiederkehrende Motive dürfen dieselbe Form aufgreifen. Prüfen, dass Ziele erreichbar sind, stille Musik keine künstlichen Akzente erzeugt und die ausgewählte Bewegung im Raum tatsächlich unterscheidbar bleibt. Motorprüfungen in diesem Test unbedingt behalten.

### 3. Hoch: Gestaltungsparameter werden zu unveränderlichen Verträgen

`test/dmx-automatic-restraint.test.mjs:18,32,53,85–86`: Exakt 65 % Begleithelligkeit sowie Reihenanteile exakt 0,34 und 0,67. Das sind teilweise von mir zuletzt eingeführte Assertions.

**Wirkung:** Jede sinnvolle Abstimmung dieser Werte produziert Testfehler, selbst wenn Hierarchie, Quellgrenzen und Blackouts korrekt bleiben. Ein nachträgliches Anpassen der erwarteten Zahlen liefert dann kaum unabhängige Sicherheit.

**Ersatz:** Führende Quellen behalten ihren vorgesehenen Pegel; Begleitung ist sichtbar und schwächer; kein Gerät wird über die Quellstärke angehoben; Blackouts bleiben null; reine Änderungen der Bewegung ändern keine Farben oder Pegel. Dichte musikalische Varianten dürfen mehr Mitglieder einsetzen, ohne exakt diese zwei Anteile vorzuschreiben.

**Behalten:** 72 Moving Heads/120 statische Quellen im ausdrücklich geprüften 192er-Preset sowie 24 aktive Köpfe bei explizit vorgegebenem Reihenanteil 1/3. Diese Zahlen beschreiben Eingabeverträge und sind nicht beliebige Stilquoten.

### 4. Mittel: Testname klingt nach Gesamtbewegung, geprüft wird nur die statische Grundform

`test/dmx-light-scenes.test.mjs:33–43`: „a groove answers without roaming“ fordert identische `scenePose` bei Sekunde 13 und 21. Die aktuelle Gesamtbewegung entsteht zusätzlich aus Gesten und Gruppenbewegung.

**Wirkung:** Die Assertion kann als Verbot von Groove-Bewegung missverstanden werden. Umgekehrt kann sie grün bleiben, obwohl sich die reale Ausgabe nicht mehr bewegt, weil sie die endgültige Zielkette gar nicht untersucht.

**Ersatz:** Als isolierten Grundform-Test benennen. Zusätzlich die endgültigen Ziele nach Quellbewegung, Gruppierung und Raumabbildung prüfen. Ein explizit stationäres Design darf identisch bleiben; rhythmische Energie allein sollte nicht pauschal Stillstand erzwingen.

### 5. Mittel: Tempovergleich setzt identische Cue-Anzahl voraus

`test/dmx-moving-bars.test.mjs:15–20`: Bei 100 und 140 BPM werden identische Cue-Anzahlen und indexweise exakt skalierte Zeiten verlangt.

**Wirkung:** Eine physikalisch sinnvolle Reduktion der Zielanzahl bei hohem Tempo würde scheitern. Gleiche musikalische Position bedeutet nicht, dass Motoren beliebig schnell dieselbe Sequenz fahren können.

**Ersatz:** Ausgewählte Ankünfte müssen zu den tatsächlich gelieferten musikalischen Ereignissen passen. Bewegung muss bei beiden Tempi vorhanden, erreichbar und deterministisch sein. Exaktes Timing weiterhin separat an bereits vorgegebenen Cues prüfen; Cue-Auswahl darf motorisch bedingt unterschiedlich ausfallen.

### 6. Mittel: Neue Übergangstests binden sich zu eng an die aktuelle Lösung

`test/dmx-moving-bars.test.mjs:29–45`: Jeder als `flowing` markierte Cue muss das gesamte Zeitintervall und für jeden Kopf dieselbe Fahrtdauer verwenden. `test/dmx-active-passages.test.mjs:39` bindet die Grenzen an das interne `flowing`-Flag.

**Wirkung:** Eine bessere kontinuierliche Kurve, rollende Übergabe oder bewusst gestaffelte Gruppe kann scheitern, obwohl keine ruckartigen Übergänge entstehen. Auch diese Bindung stammt aus meinen letzten Korrekturen.

**Ersatz:** Position, Geschwindigkeit, Beschleunigung und unbegründete Stillstandsintervalle über den Verlauf messen. Gezielte Akzente separat kennzeichnen und prüfen. Volle Fahrtzeit darf eine Implementierung sein, sollte aber nicht die einzige zulässige Lösung werden.

### 7. Mittel: Formkatalog und Songvielfalt werden stellenweise gleichgesetzt

`test/dmx-group-motion.test.mjs:23`, `test/dmx-group-composition.test.mjs:21`, `test/dmx-light-scenes.test.mjs:122`: feste Signaturzahlen 10, 6 und 25.

**Wirkung:** Die Prüfung auf unterschiedliche Geometrien ist sinnvoll. Die feste Anzahl behindert jedoch Erweiterungen und sagt wenig über erkennbare Unterschiede im realen Raum aus. Minimale Koordinatendifferenzen reichen für unterschiedliche JSON-Signaturen.

**Ersatz:** Erwartete Vollständigkeit aus dem jeweils exportierten Katalog ableiten. Geometrische Unterschiede nach Raumabbildung mit einer sinnvollen Toleranz bewerten. Dabei bewusst redundante Varianten nicht ohne musikalische Begründung verbieten. Nicht die gesamte Prüfung entfernen.

### 8. Niedrig bis mittel: Alte Profilregeln sind nicht als allgemeine Automatikvorgaben zu verwenden

`test/dmx-moving-presence.test.mjs:28–36` erzwingt für vokaldominierte Spitzen `spread=0` und `level=.55`. Die lokale Wrapper-Funktion setzt ausdrücklich `movingMood:'energetic'`.

**Wirkung:** Das ist eine alte Party-/Alternativprofil-Erwartung, keine aktuelle Automatik-Regel. Als allgemeine Designregel würde „viel Gesang = wenig Bewegung“ beispielsweise aggressiven gesangsbetonten Rock falsch einschränken.

**Ersatz:** Profil im Testnamen deutlich machen, Zahlen als überprüfbare Produktentscheidung behandeln und Gesang gegen rhythmische Evidenz testen. Änderungen am Party-Verhalten nicht beiläufig aus einer Automatikbereinigung ableiten.

## Was nicht als Entwicklungsbremse entfernt werden sollte

- Blackouts, ausgeschaltete Quellen, Master-Dimmer und manuelle Stops.
- Motorische Erreichbarkeit, endliche Koordinaten, Grenzen und Hindernisse.
- Deterministische Ausgabe beim Zurückspringen, Deck-Mischung und Cache-Trennung.
- Explizite Farben, manuelle Szenen, Preset-Geräteanzahlen und Protokollwerte.
- Tests, dass aus fehlender Analyse keine angeblich gemessenen Beats erfunden werden. Das darf echte Instrumentanschläge oder tonale Entwicklungen aber nicht ausschließen.
- Gleiche Testidee an unterschiedlichen Schnittstellen: Blackout am Quelldimmer, nach Gruppenabbildung und nach Shutter ist keine unnötige Duplikation.

## Fehlende Absicherung

Die bisherigen Einzelschicht-Tests konnten durchgehend bestehen, während eine Gruppenform die musikalische Quellbewegung ersetzte oder mehrere Dimmer sich multiplizierten. Für die Entwicklung hilfreicher ist eine kleine Folge unveränderlicher Szenarien durch die gesamte Kette: Analyse → Szene → Cue → Quellpegel → Gruppen → Raum → Motor → Renderer-Eingaben. Vergleiche sollten Änderungen an Energie, Rhythmus, Raumgröße und Profil gezielt isolieren.

Bildvergleiche allein mit festen Pixelwerten wären ebenfalls zu starr. Sinnvoller sind Messwerte plus reproduzierbare Videos derselben Passagen/Kamera; die visuelle Qualität bleibt eine bewusste Abnahme. Die bestehenden synthetischen Tests sollen behalten und um diese Schnittstellen ergänzt werden, nicht durch Songs allein ersetzt werden.

## Empfohlene Reihenfolge

1. Bewegungsdeckel und Gestaltungszahlen in `dmx-automatic-restraint` durch vergleichende Verhaltenstests ersetzen.
2. Show-Formwechselquoten und starre Tempo-/Übergangserwartungen lösen; Motor- und Blackout-Assertions behalten.
3. Katalogtests datengetrieben machen und Profile/Grundformen klar benennen.
4. Eine durchgängige Prüfung für kräftigen Groove, Aufbau ohne Schlagzeug, echte Stille und zwei Raumgrößen ergänzen.

Keine Tests blind löschen oder nur so ändern, dass sie grün werden. Jeder Ersatz braucht ein benanntes Fehlverhalten, das er weiterhin erkennt.

## Umgesetzte Bereinigung

- Die kleine feste Bewegungsobergrenze für regelmäßige Percussion wurde durch einen Vergleich schwacher und kräftiger rhythmischer Passagen ersetzt. Der Produktionscode lässt die Bewegungsamplitude mit Energie und rhythmischem Antrieb wachsen; Motorplanung begrenzt weiterhin die tatsächliche Fahrt.
- Show-Tests verlangen weder fünf Formen noch einen Wechsel an jeder Phrasengrenze. Der Show-Plan hält eine Form bei gleichbleibender Rolle und nahezu gleichem gemessenem Charakter; eine gezielte Änderung der Klangfarbe muss weiterhin eine Entwicklung auslösen. SHOW_SCORE_VERSION wurde dafür auf 3 erhöht.
- Feste Begleitpegel und Reihenanteile werden als Hierarchie und Grenzen geprüft. Die Tests für Nullhelligkeit, Quellgrenzen und das 192er-Preset bleiben bestehen.
- Tempovergleiche prüfen musikalische Zeitpunkte und motorische Erreichbarkeit bei 100, 140 und 190 BPM, ohne identische Cue-Anzahl zu verlangen.
- Übergänge werden auf sichtbare Bewegung über den Zeitraum und stetige Geschwindigkeit geprüft; volle Fahrtzeit ist keine obligatorische Implementierung mehr.
- Katalogprüfungen leiten ihre erwartete Anzahl aus den exportierten Katalogen ab.
- Sechs neue Integrationstests führen alle Songprofile durch Quellframe, automatische Farbausgabe, Bewegungscues, Präsenz, Shutter und kleine/große Raumabbildung. Sie sichern sichtbare Ausgabe, erhaltene Bewegung, Quellgrenzen, Blackouts, Idempotenz und deterministisches Zurückspringen. Diese Tests führen weder GPU-Rendering noch die reale Browser-Nutzersitzung aus.

Abschluss: **816/816 Tests bestanden**, `git diff --check` ohne Befund. Nicht alle Empfehlungen dieses Berichts erfordern eine Änderung: Schutzprüfungen und ausdrücklich benannte alte Profilregeln bleiben erhalten. Visuelle Qualität ist weiterhin durch Wiedergabe zu beurteilen.
