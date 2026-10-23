# Formationen: Funktionsweise und Songübergänge

Untersuchung und Korrektur vom 23.10.2026.

## Ablauf der aktuellen Lichtsteuerung

1. `dj.js` erstellt pro Vorschauframe einen gemeinsamen Audiozeit-Snapshot beider Decks. Jeder Lichtstream enthält Songplan, Songposition, Beatposition, Palette, langsame Grundhelligkeit, Flackerstärke und sein Gewicht aus Crossfader und Decklautstärke.
2. `dmx-auto.js` löst das Songprofil auf. Der sichtbare Modus **Formationen** heißt intern weiterhin `strobe`. Die Farben beider Decks werden pro Palettenplatz gemischt und auf die eingestellte Anzahl Farbfamilien begrenzt.
3. `song-movement-plan.js` und der gemeinsame musikalische Score liefern Phrasen, musikalische Gesten, Aufmerksamkeit und Übergangsabsichten. `dmx-strobe-conductor.js` baut daraus zusammenhängende Sequenzen, Instrumenteinsätze und Formationsszenen. Bei älteren Plänen gibt es einen separaten Auswertungspfad; ohne Songplan eine Beat-Demo.
4. `dmx-formation-music.js` wertet gemessene Energie, Klangfarbe, Drum-/Basseinsätze, Stimmen und gegebenenfalls Melodien aus. Bewegungstransport und Lichtakzente sind getrennt: Ein Beat-Raster allein erzeugt keine gemessenen Instrumenteinsätze.
5. `dmx-strobe-choreography.js` plant Szenen und ihre Entwicklung. `dmx-formation-catalog.js`, `dmx-formation-scenes.js` und `dmx-formation-variations.js` liefern Formen, räumliche Anordnung und Ausdruck. `dmx-formation-actions.js` verbindet Ausgangs-/Zielgeometrie und Gruppenbeteiligung zu einer gemeinsamen Aktion. Wiederkehrende Motive, Aufbauten, Antworten, ruhige Passagen und vorbereitete Höhepunkte haben eigene Regeln.
6. `dmx-strobe-score.js` wertet die vorbereitete Choreografie an der aktuellen Songposition aus. `dmx-strobe.js` erzeugt die Lichtframes. Moving Heads bekommen eine unmaskierte Helligkeitsbasis; feste Spots und Barpixel begleiten das Hauptbild mit eigenen Rollen innerhalb derselben musikalischen Aussage.
7. `dmx-moving-plan.js` bereitet Motorpfade vor. `dmx-moving-heads.js` verbindet sie zur laufenden Vorschau und liefert die musikalische Präsenz. `dmx-activity.js` mischt diese Präsenz als getrennte gewichtete Ebenen; gemessene Dunkelphasen bleiben pro Song erhalten.
8. `dmx-group-motion.js`, `dmx-formation-rig.js` und `dmx-ar-model.js` verteilen die Formationen auf tatsächlich vorhandene Geräte, Reihen und gegenüberliegende Bänke. Die Raumgeometrie und Motorbegrenzung werden anschließend berücksichtigt. `dmx-light-geometry.js` lässt kontinuierliche Formationsbewegung sichtbar und schließt bei gehaltenen Bildern während eines notwendigen Richtungswechsels den Vorschau-Shutter.

## Reproduzierte Ursachen des Übergangsflackerns

### Feste Scheinwerfer übernahmen abrupt das Muster des lauteren Decks

`renderStrobe()` wählte die Choreografie des gewichtsdominanten Decks und verwendete sie für die Helligkeitsbeiträge **beider** Songs. Sobald das andere Deck knapp über 50 Prozent der normalisierten Gewichte lag, wechselten alle Begleit-Shutter gleichzeitig. Ein Übergang von einem leuchtenden Begleitbild zu einer musikalischen Pause konnte so mitten in der Überblendung abrupt dunkel werden. Die Moving-Head-Präsenz mischte gleichzeitig bereits beide Songchoreografien.

Korrektur: Vorbereitete Songs werten jetzt jeweils ihre eigene Choreografie samt Begleitrolle, Flackerstärke und Dunkelphase aus. Ihre Helligkeitsbeiträge werden über dieselben Deckgewichte kontinuierlich gemischt. Die gewichtsdominante Szene liefert weiterhin die Statusbeschreibung. Die unvorbereitete Beat-Demo verwendet weiterhin einen gemeinsamen Takt.

### Gemischte Moving-Head-Bilder verloren ihre Projektions-/Bewegungskennzeichen

`presenceComposition()` übernahm `beamPicture` und `visibleMotion` nur von einer Ebene, deren geometrischer Beitrag größer als 0,5 war. Bei gleichgewichteten Decks konnte keine Ebene diese Schwelle erreichen. Bei einer Mischung aus bewegtem und gehaltenem Bild konnte die Freigabe für sichtbare Bewegung sogar über einen längeren Teil des Übergangs fehlen. Dadurch änderte sich die Projektionsbehandlung, und der Motornachlauf konnte den Vorschau-Shutter unbeabsichtigt schließen.

Korrektur: Eine tatsächlich beitragende Formation behält ihre Kennzeichen. Die Mischung mehrerer Formationsbilder gilt selbst als sichtbare Bewegung, auch zwischen gehaltenen Bildern. Ebenen mit Gewicht null aktivieren keine Bewegung. Ein einzelnes gehaltenes Bild verwendet weiterhin den dunklen Motortransfer.

## Prüfung

`test/dmx-formation-song-transition.test.mjs` deckt folgende Fälle ab:

- Kontinuierliche Helligkeitsmischung direkt vor, auf und nach gleichen Deckgewichten, einschließlich Anfang und Ende der Überblendung.
- Übergang in einen musikalisch dunklen Songabschnitt ohne abrupten Verlust des auslaufenden Begleitlichts.
- Erhalt der Raumprojektion und sichtbaren Bewegung während der Formationsmischung.
- Inaktive Ebenen mit Gewicht null.
- Aktuelle gemeinsame Songchoreografie mit `formationStory`, mehreren Reihen und zwölf Geräten pro Reihe.
- Tatsächlicher Vorschau-Motor: Licht bleibt während der sichtbaren Mischung an; ein einzelner gehaltener Richtungswechsel bleibt dunkel.

Die Regressionen wurden zunächst mit dem bisherigen Verhalten reproduziert. Zwei abschließende Prüfläufe waren erfolgreich: 301 Tests zu Formationen, Strobe, Gruppenbewegung und Kontinuität sowie 99 ergänzende Tests zu Raumplanung, Projektion, Gruppenkomposition, Schutzbereichen und den neuen Songübergängen. Die Prüfläufe überschneiden sich teilweise. `git diff --check` war ebenfalls erfolgreich.

Die technischen Prüfungen ersetzen keine Sichtprüfung mit den konkreten Titeln und keine Prüfung physischer DMX-Geräte.

## Nachprüfung: subjektiver Zeitversatz in der 3D-Vorschau

Der Nutzer beobachtet nach mehreren Titeln einen weniger präzisen Eindruck in der 3D-Vorschau. Die Quellpositionen werden weiterhin unmittelbar aus `audio.currentTime` gelesen. Ein kumulativer Songzeitversatz ist bei der Codeprüfung nicht nachgewiesen worden.

Ein konkreter Schwachpunkt war dagegen die Vorschauplanung: `startShowClock(..., 16)` wartete nach der vollständigen synchronen Lichtberechnung weitere 16 ms, bevor der nächste Durchlauf beginnen konnte. Bei beispielsweise 10 ms Rechenzeit entstehen damit mindestens 26 ms zwischen Aktualisierungen. Außerdem kann die Reservierung eines kommenden Beats andere, dazwischenliegende Akzente später abtasten. Das kann als Nachlaufen oder unpräzise Reaktion wahrgenommen werden, ohne dass die Songzeit selbst driftet.

Die lokale Vorschau verwendet jetzt `startPreviewClock()`: Aktualisierung an Bildschirmframes, begrenzt auf ungefähr 60 Aktualisierungen pro Sekunde und mit unverändertem direkten Audiozeit-Snapshot. Nach einer Unterbrechung wird sofort die aktuelle Position ausgewertet. Für einen versteckten Tab bleibt ein Timer aktiv, weil derselbe Aktualisierungspfad auch die Hardwareausgabe versorgt. Beim Sichtbarkeitswechsel wird der bisherige Termin storniert; dadurch entstehen keine parallelen Schleifen.

21 Tests zu Vorschauuhr, lokaler/VR-Interpolation und Formationsübergängen bestehen. Die neuen Uhrtests prüfen unter anderem zwölf Titelwechsel, abwechselndes Wiedergabetempo, eine längere Unterbrechung, Rechenkosten pro Frame, hohe Bildschirmfrequenzen und den Wechsel zwischen sichtbarem und verstecktem Tab.

Der bestehende Browsercheck `scripts/check-dmx-playback.mjs` erreichte die Audioprüfung nicht: Er wartete erfolglos auf den erwarteten Fertig-Status der importierten Testtitel. Damit ist über diesen Check kein vollständiger Durchlauf der Musikbibliothek belegt. Die konkrete subjektive Beobachtung über mehrere echte Titel muss weiterhin am betroffenen Rechner überprüft werden.

Ein separater Chrome-Smokecheck im geladenen DJ-Pult war erfolgreich: lokale WAV-Wiedergabe mit acht Neustarts, abwechselndem Tempo und zusätzlichen 6 ms Rechenlast je Vorschauaktualisierung. Gemessen wurden 192 Aktualisierungen in etwa 3,2 s, Median 16,7 ms und 95. Perzentil 17 ms. Das prüft den Browser-Takt unter Last; es ist keine Sichtprüfung der konkreten Formationen über acht vollständige Musiktitel.

## Klarere Formen und sichtbarere Abwechslung

Die weitere Rückmeldung betrifft vor allem die Lesbarkeit/Zusammengehörigkeit der Formen und die musikalische Abwechslung, weniger den Vorschautakt.

### Lichtgruppen zeichnen die Silhouette über die Bühne

Perkussive Katalogformationen der Reihen-Familie verteilten ihre Antworten bisher auf zusammenhängende radiale Teilbereiche. Ein Viertel der Geräte konnte dadurch nur einen schmalen Ausschnitt einer eigentlich breiten Figur zeigen. Die neue Aktion speichert für diese Bilder `groupOrder: interleaved`: gespiegelte Gerätepaare wechseln weiterhin gemeinsam auf den gemessenen Einsätzen, verteilen sich aber über die Figur.

Die Änderung greift ab vier Geräten je Antwortgruppe. Kleine Installationen behalten ihre vollständigen bisherigen Gruppen; Bassübergaben zwischen Reihen und ruhige Passagen behalten ihre Anordnung. Gerätezahl, Impulszeiten, Geometrie, Lichtstärke und Anzahl der gleichzeitig aktiven Strahlen werden für das Vergleichsbeispiel beibehalten.

Beispiel mit 24 Geräten, Bogenformation und sechs hellen Geräten: Der mittige alte Teilbereich zeichnet 18,7 Prozent der normierten Bühnenbreite, die verteilte Antwort 86 Prozent. [Schematischer Vergleich](formation-clarity-comparison.svg). Dies ist eine Zielebenenprüfung, keine Aussage über jeden möglichen Raum oder jedes Layout.

### Geometrischer Kontrast innerhalb der musikalisch geeigneten Auswahl

Die Formauswahl berücksichtigt zusätzlich zu Namen, Konstruktion und Kontur jetzt die tatsächlichen normierten Koordinaten aller Strahlen in drei Reihen und zwei Bewegungsphasen. Sehr ähnliche kürzlich gezeigte Silhouetten bekommen einen Auswahlabzug. Die bestehende Grenze für musikalische Eignung bleibt bestehen; explizite Ausgangsbilder und das Wiedererkennen eines passenden Motivs behalten Vorrang. Die Signaturen werden je Katalogform einmal berechnet und wiederverwendet; die Auswahl findet bei der Planung statt, nicht pro Anzeigeframe.

Bei einer synthetischen melodischen Phrasefolge steigt der mittlere geometrische Mindestabstand zu den letzten drei Katalogbildern von 0,136 auf 0,189. Diese normierte Diagnose beschreibt die Silhouetten; sie ist kein allgemeiner subjektiver Qualitätswert. Andere Texturen können durch die engeren musikalischen Vorgaben weniger stark oder anders reagieren.

### Prüfung

341 Tests zu Formationen, Strobe, Gruppenzusammensetzung, Raumplanung, Synchronität und Lesbarkeit bestehen. Drei neue Regressionstests prüfen breite Silhouetten bei unverändert sparsamer Beleuchtung, Spiegelpaar-Synchronität, kleine Installationen, Bassreihen und geometrische Abwechslung innerhalb des musikalischen Eignungsbudgets. Vorhandene Tests bestätigen weiterhin Motivwiederkehr, deterministische Wiedergabe, übertragene Szenendaten, Motorgrenzen und kontinuierliche Übergänge. Ein zusätzlicher Browservergleich im 3D-Referenzrenderer prüft dieselbe synthetische Position mit 24 Geräten und jeweils sechs hellen Strahlen; ohne Audio und ohne Beurteilung einer vollständigen realen Titelfolge.

## Liedende: weicher Ausklang statt Schluss-Blackout

Für `dmx-test.mp3` dokumentiert der gespeicherte Vollsongbericht eine letzte aktive Szene bis 202,5 s und anschließend eine Pausenszene bis zum Dateiende bei 216,111 s. Eine zusätzliche Prüfung der lokalen Audiodatei mit FFmpeg (`silencedetect`, −45 dB, Mindestdauer 0,3 s) findet den Beginn der abschließenden leisen Strecke erst bei 204,138 s. Die Pausenklassifikation liegt damit etwa 1,64 s vor dieser Pegelschwelle. Das ist ein Vergleich mit dem gespeicherten Analysebericht, keine neue vollständige Modellanalyse und keine Bestätigung des aktuell im Nutzerbrowser geladenen Plans.

Die Formationsauswertung setzte beim Wechsel auf `silence` die Beleuchtung ausdrücklich sofort auf null. Sie besitzt jetzt eine gesonderte Behandlung der zusammenhängenden abschließenden Pausensequenzen: Das letzte aktive Lichtbild wird an seiner tatsächlichen Endposition eingefroren und über bis zu 1,8 s mit einer weichen Kurve ausgeblendet. Der Ausklang endet spätestens mit der Dateidauer. Der lange stille Dateinachlauf wird nicht dauerhaft beleuchtet.

Dafür werden Geometrie, Gerätebeteiligung und die Helligkeitsbasis unmittelbar vor der Schlusssequenz gemeinsam verwendet. Auch wenn die laufenden Quellframes schon Helligkeit null liefern, kann das vorhandene Bild ausklingen. Die Formationspräsenz wendet die Ausblendung bei Moving Heads einmal an; feste Scheinwerfer verwenden dieselbe Kurve. Die frühere schnelle Dunkelmaske der Schlusssequenz multipliziert den Ausklang nicht zusätzlich weg. Interne musikalische Pausen, explizit ausgeschaltete Quellen und vollständig stille Pläne erhalten keinen Nachleuchteffekt. Ein manueller Wiedergabestopp bleibt unmittelbar.

Es wurden sieben gezielte Tests ergänzt: Kontinuität und eingefrorene Endgeometrie, gemeinsame Helligkeitskurve für bewegte/feste Geräte auch bei Quellhelligkeit null, interne Pausen und Off-Zustände, Ausklang bei deaktiviertem Beat-Flackern, kurze Dateinachläufe, deterministische Sprünge und Szenenübertragung, die dokumentierte Schlussgrenze von `dmx-test.mp3` sowie der aktuelle gemeinsame Formationspfad mit drei Reihen. Alle bestehen. Ein breiter Prüflauf mit 345 Formations-, Strobe-, Aktivitäts-, Gruppen- und Raumtests war ebenfalls erfolgreich; die zuletzt ergänzten Schlussprüfungen wurden anschließend mit dem vollständigen Schluss-Testfile ausgeführt. Auch die bisherigen Strobe-Grundtests bestehen nach der Ergänzung für deaktiviertes Beat-Flackern.

Die Änderung betrifft den Übergang in eine analysierte abschließende Pause. Ein Titel ohne eine solche Schlusssequenz erhält dadurch keine zusätzliche Wiedergabe nach dem natürlichen Dateiende. Eine Hör-/Sichtabnahme mit der aktuellen gespeicherten Nutzerkonfiguration steht noch aus.

## Unbegründete Dunkelheit im Lied: Tomorrowland bei 2:42

Referenz: `tomorrowland-belgium-2019-closing-ceremony-Mi1RTIyihKo.mp3`, Nutzerbeobachtung bei etwa 162 s. Die lokale Datei dauert 532,475 s. Für die Reproduktion wurde der Abschnitt 144–180 s lokal mit dem installierten All-In-One-/htdemucs-Modell analysiert; keine Übertragung der Audiodatei. Diese Analyse eines Ausschnitts ist nicht identisch mit dem vollständigen aktuell gespeicherten Browserplan.

Die bisherige relative Instrumenten-Pausenerkennung markiert im Ausschnitt 162,7–175,6 s als Ruheintervall. Das Originalsignal läuft aber weiter: Der gemessene Mono-RMS liegt beispielsweise bei 162 s um 0,069 (etwa −23 dBFS) und bei 164 s um 0,018 (etwa −35 dBFS). Auch ein separater FFmpeg-Silencedetect-Durchlauf mit −45 dB findet zwischen 155 und 171 s keine Pause. Der große Kontrast zum vorherigen lauten Abschnitt wurde fälschlich als Grund für vollständige Dunkelheit gewertet. Die Szenenauswertung setzt solche Pausen auf `silence` und überschreibt damit auch laufende Formationsübergänge mit Helligkeit null.

`instrumentRests()` berücksichtigt jetzt zusätzlich die vorhandene, vom Originalmix abgeleitete `motionEnvelope`. Ein relativ schwaches Instrumentensignal genügt nicht mehr: Auch das Originalsignal muss über das bestätigte Ruheintervall nahe an Stille liegen. Die normierte Eintrittsschwelle beträgt 0,035, die Rückkehrschwelle 0,055. Beide Auswertungspfade – Szenenklassifikation und tatsächliche Dunkelmaske – verwenden dieselbe Bestätigung. Für alte Pläne ohne Originalmix-Hüllkurve bleibt die bisherige Instrumentenauswertung erhalten. Echte, separat im Originalsignal erkannte Blackout-Cues bleiben maßgeblich.

Zusätzlich erhält die gemeinsame Formationsregie die aktuell ausgewertete akustische Rolle. Eine unter der früheren Logik gespeicherte `silence`-Absicht darf einen nun hörbaren Abschnitt nicht erneut ausschalten. Die gespeicherten Daten werden dabei nicht verändert.

Am lokalen Ausschnitt entfällt das falsche 12,9-sekündige Ruheintervall vollständig. Kompakte, nicht rekonstruierbare Pegelmerkmale aus der Analyse sind als `test/fixtures/tomorrowland-quiet-passage.json` gespeichert. Drei Regressionen prüfen die konkreten Pausengrenzen, Beleuchtung mit einer alten gespeicherten Stille-Absicht, unveränderte Plandaten sowie echte Stille und ausdrücklich vorhandene Blackout-Cues. Die Formationsauswertung für feste Geräte und Moving Heads bleibt an den untersuchten Stellen über null. Der breite Prüflauf mit 397 Tests zu Formationen, Strobe, Instrumenten, Pausen, Songplanung und Raumlogik besteht; `git diff --check` ebenfalls.

Das ist eine Signal-/Regiereproduktion mit lokalem Audioausschnitt, keine audiovisuelle Abnahme des vollständigen Songs in der gespeicherten Nutzerbühne.

## Allgemeine Ursachen für Formationsstillstand

Die Korrekturen verwenden keine Titel- oder Zeitstellen-Ausnahmen. Drei Ursachen lagen in der gemeinsamen Formationsauswertung:

- Die Entwicklung hatte am letzten gemessenen Einsatz bereits ihren gesamten Bewegungsfortschritt verbraucht. Ein noch klingender Schlusston konnte dadurch lange unbewegt bleiben. Jeder Abschnitt der Quellereignis-Uhr einschließlich des Nachklangs erhält jetzt einen Anteil am Fortschritt; die Geschwindigkeit bleibt an den Stützstellen stetig.
- Eine Zusammenführung konnte bei einem frühen Plateau der Energiehüllkurve alle Strahlen schließen und die Geometrie vollständig zusammenziehen. Sie sammelt jetzt weiter durch die Phrase und erhält ein kompaktes mittiges Bild. Echte Pausen und explizite Dunkelzustände bleiben gesondert maßgeblich.
- Bei einer erst teilweise geöffneten Formation konnte ein Plateau derselben Hüllkurve trotz weiterer Quellereignisse das ganze Bild einfrieren. Die Quellereignis-Uhr trägt jetzt eine kleine gemeinsame Höhenbewegung. Öffnungsgrad und Lichtimpulse bleiben unverändert; der Übergang in die anschließende Bewegung endet ohne Positions- oder Geschwindigkeitssprung.

Vier Regressionstests prüfen lange gehaltene Schlusstrecken, Zusammenführungen für unterschiedliche Geräte-/Reihenzahlen, teilweise Öffnungen mit Plateau, gespeicherte Szenenübertragung, manuelles Einfrieren und tatsächliche Pausen. Die bestehenden Prüfungen für Öffnungsfortsetzung prüfen zusätzlich den unveränderten Eintritt in die anschließende Bewegung.

### Vollsongreferenz TCHIKI TCHIKI TCHIKI

`TCHIKI TCHIKI TCHIKI - Make The Girl Dance (original).mp3` wurde lokal vollständig neu analysiert (189,1004 s). Nach den Korrekturen für Entwicklung und Zusammenführung zeigte der Öffnungspfad noch Stillstände etwa bei 41–45,6 s sowie 69,2–71,6 s, obwohl weitere Quellereignisse vorhanden waren. Diese verschwinden mit der allgemeinen Plateau-Korrektur.

Die abschließende Auswertung tastet den gemeinsamen Formationsscore mit 5 Hz für drei Reihen mit jeweils 16 Zielstrahlen ab. Ein geometrischer RMS-Unterschied unter 0,000001 zwischen aufeinanderfolgenden Bildern über mindestens eine Sekunde zählt als Stillstand. Helligkeitsprüfung einschließlich Quellbasis und Dunkelmasken: kein vollständiger Dunkelzustand im untersuchten Score. Verbleibend ist das gewollt gehaltene Schlussbild ab etwa 187,4 s mit anschließendem Ausklang. [Messdaten und Szenen](formation-tchiki-stall-audit.json).

Das ist eine Prüfung einer frischen Analyse und der gemeinsamen Lichtregie. Sie beinhaltet keine gespeicherten Nutzerüberschreibungen, Raumzuordnung, GPU-Pixelprüfung oder audiovisuelle Abnahme der konkreten 3D-Vorschau. Ein vollständiger Blackout des Nutzerfalls ließ sich in dieser frischen Analyse nicht reproduzieren; seine Abwesenheit im Messlauf ist keine Bestätigung für jede gespeicherte Konfiguration.

Abschließender breiter Prüflauf: 401 Tests bestanden, einschließlich Formationen, Öffnungsfortsetzung, Motorgrenzen, Strobe, Pausen, Instrumentenaktivität, Songplanung und Raumlogik. Syntaxprüfung und `git diff --check` ebenfalls erfolgreich.
