# Schwenker mit musikalischem Anlass

23. September 2026 · Bewegungsspur-Version 5.

Rückmeldung: Die Farben und Helligkeit passen, Schwenker wirken dagegen häufig
unmotiviert. Bisher konnte nahezu jeder ausreichend starke Lichtakzent eine
weitere Position der Bewegungsfigur auslösen. Eine neue visuelle Phrase startete
die Positionsfolge erneut, auch wenn die Musik unverändert blieb.

Die automatische Bewegung analysierter Songs wählt nun räumliche Gesten separat:

- Die erste geeignete musikalische Passage eröffnet eine Formation.
- Eine veränderte Energie, Klangfarbe, Bewegungscharakteristik oder ein eindeutig
  veränderter führender Instrumentenanteil erlaubt eine neue Geste.
- Ein gegenüber dem Median seiner Phrase deutlich stärkerer Lichtakzent darf
  eine Geste auslösen. Gewöhnliche gleichmäßige Akzente halten die Formation.
- Ein Aufbau erlaubt Bewegungen auf erkannten Taktanfängen nur bei tatsächlich
  ansteigender Instrumentenintensität; ein Abschnittslabel allein genügt nicht.
- Vorlauf höchstens 0,6 Sekunden, bei ruhigen Gesten 1,5 Sekunden. Ist die
  Zielposition unter den Geschwindigkeitsgrenzen nicht erreichbar, wird die
  Wegstrecke verkürzt. Zwischen Gesten halten die Köpfe ihre Position.

Die Auswahl gilt für alle Grundstimmungen im automatischen Modus. Explizite
Bewegungsmodi und ältere Pläne ohne Bewegungsanalyse behalten ihre bisherigen
Regeln. Farben, Dimmerkurven und Show-Analyse werden nicht verändert. Die bereits
in der vorigen Iteration vorgenommenen Änderungen bleiben im Arbeitsstand.

Zusätzliche Regressionen prüfen gehaltene Formationen über künstliche
Phrasengrenzen, starke Einzelakzente, Klangwechsel, echte gegenüber nur benannten
Aufbauten, begrenzten Vorlauf, reproduzierbare Positionssprünge und unveränderte
Eingabedaten. Die Geschwindigkeitstests bleiben aktiv.

Validierung: `npm test` — 398 Tests erfolgreich; `git diff --check` ohne Befund.

Dies sind gestalterische Heuristiken. Eine reale Hör-/Seh-Abnahme mit den
beanstandeten Musikpassagen steht aus. Die Prüfung behauptet keine universell
passende räumliche Interpretation. Zum Ausprobieren reicht ein Neuladen der
DJ-Seite: Bewegungsspuren werden pro Sitzung neu vorbereitet; eine neue
Instrumentenanalyse ist für bereits vorbereitete aktuelle Shows nicht nötig.

## Musikalische Bewegungsformen statt Standardellipse

Der Groove-Pfad verwendet jetzt die aus Phrasen, Instrumentverteilung und Abschnitt abgeleitete Form. Zuvor wurde diese verworfen und die Formation überwiegend mit einem Pan-Kosinus/Tilt-Sinus-Paar dargestellt.

- Sweep: seitlicher Schwenk bei fester Tiefe.
- Pulse: rhythmisches Öffnen/Schließen mit fester Tiefe je Gruppe.
- Cross: gegenläufige diagonale Fahrten mit gekoppeltem Pan/Tilt.
- Focus: gebündelte innere Köpfe, zurückhaltende äußere Bewegungen bei Gesang.
- Fan: progressives Öffnen im Aufbau, unabhängig von der Zyklusphase.
- Arc: Hin-/Rückweg auf einem Bogen, keine geschlossene Ellipse.
- Orbit: bewusste Kreisfahrt nur in Disco-Peaks mit hoher Energie/Tonalität, moderatem Schlagzeuganteil und wenig Gesang.

Formationen versetzen und skalieren diese Wege, ohne die gewählte Form zu überschreiben. Motivwiederholung bleibt deterministisch. Bestehende Cue-Zeiten, Reise-/Geschwindigkeitsgrenzen, Akzentbremsung, ruhige Haltephasen und Ruhezonensteuerung bleiben erhalten. Vorberechnete Bewegungsdaten tragen Version 9; Neuladen bereitet die Bewegungen mit der vorhandenen Analyse erneut vor. Ältere Pläne ohne Bewegungsmetadaten behalten den bisherigen Fallback.

Validiert mit geometrischen Pfadtests (offene Wege gegenüber Orbit), durchgängiger Auswahl aus musikalischen Daten, Fächerverhalten in Ribbon-Formation sowie bestehenden Zeit-/Motor-/Ruhezonenprüfungen. 199 DMX-/VR-Tests bestanden. Moving-Heads-Browsercheck bestanden; synthetischer Fünf-Minuten-Song kooperativ in 221 ms vorbereitet. Keine subjektive Prüfung mit realer Lichtanlage.

## Freier Bewegungsbereich für Moving Heads im Raumplan

Moving Heads verwenden im Raum-/AR-/VR-Plan keinen festen Zielpunkt mehr als versetztes Animationszentrum. Ihre Showbewegung wird in die Raumfläche bzw. einen expliziten Bereich abgebildet, unabhängig von gespeicherter Montagerotation oder altem Lichtziel. Die tatsächliche Kopfausrichtung folgt dem aktuellen Ziel. Feste Spots/Bars behalten ihre Ziel- und Rotationseinstellungen; Gruppendrehung im Show-Gerätemanager bleibt erhalten.

Im Raum-Gerätemanager ersetzen vier metrische Bereichsgrenzen (links, rechts, vorne, hinten) die individuelle Drehung. Der ausgewählte Bereich ist im Plan markiert; Moving Heads erhalten dort keinen festen Zielgriff mehr. „Gesamter Raum“ entfernt die individuelle Begrenzung. Intern ist `motionArea` normalisiert und wird bei Speicherung, Export/Import und Übertragung validiert. Rechteckige Teilbereiche müssen vollständig im Grundriss liegen; sie dürfen keine Aussparung kreuzen. Ruhezonenpfade beachten zusätzliche Grenzen; eine Bereichsänderung verwirft alte Ausweichwege.

Dies ist die Zielabbildung der bestehenden Raumvorschau, keine Änderung der physischen Pan-/Tilt-Grenzen oder der Hardware-Montagekalibrierung. Die musikalischen Cue-/Geschwindigkeitsgrenzen bleiben erhalten. 202 DMX-/VR-Tests bestanden, anschließend sieben Zonenspezialtests nach der Weg-Invalidierung. Browsercheck prüft weiterhin feste Spots und zusätzlich ausgeblendete Mover-Rotation, Bereichseingabe, fehlenden festen Zielgriff und Persistenz nach Neuladen.


## Korrektur: Bewegungen kleben am Raumrand

Die eigene Raumvorschau lieferte bisher Bühnenziele zusammen mit den abweichenden Zielraummaßen an die Raumabbildung. Zusätzlich konnte die Zuschauer-Ausrichtung negative Tiefenwerte liefern. Die anschließende Normalisierung schnitt diese Werte am Rand ab. Der aktive Raumplan erhält jetzt die ursprünglichen Bühnenkoordinaten ohne Zuschauer-Umleitung. Moving Heads transportieren zusätzlich normalisierte `motionUV`-Pfade, die direkt in den gewählten Raum-/Gerätebereich abgebildet werden. Die gekoppelte VR-Vorschau interpoliert diese Pfade im Netzwerkpuffer mit; die Raumanzeige verwendet die Maße des Raumplans.

Regression: 41 aufeinanderfolgende Ziele einer 24 × 18 m Bühne werden ohne Randplateau in einen Bereich eines 4 × 4 m Raums übertragen, auch bei bereits umgeleiteten Vorschaukoordinaten. 204 DMX-/VR-Tests bestanden. Raum-/AR-Browsercheck und gekoppelte VR-Vorschau einschließlich Verbindung, Raumbearbeitung und Fernsteuerung bestanden. Keine Prüfung mit realer VR-Brille.


## Räumliche Verlagerung statt dauerhafter Mittellinie

Sweep/Pulse hatten bewusst feste Tiefen, Cross eine an Pan gekoppelte Tiefe; die inneren Köpfe blieben zusätzlich zentriert. Die automatische Choreografie verschiebt nun ihre lokalen Gesten über acht musikalische Beats zwischen räumlichen Arbeitsbereichen. Versetzte Rollen führen jeden Kopf auch nach vorne, hinten und seitlich. Eine glatte Quintik verbindet die Bereiche; begrenzte Mischungen vermeiden Rand-Clipping. Die Verlagerung wird vor der bestehenden Erreichbarkeits-/Geschwindigkeitsprüfung in die akustischen Cues eingerechnet, läuft also nicht unabhängig durch musikalische Pausen. Manuelle Modi bleiben unverändert. Planversion 10.

Regression prüft für jeden der vier Köpfe in einer synthetischen rhythmischen Passage die Tiefenausdehnung, beide Seiten und eine zweidimensionale Flächenverteilung statt einer Linie. Bestehende Geschwindigkeits-, Pausen-, Seeking- und Ruhezonenprüfungen bestehen. Insgesamt 205 DMX-/VR-Tests und Moving-Heads-Browsercheck bestanden; Fünf-Minuten-Testplan im Browser in 197 ms vorbereitet. Die gestalterische Wirkung im konkreten Nutzersong und in einer echten VR-Brille wurde nicht geprüft.

## Wandziele in der Raumchoreografie

Im Raum-Gerätemanager kann jeder Moving Head unter „Erlaubter Bewegungsbereich → Wand in die Choreografie einbeziehen“ zusätzlich eine Wand wählen. Start/Ende in Prozent und minimale/maximale Höhe in Metern begrenzen den Wandbereich. Wandnummern und der ausgewählte Abschnitt erscheinen im Grundriss. „Nur Boden“ bleibt die Voreinstellung. Ein neu gezeichneter Grundriss entfernt die bisherigen Wandzuordnungen und fordert zur Neuzuordnung auf.

Die musikalische normalisierte Tiefe steuert die Verlagerung vom gerouteten Bodenweg zur Wand. Die Richtung wird kontinuierlich überblendet; ein analytischer Strahltest liefert den ersten Treffer auf Boden oder Grundrisswand, einschließlich konkaver Räume. Unterhalb der erlaubten Wandhöhe wird ausgeblendet; nicht freigegebene Wände und projizierte Ruhezonen werden dunkel durchfahren. Die Bodenbereichsgrenzen bleiben für beleuchtete Bodentreffer gültig. Die Raumvorschau nutzt echte Zielhöhe, Kopfausrichtung, einen zur Wand orientierten und am erlaubten Wandbereich abgeschnittenen Lichtfleck sowie vereinfachtes reflektiertes Licht. Desktop und VR verwenden dieselbe Geometrie. Wandparameter werden validiert, gespeichert und zur gekoppelten Vorschau übertragen. Höhenwerte werden im Netzwerkpuffer interpoliert.

Dies erweitert die Raum-/VR-Vorschau; physische Geräteansteuerung und Montagekalibrierung sind damit noch nicht auf Wandziele umgestellt. Bei erfassten Raumoberflächen dient weiterhin der extrudierte Grundriss als Zielgeometrie, kein detailliertes Mesh-Raytracing. Flächenlicht bleibt eine Näherung ohne echte Schatten.

210 DMX-/VR-Tests bestanden: Parameterprüfung, stetiger Boden-/Wandübergang, konkave Verdeckung, Ruhezonen, vertikale begrenzte Lichtflecken und Zielhöheninterpolation. Raum-Browsercheck bestätigt Bearbeitung, Neuladen und Headset-Rückübertragung der Wandparameter. Bestehender WebGL-Stereotest bestanden, ohne GL-Fehler oder wiederholte Pufferallokation. Mikrobenchmark der zusätzlichen Zielgeometrie: 32 Moving Heads, rechteckiger Raum, 10.000 Durchläufe nach Warmup, ca. 0,003 ms pro Frame in Node; dies ist keine Messung der gesamten Darstellung oder einer echten VR-Brille.

## Musikalische Balance der Gruppen (Planversion 11)

Die vorherige räumliche Verlagerung gab jedem Kopf dauerhaft einen eigenen Phasenversatz. Jetzt mischt die Choreografie zusammengehörige Spiegelpaare mit diesen freien Rollen. Das Mischungsverhältnis stammt aus der musikalischen Phrase: ruhig, gesangsgeführt und Aufbau bleiben stärker zusammen; tonale Kreuzbewegungen und perkussive Höhepunkte erhalten mehr Unabhängigkeit. Markante akustische Akzente können diese kurz erhöhen. Wiederkehrende Motive erinnern auch ihre Gruppenbalance. Es gibt weder eine erzwungene Dauersymmetrie noch dauerhaft unabhängige Köpfe. Der Disco-Modus gewichtet Freiheit etwas stärker, folgt aber derselben musikalischen Auswahl.

Die linken Gesten werden für den zusammengehörigen Anteil gespiegelt, nicht gegensinnige Ziele gemittelt: So bleibt die räumliche Ausdehnung erhalten. Die Mischung erfolgt vor der bestehenden Erreichbarkeits-/Geschwindigkeitsprüfung. Flächenabdeckung, Pausen, Seeking und Ruhezonen bleiben geprüft. Regression vergleicht ruhige, gesangsgeführte, Aufbau- und Peak-Phrasen sowie Motivwiederholung und die Zwischenstufen zwischen gepaarten und unabhängigen Rollen.

## Sektionsführung mit laufender Entwicklung (Planversion 12)

Der Bewegungscharakter wird einmal je Sektion aus deren Instrumentaktivität, Intensität und zeitlich gewichteten Phrasenmerkmalen berechnet und wiederverwendet. Form, Gruppenbalance und Grundtempo bleiben innerhalb dieser Sektion zusammenhängend. Kurze Phrasenwechsel setzen die räumliche Figur nicht zurück; Einzelakzente ändern nicht mehr das Verhältnis zwischen gepaarten und freien Rollen. Gemessene Sektionsintensität bestimmt weiterhin das Groove-Tempo.

Außerhalb kräftiger Grooves gibt es bei vorhandener musikalischer Aktivität langsame Folgeziele aus den bestehenden Analyseereignissen: etwa alle vier Sekunden in ruhigen und zwei Sekunden in sonstigen Passagen. Diese entwickeln Wege und Tiefe weiter, statt bis zum nächsten starken Akzent stillzustehen. Die Zeitabstände sind Mindestabstände, keine zusätzlichen erfundenen Audioereignisse. Bewusste Held-/Break-Abschnitte und inaktive Passagen behalten ihre Haltefunktion. Übergänge nutzen weiterhin die begrenzte Erreichbarkeit und weiche Interpolation; ruhige Folgebewegungen greifen nicht vor den Beginn ihrer Sektion zurück. Die besonders zurückhaltenden manuellen Stimmungen behalten ihr bisheriges Verhalten.

212 DMX-/VR-Tests bestanden, darunter ein mehrphasiges Beispiel mit ruhiger und wilder Sektion: gleicher Charakter innerhalb jeder Sektion, stärkere Freiheit und Geschwindigkeit im Peak und fortlaufende Bewegung in der ruhigen Passage. Bestehende Prüfungen für Flächenabdeckung, Motorgrenzen, Pausen, Seeking und Ruhezonen bestehen.

## Flüssige Folgebewegungen (Planversion 13)

Die neuen Sektions-Folgeziele wurden bisher mit der Interpolation für isolierte Gesten abgespielt. Diese setzt Geschwindigkeit und Beschleunigung an jedem Ziel auf null; zusätzlich konnten verkürzte Reisezeiten kurze Haltephasen erzeugen. Folgebewegungen erhalten jetzt eine explizite Kontinuitätsmarkierung und nutzen das verfügbare Intervall vollständig. Die bereits vorhandene Quintik verbindet benachbarte Wege mit gemeinsamer End-/Anfangsgeschwindigkeit, auch beim Übergang in einen Groove. Vorzeichenwechsel der Bewegungsrichtung, tatsächliche Lücken und isolierte Gesten behalten ihre Brems-/Haltefunktion. Nur außergewöhnliche akustische Akzente dürfen eine Folgebewegung gezielt stärker abbremsen.

213 DMX-/VR-Tests bestanden. Neue Regressionen prüfen positive, stetige Geschwindigkeit an Zwischenzielen einschließlich Übergang zum Groove, vollständige Reiseintervalle in ruhigen Sektionen und unveränderte echte Pausen. Bestehende Motorgrenzen und Ruhezonenprüfungen bestehen. Diese Korrektur betrifft das sichtbare Stop-and-go der Choreografie; eine Messung eventueller zusätzlicher Frame-Aussetzer auf dem Gerät des Nutzers liegt nicht vor.

## Zusammenhängende Kurven statt wiederholter Anfahrzyklen (Planversion 14)

Die bisherigen Korrekturen erhielten zwar Geschwindigkeit an Zwischenzielen, setzten aber die Beschleunigung an jedem Ziel auf null. Auch die räumlichen Anker waren jeweils separate Ease-in/out-Strecken, und ruhige Folgen wurden mit wenigen groben Zielen beschrieben. Dadurch blieb ein regelmäßiges Anfahren/Abbremsen sichtbar.

Fortlaufende Cue-Kurven teilen jetzt sowohl Geschwindigkeit als auch Beschleunigung; ein harmonisches Mittel der benachbarten Reisegeschwindigkeiten vermeidet das pauschale Absenken auf die jeweils langsamere Strecke. Richtungswechsel und isolierte Gesten behalten kontrollierte Bremsvorgänge. Räumliche Anker werden als periodische kubische B-Spline durchfahren. Die langsamen Folgewege verwenden kontinuierliche Gesten statt quantisierter Vier-Schritt-Posen, mit dichterer Abtastung vorhandener Analyseereignisse. Eine versetzte Tiefenvariation und unterschiedliche, aber verwandte Wege der rechten/linken Partner erweitern die Rollen innerhalb des Sektionscharakters. Die Gewichtung der lokalen Geste wurde erhöht, damit der geglättete Raumpfad die Flächenabdeckung nicht verkleinert.

215 Tests bestanden, einschließlich stetiger nichtverschwindender Beschleunigung über gewöhnliche Zwischenziele, durchfahrener räumlicher Anker, Flächenabdeckung und bisheriger Motor-/Ruhezonenprüfungen. Im synthetischen 96-s-Vergleich sank der Anteil sehr langsamer Bewegung (<1,5 % normierte Fläche/s, vier Köpfe, ausgewertet 8–88 s) in der ruhigen Sektion von ca. 11–12 % auf 2,5–6,7 %. Im Peak vorher 0,5–10,4 %, danach 1,3–5 %. Diese Messung ersetzt keine subjektive Prüfung im konkreten Nutzersong.

## Musikalische Artikulation innerhalb der Sektion (Planversion 15)

Langsamere Folgebewegungen verwendeten bisher eine feste Stärke von 0,6 und nur die mittlere Sektionsenergie. Sie nutzen jetzt tatsächliche Akzentstärke und aktuelle Intensität. Ein nachgewiesener kräftiger Rhythmus darf auch außerhalb als Peak markierter Sektionen einen Groove tragen. Hervorgehobene akustische Ereignisse erhalten einen kürzeren Mindestabstand, damit die gewöhnliche Cue-Ausdünnung sie nicht verschluckt.

Die Sektionsfigur und ihre Gruppenbalance bleiben bestehen. Innerhalb dieser Figur beeinflussen aktuelle Stärke, Energie relativ zum Sektionsmittel und hervorgehobene Ereignisse die Bewegungsweite und Tiefe der Gerätepaare. Diese Artikulation wird vor Erreichbarkeits- und Motorbegrenzung geplant, nicht als ungeglätteter nachträglicher Impuls. Kontinuierliche Wege, Ruhe-/Haltephasen und Ruhezonen bleiben erhalten.

219 DMX-/VR-Tests und Moving-Heads-Browsercheck bestanden. Neue Vergleiche prüfen klare Rhythmen außerhalb von Peaks, verschiedene Akzentstärken bei identischer ruhiger Sektionsfigur, lokale Intensitätsverläufe bei gleicher Sektionsenergie sowie die Erhaltung hervorgehobener Ereigniszeitpunkte. Ein konkreter Nutzersong samt Zeitstelle wurde zur zusätzlichen subjektiven Prüfung erfragt; diese Prüfung steht noch aus.

## Musikalische Rollen statt eigenständiger Raumfahrt (Planversion 16)

Bei der Gerätezuordnung wurden zwischen vier Rollen interpolierte Posen verwendet. Gegenläufige Rollen konnten sich dabei zur Mitte aufheben; die Lichtgruppe „Hintergrund“ erhielt immer denselben Mittelwert. Geräte erhalten nun vollständige Rollen. Links/Rechts behalten ihre Paarzuordnung, Hintergrund verteilt die Rollen; zusätzliche Geräte erhalten abgestufte Reichweite/Tiefe. Das betrifft die Vorschau, nicht eine DMX-Kanaländerung.

Die zusätzlich zur Musik laufende B-Spline-Raumfahrt wurde entfernt. Räumliche Gestaltung leitet sich nun ausschließlich aus der musikalischen Pose ab: breitere seitliche Bögen und anders geformte Tiefenfahrten je Rolle, mit weicher Begrenzung und weiterhin sektionsabhängiger Paar-/Freiheitsmischung. Ein identischer musikalischer Eingang erzeugt unabhängig vom Taktzähler exakt denselben Zielpunkt. Damit entsteht keine Suchbewegung allein durch das Fortschreiten eines zweiten Bewegungszyklus. Geschwindigkeit, Beschleunigung, aktuelle musikalische Artikulation und Ruhezonen bleiben Teil der bisherigen Verarbeitung.

220 Tests und Moving-Heads-Browserprüfung bestanden. Neue Regressionen prüfen unveränderte Ziele bei unveränderter musikalischer Pose und die unverfälschte Rollenverteilung für 1/3/5/8 Hintergrundgeräte. Die bisherige Forderung einer eigenen zweidimensionalen Flächenfüllung pro Kopf wurde auf ausreichende Seiten-/Tiefenbewegung umgestellt: Ein musikalisch gewollter, gebogener oder diagonaler Weg soll nicht durch eine zusätzliche unabhängige Fahrt künstlich Fläche füllen müssen. Die Wirkung auf die konkrete Nutzermusik bleibt subjektiv zu prüfen.

## Zwischenbilder der lokalen 3D-/VR-Vorschau

Zusätzlich zur Weginterpolation bestand eine Darstellungsgrenze: `dmx-stage.js` liefert alle 50 ms neue Positionen; die lokale 3D-Vorschau zeichnete weitgehend nur auf diese Updates hin. Ein lokaler Bewegungsbuffer interpoliert jetzt Zielkoordinaten und normalisierte Raumziele mit 60 ms Vorlaufpuffer. Während sich die Ziele verändern, fordert die Vorschau Zwischenbilder über requestAnimationFrame an. Die tatsächliche Bildrate hängt weiterhin vom Renderer/Gerät ab. Die lokale immersive VR-Vorschau liest dieselben interpolierten Positionen. Zur gekoppelten Brille werden weiterhin ungepufferte Quellen übertragen, weil dort bereits ein Netzwerkpuffer vorhanden ist.

Nur Bewegungskoordinaten werden verzögert: Farbe, Lichtstärke, Blackout und entfernte Geräte übernehmen den neuesten Stand unmittelbar. Der Buffer extrapoliert keine unbekannten Wege und beendet zusätzliche Zeichenanforderungen nach dem Auslaufen einer Bewegung. Musikalische Cue-Berechnung und bestehende Raum-/Ruhezonenabbildung bleiben unverändert.

221 Tests bestanden. Regression prüft Zwischenpositionen zwischen 20-Hz-Updates, normalisierte Ziele, sofortigen Blackout, sofortige Geräteentfernung sowie Stillstand ohne Dauer-Rendering oder Extrapolation. 3D-Browserprüfung, WebGL-Stereoprüfung und gekoppelte Vorschau einschließlich Fernsteuerung bestanden. Keine Messung mit der realen Brille des Nutzers.
