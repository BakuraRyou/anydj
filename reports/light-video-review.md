# Lichtgestaltung und Videovergleich

Die automatische Farbregie hält eine Palette mindestens vier Sekunden. Kurze
musikalische Akzente verwenden weiterhin die vorhandenen Dimmer- und
Geräteaktivitätskurven, lösen aber keinen globalen Farbwechsel mit Rücksprung aus.
Neue Klangabschnitte und wiederkehrende Motive bestimmen die Palette.
Übergänge mischen die RGB-Endpunkte, statt weitere Farbfamilien auf einem
Farbkreis zu durchlaufen. Bei Komplementärfarben kann die Mischung entsättigen.

Die normale automatische Wiedergabe verteilt einen gemeinsamen Fächer über
alle Moving Heads in ihrer räumlichen Reihenfolge. Alle Köpfe teilen dieselbe
Höhenbewegung; zusätzliche Köpfe beginnen keine neue Vierergruppe. Auch bei
rhythmischen Passagen wechseln Innen- und Außenköpfe nicht mehr unabhängig
ihre Rollen. Die Raumabbildung hält dabei die Blickrichtung stabil, wenn die
musikalische Tiefenkoordinate die Montageposition überschreitet. Fächer öffnen sich im Aufbau, die vorhandenen Energieverläufe
bestimmen Reichweite und Tempo. Ruhige Bewegungen, gezielte Stillstände und
musikalisch begründete Geräte-Rücknahmen bleiben erhalten. Disco behält seine
unabhängigeren Formationen; die Raum- und Motorgrenzen gelten weiterhin.
Show-Version 27 verwirft veraltete Show-Caches bei der nächsten Vorbereitung.

## Vergleich mit einer Aufnahme

1. Song vorbereiten und Lichteditor öffnen.
2. Unter „Lichtshow mit einem Video auswerten“ auf „Analyse exportieren“ klicken.
3. Aufnahme und JSON gemeinsam aufbewahren. Die Songsekunde am Videoanfang
   und eventuelle Sprünge/Tempoänderungen notieren. Videozeit ist nicht automatisch
   Songzeit; der Export hält die aktuelle Editorposition als Referenz fest.
4. Auffällige Stellen mit Videozeit, Songzeit und Beobachtung markieren.
5. Nach einer Regeländerung dieselben Stellen mit identischen Bühnen-, Raum-,
   Kamera- und Wiedergabeeinstellungen vergleichen. Zusätzlich ruhige, rhythmische,
   vokalbetonte und wechselhafte Songs verwenden.

Der Export enthält den wirksamen Showplan einschließlich noch nicht gespeicherter
Editoränderungen, Farbentscheidungen, automatische/ausgewogene Bewegungsziele und
Gründe für Bewegungscues. Er enthält weder Audiodatei noch Video. Bewegungscues
sind die Referenz vor Raumumleitung und Gerätekalibrierung. Bühnen-Overrides,
Deck-Mix, Kamerabelichtung und die tatsächliche physische Ausgabe werden nicht
aufgezeichnet und müssen für den Vergleich separat festgehalten werden.

Es gibt kein automatisches Training anhand des Videos. Die Daten machen die
Bewertung nachvollziehbar und erlauben gezielte Änderungen mit Regressionstests.

## Boden, Wand und Decke

Moving Lights ohne expliziten Zielbereich nutzen in der gemeinsamen 3D-/VR-
Raumvorschau Boden, Wände und Decke. Die Lichtflecken werden auf der jeweiligen
Fläche dargestellt. Explizite Wand- oder Bodenbereiche behalten ihre begrenzte
Führung. Auch „auf die Tanzfläche richten“ bleibt eine ausdrückliche
Vorschauoption; die räumlichen Ruhezonen gelten dabei weiterhin.

Das ist eine räumliche Vorschauabbildung, keine neue Geräte-DMX-Kalibrierung.
Der Analyseexport enthält die vorbereiteten Bewegungskoordinaten vor dieser
Raumabbildung. Für exakte Videovergleiche daher den Raumplan mit aufbewahren.


## Räumliche Höhenbewegung und Ruhezonen

Die automatische Höhenbewegung führt jetzt kontinuierlich über Boden, Wand und
Decke sowie zurück. Die Höhe folgt der vorbereiteten musikalischen Bewegung,
nicht einer zusätzlichen Zeituhr. Eine vorhandene Ruhezone fixiert die Köpfe
nicht mehr auf die Decke. Stattdessen wird ein freier Korridor zu einer Wand
gewählt; falls keiner existiert, bleibt das geroutete Bodenziel erhalten.

Bestehende Ruhezonen ohne Höhenangaben sperren die gesamte Säule vom Boden bis
zur Decke. Sowohl Lichtfleck als auch Strahlweg inklusive Breite werden geprüft.
Ein Ziel oberhalb einer Zone ist damit ebenfalls gesperrt. Liegt das Gerät selbst
in einer solchen Zone, bleibt sein Licht aus. Explizite Wand-/Bodenbereiche
bleiben erhalten, unterliegen aber ebenfalls der räumlichen Sperre.


## Besetzung der Moving Heads

Die automatische Vorschau verwendet eine energieabhängige Teilbesetzung.
Bei sieben Köpfen nutzen mittlere Passagen vier Geräte; starke Passagen können
alle sieben einsetzen, auch ohne ausdrückliches Peak-Label. Die aktiven
Spiegelpaare und der mittlere Kopf wechseln an analysierten Phrasengrenzen
(ersatzweise Abschnittsgrenzen), damit keine Geräte dauerhaft ungenutzt bleiben. Ruhige Abschnitte (held/quiet/break/outro) blenden die
Moving Heads vollständig aus. Kräftige Peak-Abschnitte mit hoher analysierter
Energie öffnen die gesamte Formation; vokalbetonte Passagen bleiben sparsam.
Die Auswahl bleibt innerhalb einer Phrase stabil und blendet am
Phrasenwechsel über bis zu 1,2 Sekunden über. Gemessene Pausen und Blackouts haben
weiterhin Vorrang. Die Grundbeleuchtung wird davon nicht abgeschaltet.

Die Besetzung gilt auch bei übernommenen Scheinwerferfarben und wird nach dem
Erweitern auf virtuelle Raumgeräte erneut nach räumlicher Reihenfolge verteilt.
So werden aus einem aktiven Paar nicht mehrere wiederholte Vierergruppen.
Manuelle Showmodi behalten ihre eigene Besetzung. Diese Vorschau-Regel ist
keine Änderung der physischen DMX-Ausgabe und kein Lernen aus einer Aufnahme.

## Aufnahme vom 25.09.2026, 22:40

Die 16,7 Sekunden lange Aufnahme `__mock/anydj_preview_problem-2026-09-25_22.40.mp4`
zeigt vier kräftige stehende Lichtflecken und wesentlich schwächere bewegte
Strahlen. Einzelbilder wurden bei 0/4/8/12 Sekunden und bei 7 Sekunden geprüft.
Die genaue Zahl eingeschalteter Moving Heads lässt sich daraus nicht sicher
ablesen. Die bisherige Motorsteuerung folgte den Zielen auch bei Leistung null.

Ausgeschaltete Köpfe halten jetzt ihre letzte dargestellte Position; beim
Wiedereinschalten beginnt die begrenzte Bewegung dort. Ausdrücklich autorisierte
Dunkelfahrten durch Ruhezonen bleiben möglich. Die Besetzung wählt ganze Gruppen
mit erkennbarer Helligkeit statt schwach eingeblendeter zusätzlicher Gruppen.
Bei sieben Geräten starten normale aktive Passagen mit zwei Spiegelpaaren;
eine Gruppe mit dem Mittelkopf umfasst entsprechend drei statt vier Geräte.
Die Gruppenwechsel, Abschnittsüberblendungen und vollständigen Pausen bleiben.
Der Browsercheck prüft nun auch die Helligkeit der ausgewählten Köpfe. Die
Originalaufnahme ist keine Aufnahme des korrigierten Verhaltens.

## Aufnahme vom 25.09.2026, 22:46

Die neue Aufnahme enthält 2,67 Sekunden Bild und Ton. Acht Einzelbilder im
Abstand von ungefähr einer Drittelsekunde zeigen breite Bewegungen von den
Bodenseiten über die Seitenwände und zurück, bei weitgehend stabiler
Grundbeleuchtung. Die Tonspur wurde technisch auf ihren Pegelverlauf geprüft;
daraus wurde weder ein Beat-Raster noch eine Aussage über korrekt getroffene
Musikakzente abgeleitet. Die exakte Songposition und der wirksame Showplan fehlen.

Die koordinierte automatische Raumabbildung verwendet jetzt unmittelbar
zusammengehörige Winkel (Pan ±30°, Neigung −35° bis +20°). Sie wandelt kleine
Musikbewegungen nicht zusätzlich in eine Fahrt entlang der Raumhülle um.
Die tatsächliche Auftrefffläche ergibt sich aus dem Strahlschnitt. Explizite
Bewegungsbereiche und die gesonderte Ruhezonenführung bleiben bestehen.
Aktuelle und vorausberechnete Ziele durchlaufen dieselbe Abbildung.

Ein Browservergleich mit sieben Köpfen und drei identischen Eingabeposen
(`scripts/check-coordinated-room.mjs`) zeigt die alte Raumabbildung neben der
neuen Winkelabbildung. Er ist eine synthetische Geometrieprüfung, keine
Rekonstruktion der Aufnahme oder musikalische Abnahme. Die Prüfung des
Originalsongs bleibt von seiner konkreten Songposition und Analyse abhängig.

## Aufnahme vom 25.09.2026, 22:54

Die Aufnahme umfasst 34,43 Sekunden. Die Bildfolge wurde im Abstand von drei
Sekunden geprüft. Sie zeigt über weite Strecken gleitende Moving-Head-Wechsel
über einer stabileren Grundbeleuchtung. Die Hüllkurve der Tonspur enthält
starke Wiederholungen um 0,49–0,51 Sekunden. Diese Messung ist kein verifiziertes
Beat-Raster und kein Hörurteil über einzelne musikalische Akzente.

Die bisherige ausgewogene Bewegung konnte auf vielen gewöhnlichen Akzenten
neue Ziele erzeugen und diese zusätzlich durch periodische räumliche Figuren
verformen. Bei vorhandenem erkanntem Downbeat-Raster verwendet die normale
Automatik jetzt eine klare Öffnen–Halten–Schließen-Figur. Ankünfte liegen alle
zwei Takte auf erkannten Taktanfängen, bei zurückhaltender Führung alle vier
Takte. Die Fahrt belegt höchstens 60 Prozent des Intervalls und maximal 1,6
Sekunden. Dazwischen wird gehalten. Aufbauten öffnen schrittweise; ruhige
Abschnitte erhalten keine neue Bewegung. Abschnittsenergie bestimmt die
Weite, gewöhnliche Zwischenakzente bleiben Aufgabe der Helligkeitssteuerung.

Cue-Erzeugung, vorbereitete Wiedergabe und Analyseexport verwenden denselben
Plan. Die Bewegungsversion ist 19. Disco und Pläne ohne ausreichende erkannte
Taktanfänge verwenden weiterhin ihren bisherigen Bewegungspfad. Die Prüfung
umfasst Rasterbindung, echte Haltephasen, Tempoänderungen, unveränderte Ziele
bei zusätzlichen gewöhnlichen Akzenten sowie den Browser-Vorschaupfad. Ein
Abgleich gegen die tatsächlichen analysierten Taktanfänge des aufgenommenen
Songs steht weiterhin aus; die Aufnahme enthält diesen Showplan nicht.

## Entwicklung statt Zweipunkt-Schleife

Die Rückmeldung zur Bewegungsversion 19 zeigte eine Überkorrektur: Der feste
Wechsel zwischen zwei Öffnungsweiten ließ einen ganzen Song gleich aussehen.
Zusätzlich entfernte `movingDevicePoses` den gemeinsamen Pan-Anteil, wodurch
auch seitwärts gerichtete Motive wieder um die Mitte lagen.

Version 20 behält die musikalischen Taktankünfte und Haltephasen bei, entwickelt
aber die vorhandene analysierte Figur über die aktuelle Phrase. Aufbauten
öffnen den Fächer und heben ihn an; Bögen verbinden seitliche Bewegung mit Höhe;
Schwenks wandern gemeinsam seitwärts; vokalbetonte Figuren bleiben enger.
Rhythmische Figuren entwickeln Weite und Höhe mit der vorhandenen Energie.
Der aktive Phrasenabschnitt wird jeweils neu ausgewertet. Es gibt keinen
festen Zweipunktwechsel mehr. Gemeinsamer Pan und gemeinsame Höhe bleiben bei
der Verteilung auf zusätzliche Geräte erhalten. Die Besetzungssteuerung wurde
bei dieser Korrektur nicht erneut geändert.

Regressionen prüfen mindestens fünf verschiedene Zielpositionen und mehrere
Höhen innerhalb einer längeren Phrase, unterschiedliche Motive bei Aufbauten
und Vokalpassagen sowie den Erhalt einer gemeinsamen Seitenrichtung über
sieben Geräte. Das ist weiterhin keine musikalische Abnahme des Originalsongs.

## Groove, Ereignisse und Raumgestaltung gemeinsam

Bewegungsversion 21 verbindet die drei vom Nutzer gewünschten Ebenen:
Grundbewegung auf erkannten Taktanfängen, besondere Ankünfte auf gemessenen
auffälligen Ereignissen und die Entwicklung einer räumlichen Figur über die
Phrase. Starker analysierter rhythmischer Antrieb verdichtet die Grundbewegung
auf einen Takt; zurückhaltende und vokalbetonte Passagen behalten mehr Raum.

Die Ereignisauswahl nutzt die bereits vorhandenen tatsächlichen Zeitpunkte und
`eventSalience`. Ein Ereignis muss deutlich über dem lokalen Median liegen;
Auswahlzahl und Mindestabstände verhindern eine Fahrt auf jedem Schlag.
Gemessene `developments` behalten ihre eigenen Zeitpunkte und Fortschritte.
Nahe reguläre Takt-Cues weichen diesen besonderen Ankünften. Klar erkannter
Instrumentenfokus (mit Mindestkonfidenz) beeinflusst Figur und Höhe; unbekannte
oder gemischte Instrumente erzeugen keine erfundene Zuordnung. Ruhige Abschnitte
bleiben von diesen zusätzlichen Bewegungscues ausgenommen.

Tests unterscheiden zwei Pläne mit identischem Tempo und identischen Abschnitten
anhand verschobener markanter Ereignisse. Weitere Prüfungen sichern den
Unterschied zwischen gewöhnlichen Schlagfolgen und Ausnahmereignissen,
Groove-Dichte, Vokal-/Bass-Fokus und gemessenen Aufbauzeitpunkten ab. Der reale
Browser-Vorschaupfad wird weiter geprüft. Diese Fälle bestätigen die wirksame
Datenanbindung, nicht die subjektive Qualität jedes fertig analysierten Songs.

## Sichtbare Bewegung und dunkle Umpositionierung

Bewegungsversion 22 markiert große vorbereitete Positionswechsel (>18 Grad
Pan bzw. vergleichbare Tilt-Distanz) sowie deutliche Wechsel (>8 Grad) zwischen
Abschnitten oder Motiven als dunkle Umpositionierung. Der Shutter blendet in
180 ms vor Fahrtbeginn aus, bleibt während der Fahrt geschlossen und öffnet
über 300 ms ab der geplanten Ankunft. Kleinere expressive Fahrten bleiben
beleuchtet. Die Helligkeitsbesetzung selbst bleibt davon unabhängig.

`cueTransit` erlaubt ausschließlich diese geplante Dunkelfahrt im Raummotor;
gewöhnlich ausgesetzte Köpfe halten weiterhin ihre Position. Die Verteilung auf
zusätzliche Raumgeräte wendet den Shutter nach der Besetzung an und kann eine
dunkle Fahrt daher nicht wieder einschalten. Bestehende Ruhezonenprüfungen
bleiben nach der Motorbewegung wirksam. Die Entscheidung basiert auf dem
vorbereiteten Zielwechsel; sie ersetzt keine individuelle Geräte-DMX-Kalibrierung.


## Gemeinsame Lichtbilder (Moving-Plan Version 23)

Die automatische, ausgewogene Show entscheidet jetzt zuerst über ein gemeinsames
Lichtbild. `dmx-light-scenes.js` wertet Energieverlauf, rhythmischen Antrieb,
Gesangsanteil, flächigen Charakter und Abschnittskontrast aus. Geometrie und
Gerätebelegung verwenden dieselbe Entscheidung: reduziertes Standbild,
antwortende Groove-Gruppen, sich öffnender Aufbau, breiter gehaltener Einsatz,
gemeinsame langsame Fahrt oder Dunkelheit. Wiederkehrende Motive behalten ihre
Orientierung. Andere Bewegungsmodi bleiben separat verfügbar.

Stehende Bilder erhalten keine regelmäßigen Fahrten. Neue Bilder werden mit
abgedunkeltem Positionswechsel etabliert; nur Aufbau und flächige Fahrt entwickeln
sich räumlich weiter. Die Raumprojektion erhält die entworfenen Winkel und Höhen,
statt jedes Bild erneut auf einen mittigen Fächer zu reduzieren. Abschnittsregler
für Bewegung und Rhythmus werden auch von der Szenenplanung berücksichtigt.

Prüfung: synthetische musikalische Verläufe bei drei Tempi, gleiche Abschnittslabels
mit unterschiedlichen Messwerten, Motivwiederkehr, sieben physische Köpfe und
Raumprojektion. Browservergleich über `scripts/check-light-scenes.mjs` mit gleicher
Farbe und Kamera für alle sechs Bilder. Das ist keine qualitative Abnahme anhand
der Originalsongs aus den Videos; deren musikalische Passung bleibt am echten
Material zu beurteilen.

## Songweite Variantenauswahl (Moving-Plan Version 24)

25 Geometrien verteilen sich auf fünf beleuchtete Familien, zusätzlich bleibt
Dunkelheit ein eigenständiger Zustand. Die Auswahl bewertet Energie, Antrieb,
Gesangsanteil, flächigen Charakter und spektrale Lage. Eine Historie je Song
gewichtet bereits verwendete Varianten ab und vermeidet unmittelbare Wiederholung.
Explizit wiederkehrende Motive behalten dagegen ihre Variante und Orientierung;
ihre räumliche Weite folgt der relativen Abschnittsenergie. Die breite Krone
bleibt den stärksten Einsätzen des Songs vorbehalten. Ohne Analysedaten wird ein
stabiles, zurückhaltendes Bild verwendet.

Rhythmische Varianten antworten in gespiegelten Gruppen oder betonen gemeinsam
die erkannten Taktanfänge. Flächige Aufbauten können von außen, andere von innen
aufgefüllt werden. Geräteanzahlabhängige Masken werden erst nach der Abbildung auf
die tatsächliche Installation ausgewertet. Die bisherigen Begrenzungen sichtbarer
Fahrten, manuellen Abschnittsregler und dunklen Positionswechsel bleiben bestehen.

Validierung: drei unabhängige synthetische Musikprofile, Reproduzierbarkeit,
Motivwiederkehr, Reservierung des größten Bildes, alle 25 Geometrien mit zwei,
sieben und zwanzig Köpfen sowie bestehende DMX-/Raum-/Abschnittstests. Browserchecks
prüfen Raumprojektion, Stillstand, Belegung, Blackout und manuelle Betriebsarten.
Echte Songs wurden für diese Änderung nicht neu analysiert oder qualitativ
abgenommen; eine breite Songauswertung bleibt für die weitere Abstimmung sinnvoll.

## Unpassend lange Ruhephasen (Moving-Plan Version 25)

Rückmeldung: Bei „eurodap“ wirkte nahezu der ganze Titel zu ruhig. Die konkrete
Audiodatei und ihr Showplan lagen für diese Prüfung nicht lokal vor.

Die bisherige Szenensteuerung hielt Groove- und Höhepunktbilder über ganze
Strukturabschnitte fest. Außerdem konnte niedrige relative Energie ohne
nachgewiesene Musikpause eine vollständig dunkle Szene auslösen. Die Planung
berücksichtigt jetzt analysierte Phrasen und Grenzen gemessener Rückzüge.
Rhythmischer Antrieb hat Vorrang vor ruhigen Abschnittslabels und hohem
Gesangsanteil. Groove und Höhepunkt entwickeln ihre Formation an erkannten
Taktanfängen mit kurzen Fahrten und Haltemomenten weiter. Gewöhnliche
rhythmische Bildwechsel bleiben beleuchtet; größere ruhige Umpositionierungen,
echte Blackouts, Instrumentenrückzüge und manuell gesetzte Haltepunkte bleiben.

Validierung: 116 Regressionstests, darunter dreiminütige rhythmische Verläufe
bei drei Tempi und Rückkehr aus einer Pause innerhalb eines langen Abschnitts.
Ein Browsertest führt 90 Sekunden vorbereitete Choreografie durch die echten
Moving-Head- und Raummotormodule für sieben Geräte. Weitere Browserchecks
bestätigen sechs Lichtbilder, Gerätebelegung, Blackout und manuelle Modi.
Diese Tests bestätigen die korrigierte Steuerung, nicht die musikalische
Abnahme des konkret genannten Titels.

## Kurze musikalische Gesten (Moving-Plan Version 26)

Die Rückmeldung nach Version 25 beschreibt die Animationen weiterhin als zu
vorhersehbar, zu lang und zu wenig individuell. Die gemeinsame Sinusbewegung
für Groove und Höhepunkt wurde deshalb durch kurze räumliche Gesten ersetzt.
Die Auswahl berücksichtigt lokale Energie, Percussion, Gesangsanteil,
spektrale Lage, erkannten Instrumentenfokus und auffällige Originalzeitpunkte.
Eine kurze Historie gewichtet zuletzt verwendete Antworten ab.

Sieben Gesten kombinieren Gegenbewegungen, Falten, diagonale Figuren,
Höhenwechsel und fokussierte Gruppen. Führende und unterstützende Gruppen
beginnen ihre Fahrten zeitversetzt; die Ankunft bleibt am musikalischen
Ereignis. Typische Fahrten dauern 0,7 bis 1,05 Sekunden, markante Akzente
verkürzen sie. Der erreichbare Weg wird für jeden Kopf separat begrenzt, damit
Geschwindigkeit, Beschleunigung und Ruck innerhalb der Motorgrenzen bleiben.
Die Helligkeitsgewichtung folgt den gewählten Rollen und hält unterstützende
Bewegungen sichtbar. Explizite Abschnittsrhythmen behalten Vorrang.

Prüfung: unterschiedliche Instrumentenprofile bei gleichem Tempo und gleichen
Abschnitten erzeugen unterschiedliche Gestenfolgen. Tests sichern markante
Offbeat-Zeitpunkte, unabhängige Bewegungsstarts, sieben Geräte, Motorgrenzen,
Determinismus, Ruhezonen, manuelle Rhythmen und echte Musikpausen ab.
Browserprüfungen durchlaufen die reale Vorbereitung und Raumprojektion.
`scripts/check-light-gestures.mjs` rendert zusätzlich eine animierte Aufnahme;
mit `--before <Szenenmodul> <Cuemodul>` entsteht ein Vergleich zur alten Fassung.
Die aktuelle Vergleichsaufnahme verwendet einen ausdrücklich synthetischen
Musikverlauf, nicht den Originaltitel „eurodap“.

## 2026-09-26 — Basswechsel und Bewegungsraum

Die Nutzeraufnahme `__mock/anydj_preview_problem-2026-09-26_00.32.mp4` wurde als Bildfolge geprüft. Sie zeigt unterschiedliche räumliche Ausrichtungen und überwiegend gleichzeitig aktive Heads. Aus der Aufnahme allein lässt sich der gespeicherte Raumplan mit seinen Ruhezonen nicht rekonstruieren; eine gehörte oder vollständig nachgestellte Originalshow wird hier nicht behauptet.

Die automatische Präsenz hielt unterstützende Heads bislang bei 66 Prozent statt sie auszuschalten. Neu werden gemessene Bassanstiege verwendet: bevorzugt die vorhandene Bass-Spur, ansonsten die bei der Songanalyse gespeicherten Tieffrequenzanstiege. In intensiven rhythmischen Passagen wechseln diskrete gerade/ungerade Gerätegruppen mit kurzem zeitlichen Versatz. Die Zuordnung erfolgt nach Erweiterung auf die reale Gerätezahl; kein interpolierter Restpegel auf zusätzlichen Heads. Kein freilaufender Beat-Ersatz bei konstantem Bass, keine Änderung manueller Rhythmusvorgaben. Echte Blackouts haben weiterhin Vorrang. Einzelne Heads bleiben von Gruppenwechseln ausgenommen. Show-Cache-Version 28 nimmt neue Bassereignisse in die erneute Analyse auf.

Die automatische Winkelprojektion war auf ±30 Grad Pan und −35 bis +20 Grad Tilt begrenzt. Sie nutzt jetzt ±100 Grad Pan und −30 bis +70 Grad Tilt; Motorbegrenzungen bleiben aktiv. Eine vorhandene Ruhezone löst nicht mehr pauschal eine andere Raumprojektion aus: Ist der komplette gewünschte Lichtkegel frei, bleibt die Winkelprojektion bestehen. Bei blockierten Strahlen bleibt die vorhandene Umwegführung zuständig; finale Volumenprüfungen bleiben erhalten.

Validierung: 106 gezielte Tests bestanden (Bassdetektion einschließlich Offbeats, Speicherung durch compileShow, manuelle Rhythmuswahl, energischer Modus, Blackouts, reale/ungerade Gerätezahlen, Raumflächen, Motorphysik und Ruhezonen). `node scripts/check-light-gestures.mjs --bass` prüfte im echten Browser mit sieben Heads beide wechselseitigen Aus-Zustände und durchgehende Präsenz mindestens einer Gruppe. Synthetische Browseraufnahme: `/tmp/anydj-bass-chase.webm`. Eine Bildfolge daraus wurde visuell geprüft. Diese Aufnahme nutzt synthetische Musikmerkmale ohne Ton und ist keine musikalische Abnahme des Originaltitels.

## 2026-09-26 — Musikalischer Bezug der Bewegungen

Nach weiterer Rückmeldung Schwerpunkt auf Bewegungsbahnen verschoben. Die bisherige automatische Abwertung bereits verwendeter Gesten und die Rotation der Führungsgruppen wurden aus der rhythmischen Standardchoreografie entfernt. Unveränderte Instrumentführung behält ihre räumlichen Rollen. Verlässlich gemessene Melodiekonturen beeinflussen Pan/Tilt, stärker bei der führenden als bei der unterstützenden Gruppe. Längere, bestätigte Tonhöhensprünge erhalten eigene Ankunftszeiten, auch zwischen Taktschlägen. Akzente verändern Ausladung und Dauer; der gemessene Takt bestimmt das Bewegungstempo. Unsichere Melodiedaten werden ignoriert. Ohne verlässliche Tonhöhen bleibt eine einfache, taktabhängige Öffnungsbewegung statt einer wechselnden Figurenbibliothek. Motorbegrenzungen bleiben erhalten.

Bassgruppen orientieren sich jetzt an Phrasen/Takten, damit wiederkehrende Figuren dieselben Heads ansprechen. Schwache Verzierungen drehen die Gruppenfolge nicht um. Die gemessene Basshüllkurve begrenzt die Dauer eines Schaltwechsels. Moving-Plan-Version 27, Show-Cache-Version 29.

123 gezielte Tests bestanden. Frühere Tests, die ausdrücklich vier verschiedene Figuren oder rotierende Gruppen unabhängig von musikalischer Änderung verlangten, wurden durch Anforderungen an stabile Rollen und musikalische Ursache/Wirkung ersetzt. Physik-, Präsenz-, Pausen-, Ruhezonen- und manuelle Steuerungstests bleiben erfolgreich. Browserprüfung `node scripts/check-light-gestures.mjs --bass` bestanden; Bildfolge visuell geprüft. Der Browserlauf verwendet synthetische Musikmerkmale ohne Ton. Die musikalische Wirkung beim Originaltitel ist damit weiterhin nicht abschließend validiert.

## 2026-09-26 — Epische Aufbau-/Trailermusik, Aufnahme 10.29

Eingang: `__mock/anydj_preview_problem-2026-09-26_10.29.mp4`, 27,37 Sekunden, 1920×1080 mit Ton. Bildfolge geprüft. Das Audiosignal wurde lokal mit der App-Signalverarbeitung sowie den installierten Discogs-EffNet- und Beat-This-Modellen analysiert. Keine Übertragung an externe Dienste. Das Stilmodell liefert wechselnde Ambient-/Elektronik-Hinweise und mehrere Soundtrack-/Score-/Symphonic-Tags, keine eindeutige reine Orchesterklassifikation. Die Klangenergie verändert sich besonders um 18–22 Sekunden. Ein subjektives Anhören durch das Modell wird nicht behauptet.

Befund: In der Standardanalyse ohne Taktmodell entstanden für den gesamten Ausschnitt nur ein initiales Bewegungsziel, obwohl markante Audioereignisse vorhanden waren. Die harte Abhängigkeit rhythmischer Gesten von vorhandenen Downbeats wurde entfernt; gemessene außergewöhnliche Einsätze und Melodieereignisse behalten ihre Zeitpunkte auch ohne Taktmodell. Es wird kein Takt erfunden.

Neue Soundtrack-Gestaltung: mehrere Stilhinweise aus dem lokalen Kontext plus tatsächlich anhaltendes akustisches Material aktivieren eine zusammenhängende, dynamische Gestaltung. Neue `motionEnvelope`-Messwerte speichern Pegel, Klangfarbe, Stetigkeit und ausreichend bestätigte Tonhöhe alle 250 ms. Bewegungsziele entstehen erst aus ausreichend großen Messwertänderungen mit mindestens 800 ms Abstand. Ausladung und Höhe folgen dem Klang; innere und äußere Heads übernehmen unterschiedliche Höhen-/Melodieanteile. Stillstehendes Material erhält keine automatische Dauerschleife. Bestehende Motorgrenzen, manuelle Holds und Ruhezonen bleiben wirksam. Gemessene Rückzüge haben weiterhin Vorrang. Die Profilentscheidung ist eine Heuristik aus Modellhinweisen und Signalmerkmalen, keine sichere semantische Erkennung von „episch“.

Am echten Ausschnitt: das Profil greift in den ersten 20 Sekunden; danach bleibt die stärker rhythmische Standardgestaltung zuständig. Mit Taktmodell werden 20 Bewegungsziele statt eines statischen Gesamtbilds im Standard-Fallback erzeugt. Diese Zahlen vergleichen unterschiedliche Analysebedingungen und sind keine direkte Vorher/Nachher-Messung des gespeicherten vollständigen Songs. Einzelne gleichbleibende Passagen bleiben bewusst ruhiger.

Validierung: 130 gezielte Tests bestanden, einschließlich Genre-Fehlalarmen, steigender/fallender Dynamik, echten Einsätzen ohne Beat-Grid, manueller Holds, Blackouts, Ruhezonen sowie Geschwindigkeits-/Beschleunigungs-/Ruckgrenzen. Browsercheck mit echter Audioanalyse, Raumprojektion, sieben Heads und Motorglättung bestanden. 548 Frames wurden deterministisch mit 20 fps ausgegeben und mit der Originaltonspur gemuxt (27,37 Sekunden). Vorschau: `__mock/anydj_cinematic_review-2026-09-26_10.29.mp4`. Bildfolge visuell geprüft. Sie verwendet einen Testraum mit festen Diagnosefarben, nicht den aus der Aufnahme unbekannten gespeicherten Raumplan oder die vollständige ursprüngliche Songanalyse. Keine Behauptung einer abschließenden musikalischen Abnahme. Show-Cache-Version 30, Moving-Plan-Version 28.

## 2026-09-26 — Atomic Damage: gemeinsame Formationen und Strahlwirkung

Quelle lokal gefunden: `/home/erikh/Musik/Timecode - lightshow - Atomic Damage -MA3D.mp3` (111,94 Sekunden). Vollständiges Audio mit der App-Signalverarbeitung und den installierten Stil-/Taktmodellen analysiert. Keine externe Übertragung. Für den Darstellungstest wurde der Abschnitt 12–36 Sekunden verwendet.

Befunde und Änderungen:
- Gerade/ungerade Einzelgeräte ergaben bei geraden Rigs keine spiegelbildlichen Schaltgruppen. Bass-Handovers verwenden nun spiegelbildliche Paare (bei nur zwei Heads bleibt der einzelne Wechsel möglich). Ein kräftiger Wiedereinsatz nach einer gemessenen Basspause kann alle Heads gemeinsam öffnen.
- Die Raum-Motorsimulation parkte momentan ausgeschaltete Heads. Dadurch verloren kurz geschlossene Mitglieder einer laufenden Bassgruppe ihre gemeinsame Bewegungsphase. `movingGroupActive` hält nur diese kurz abgeblendeten Gruppenmitglieder in Bewegung. Ihre Leistung bleibt exakt null; echte Blackouts und inaktive Gruppen bekommen diese Ausnahme nicht.
- Rhythmische Choreografie nutzt einen Fächer für den Groove, parallele Strahlen für kräftige Abschnitte und eine Kreuzformation für die stärksten Höhepunkte. Auswahl folgt der musikalischen Szene, ohne Figurenrotation nach Zähler. Koordinierte Figuren teilen Start, Fortschritt und Ankunft; die Reichweite wird gemeinsam auf Motorgrenzen begrenzt. Moving-Plan-Version 29.
- Canvas-Strahlen hatten geringe Textur-Deckkraft plus eine zusätzliche Halbierung. Der transparente Kegel besitzt nun einen deutlicheren Kern und höhere sichtbare Dichte. Auch XR-/Polygon-Fallback wurde angepasst. Tatsächliche Geräteleistung, Farben, Strahlgeometrie, Ruhezonen und Nullleistung werden dadurch nicht angehoben oder umgangen.

Validierung: 150 Tests bestanden, inklusive gemeinsamer Interpolation, symmetrischer Gruppen für gerade/ungerade Rigs, unsichtbar weiterlaufender Motoren, echter Blackouts, Motorgrenzen, Ruhezonen, VR und Präsenz. Browserlauf mit acht Heads, echten Takt-/Stil-/Signaldaten, den berechneten Songfarben und Dimmwerten bestanden. Der Browserchecker hatte zuvor volle Diagnoseleistung verwendet; der aufgezeichnete Song-Modus berücksichtigt jetzt `showFrameAt`. Die Vorschau verwendet einen Testraum, nicht den unbekannten gespeicherten Nutzerraum oder die vollständige physische DMX-Konfiguration. Bildfolge visuell geprüft; keine abschließende subjektive musikalische Abnahme behauptet.

Artefakt: `__mock/anydj_atomic_formations_review-2026-09-26.mp4`, 24 Sekunden/480 Frames bei 20 fps mit zeitlich passend ausgeschnittener Originaltonspur. Enthält den Liedabschnitt 12–36 Sekunden.


## 2026-09-26 — Wählbarer Show-Modus

Das globale Lichtshow-Profil enthält jetzt „Show“. Die Auswahl wird gespeichert und schaltet zugleich den passenden Bewegungsmodus ein. Party und die bisherigen Profile bleiben separat wählbar.

Show verwendet vorhandene musikalische Akzente und Downbeats für gemeinsame Lichtbilder: ausgewählte Einsätze öffnen die Heads zusammen, dazwischen fällt der Pegel deutlicher ab. Farbwechsel und Helligkeitsakzente teilen exakte Ereigniszeitpunkte, auch außerhalb des Frame-Rasters. Automatische Farben erhalten bei Bedarf einen stärkeren Gegenfarbkontrast; ausdrücklich gewählte Paletten behalten Vorrang. Es gibt keinen unabhängigen Farbwechsel-Timer bei konstanten Pads oder Stille.

Die Bewegungen bauen gemeinsame Fächer-, Parallel- und Kreuzformationen auf. Ruhige Bilder zielen zum Boden, aktive Bilder zur Wand und Höhepunkte zur Decke. Gemeinsame Fahrzeiten berücksichtigen Motorgrenzen; Flächenwechsel können abgeblendet fahren. Die Raumprojektion hält parallele Strahlen auch bei räumlich getrennten Geräten parallel. Ruhezonen, manuelle Bewegungspausen, Helligkeitsgrenzen und die Flackerbegrenzung bleiben wirksam. Moving-Plan-Version 30.

Validierung: 168 gezielte Tests bestanden. Der neue Browsercheck `scripts/check-show-profile.mjs` prüft Auswahl auf Desktop und Mobilgerät, Wechsel zwischen Show/Party/Auto sowie Profil- und Bewegungsmodus-Persistenz nach Neuladen. Erfolgreich. `git diff --check` ohne Befund. Der ältere umfassende Check `scripts/check-dmx-moving-heads.mjs` scheitert bereits vor der Profilwahl an einer Helligkeitserwartung im Standardmodus (tatsächlich [4,0,0,0,4,2,0,0], erwartet [0,0,0,0,4,0,0,0]); er wird daher nicht als bestanden gewertet.

Vorschau: `__mock/anydj_show_mode_review-2026-09-26.mp4`, 24 Sekunden, 480 Frames bei 20 fps, mit Originalton für den Abschnitt 12–36 Sekunden von „Timecode - lightshow - Atomic Damage -MA3D.mp3“. Grundlage ist die vollständige lokale Songanalyse mit Takt-/Stilmodellen; Show erzeugt darin 55 gemeinsame Lichtbild-Ereignisse. Die Aufnahme verwendet acht Heads in einem Testraum und berechnete Songfarben/Dimmwerte. Bildfolge visuell geprüft, Länge und Tonspur bestätigt. Sie bildet nicht den gespeicherten Nutzerraum ab; keine abschließende subjektive musikalische Abnahme behauptet.


## 2026-09-26 — Show: Bewegung innerhalb der Formationen

Wiederholte Show-Farbakzente hatten innerhalb derselben Szene dieselben räumlichen Ziele. Die Formation stand daher häufig trotz weiterer Lichtbilder still. Show erhält nun zusätzliche Bewegungspunkte auf jedem zweiten gemessenen Beat in rhythmisch aktiven Szenen sowie auf vorhandenen musikalischen Ausdrucks-/Aufbauereignissen. Keine frei laufende Zeitbasis. Parallele Strahlen schwenken gemeinsam; Fächer und Kreuzformationen verändern gemeinsam ihre Öffnung. Stärkere Szenen verwenden einen kürzeren musikalischen Bewegungsbogen, Aufbaupassagen öffnen sich über die Phrase. Gemessene Energie beeinflusst die Reichweite. Innerhalb derselben Fläche nutzt die Bewegung den verfügbaren Zeitraum bis zum nächsten Ziel (maximal drei Sekunden), statt nach einer kurzen Fahrt wieder zu parken. Farb- und Dimmerpartitur unverändert.

Motorgrenzen begrenzen weiterhin die gemeinsame Reichweite. Neue Fahrten beginnen nicht vor der aktuellen Szene oder innerhalb einer vorangegangenen manuellen Bewegungspause. Ruhephasen und konstante Pads erhalten keine zusätzlichen Taktbewegungen. Moving-Plan-Version 31.

Validierung: 170 Tests bestanden, einschließlich zusätzlicher Prüfungen für sichtbare Bewegungen zwischen Farbwechseln, unveränderte Musik-/Farbpläne, Seek-Determinismus und Ruhephasen trotz vorhandenem Beat-Grid. Bestehende Prüfungen zu Motorsteuerung, Ruhezonen, Raumflächen und manuellen Holds bestehen. Browserrenderer mit der vollständigen Atomic-Damage-Analyse und Originalton erfolgreich. Im Ausschnitt 12–36 Sekunden entstehen 37 Zielpunkte, davon 26 zusätzliche Bewegungsziele und 35 ohne dunkle Transferfahrt. Bildfolge visuell geprüft; keine subjektive musikalische Abnahme behauptet.

Vorschau: `__mock/anydj_show_motion_review-2026-09-26.mp4`, 24 Sekunden/480 Frames bei 20 fps mit Originalton, acht Heads im Testraum. Gespeicherter Nutzerraum und physische Geräte wurden nicht nachgestellt.


## 2026-09-26 — Show: gemeinsame Aktionsfolgen und Farbverläufe

Neue gemeinsame Ereignisauswertung `show-action.js`: vorbereitete musikalische Show-Akzente steuern sowohl räumliche Farbverläufe als auch Präsenzgruppen und ergänzende Höhenrollen. Szeneneintritte und markante Höhepunkte bündeln die Heads; andere Akzente lassen spiegelbildliche Gruppen antworten. Aufbauereignisse entfalten die Präsenz von innen nach außen. Die Aktionen enden spätestens am nächsten Cue oder Szenenende. Kein zusätzlicher freilaufender Effekt-Timer. Die vorhandene Hell-Dunkel-Partitur bleibt erhalten.

Der automatische Farbpfad verwendet die Grund- und Kontrastfarbe des aktuellen Cues. Farbverläufe liegen spiegelbildlich über der Formation und kehren weich zur Grundfarbe zurück. Die Mischung normalisiert den Spitzenwert, um keine unbeabsichtigten Helligkeitseinbrüche zwischen Komplementärfarben zu erzeugen. Farblimit eins und eigene Paletten bleiben berücksichtigt. Manuelle Rhythmuswahl hat Vorrang vor Gruppenaktionen; die Flackerbegrenzung steuert deren Tiefe. Kurz geschlossene Gruppenmitglieder behalten ihre Motorphase. Moving-Plan-Version 32. Die neue Modulroute wurde im lokalen Server ergänzt.

Validierung: 197 Tests bestanden, einschließlich exakter Cue-Zeitpunkte, Symmetrie bei einem/zwei/sieben/acht Heads, weichem Farbabschluss, manuellen Rhythmusvorgaben, Flackerbegrenzung und deterministischem Seeking. Browser-Profilcheck auf Desktop/Mobil mit Speicherung und Neuladen bestanden. Vollständige Atomic-Damage-Analyse neu interpretiert: 26 gemeinsame Akzente und 29 Gruppenantworten; in diesem Titel keine als Aufbau klassifizierten Show-Cues. Browserrenderer um räumliche Farbverteilung erweitert. Bildfolge visuell geprüft. Kein subjektives Anhören oder physischer Gerätetest behauptet.

Vorschau: `__mock/anydj_show_actions_review-2026-09-26.mp4`, Abschnitt 12–36 Sekunden mit Originalton, 480 Frames bei 20 fps, acht Heads im Testraum. Sie verwendet die berechneten Song-Dimmwerte und die gemeinsame räumliche Farb-/Präsenzlogik; der gespeicherte Nutzerraum wird nicht nachgestellt.


## 2026-09-26 — Show: seitliche Formationen und Beat-Ankünfte

Show-Pan erweitert: gemeinsame Parallelbögen nutzen mehr seitliche Reichweite, Fächer bewegen sich als zusammenhängende Formation seitlich und Kreuzbilder öffnen sich weiter. Die Show-Raumprojektion bietet ±100 statt ±70 Grad. Der mittlere Head erhält keine erzwungene Vorwärtskomponente mehr. Ruhezonenumwege und die finale Raumvolumenprüfung bleiben bestehen. Explizite Zielbereiche behalten Vorrang.

In rhythmisch starken Szenen entstehen Bewegungsziele auf jedem gemessenen Beat; moderatere Szenen bleiben bei jedem zweiten Beat. Musikalische Offbeat-Ereignisse werden weiterhin berücksichtigt. Die Zusammenführung benachbarter Ziele nutzt 45 statt 200 ms Abstand. In intensiven Passagen können vorhandene akustische Ereignisse auf jedem Beat auch ein Farb-/Aktionsbild auslösen. Aktionsdauern enden auf nachfolgenden gemessenen Beats, statt eine aus dem Restabstand zum nächsten Beat geschätzte Dauer zu verwenden. Die gemeinsame Motorfahrt endet auf dem Cue; zu weite Wege werden weiterhin verkürzt. Moving-Plan-Version 33.

Validierung: 199 Tests bestanden. Neue Tests prüfen beide Seitenwände einschließlich mittlerem Head sowie exakte Bewegungs-/Farb-Cues und Aktionsenden auf einem um 37 ms versetzten 470-ms-Beat-Raster. Erreichbarkeit wird für alle Zielpaare gegen die bestehenden Motorgrenzen geprüft. Bestehende Raum-, Ruhezone-, Farb-, Präsenz- und manuelle Hold-Prüfungen bestehen. Browserrenderer mit echter Atomic-Damage-Analyse erfolgreich; Bildfolge visuell geprüft. Der volle Song erhält 111 Show-Cues statt zuletzt 55. Keine subjektive musikalische oder physische Hardwareabnahme behauptet.

Vorschau: `__mock/anydj_show_lateral_review-2026-09-26.mp4`, 24 Sekunden/480 Frames bei 20 fps mit Originalton, Abschnitt 12–36 Sekunden, acht Heads im Testraum. Der gespeicherte Nutzerraum wird nicht nachgestellt.
