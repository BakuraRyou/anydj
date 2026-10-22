# AnyDj – Prototyp 0.1.0

**Layout anpassen:** Auf breiten Bildschirmen lassen sich die Trennlinien zwischen
Decks und Mixer, zwischen Pult und Listen sowie zwischen Bibliothek und
Warteschlange ziehen. Die Größen werden im Browser gespeichert. Fokussierte
Trennlinien reagieren auf Pfeiltasten (mit Umschalt in größeren Schritten).
Doppelklick setzt die jeweilige Aufteilung zurück; „Einstellungen → Layout
zurücksetzen“ stellt alle Standardgrößen wieder her. Auf schmalen Displays
bleibt die gestapelte Ansicht erhalten.

**Full-Modus für Parties:** Bei „Lichtshow“ auf „Full“ klicken: Vier weich bewegte,
bildschirmfüllende Farbflächen folgen den Songfarben, der Helligkeit und dem
aktuellen Crossfade. Musik und Warteschlange laufen weiter, auch ohne Lampe.
Die Bedienung verschwindet nach kurzer Zeit und erscheint bei Mausbewegung
oder Antippen wieder. Mit Escape oder „Schließen“ zurück zum Pult.
Pause und Stopp schalten die Farben dunkel. Ohne Browser-Vollbildunterstützung
füllt die Ansicht das Browserfenster.

**Licht feinjustieren:** Unter „Lichtoptionen → Licht feinjustieren“ öffnet sich
„Feinschliff“ mit Helligkeit, Farbsättigung, Farbton und Lichtimpulsen. Diese Werte
wirken sofort auf beide Decks, Lichtmix, Full, Bühnenvorschau und echte Lampenausgabe.
Sie werden auf dem Gerät gespeichert und lassen sich gemeinsam zurücksetzen.
Helligkeit 0 schaltet die Ausgabe dunkel; Sättigung 0 ergibt weißes/graues Licht.
„Lichtimpulse“ verändert den Helligkeitskontrast: 0 gleicht aktive Passagen auf
50 % vor der globalen Dimmung an, 100 erhält den Originalverlauf, höhere Werte
betonen den Kontrast. Die Songanalyse und gespeicherte Gerätegestaltung bleiben erhalten.

**Lichtbühne einstellen:** Das Fenster bietet vier Bereiche: „Live-Look“ mit direkt
wählbaren Lichtstilen und Farben, „Feinschliff“ für globale Regler, „Geräte“ für die
Ausstattung und „Verbindung“ für die Hardware. „Individuell“ im Live-Look öffnet die
Gestaltung für ganze Bühne, Gruppen, Einzelgeräte und Songabschnitte. Kopfzeile
und Navigation bleiben beim Scrollen sichtbar; das DJ-Pult bleibt bedienbar.

**Virtuelle Lichtbühne im DJ-Pult:** Im Mixer „Lichtbühne aktivieren“
anklicken. Die Bühne ersetzt oben die Farbvorschau; „Bühne einstellen“ öffnet
die Einstellungen. Beim Schließen der Einstellungen läuft die Bühne weiter.
„Lichtbühne deaktivieren“ stellt die Farbvorschau wieder her. Die gewählte
Anzeige bleibt beim Neuladen erhalten. Die gewählte Ausstattung zeigt
die Lichtshow direkt im Browser – auch bei „Nur Audio“ und in der Web-Demo.
„Demo ohne Musik starten“ zeigt einen Beispielverlauf mit simulierten 120 BPM.
Sobald ein Deck spielt, übernimmt die Musik. Pause und Stopp schalten die
Vorschau dunkel. „Vorschau abdunkeln“ betrifft ausschließlich die Simulation.

**Bewegung in der 3D-Vorschau:** Mausrad und +/− bewegen die Kamera vorwärts
und rückwärts, auch über die Raummitte und Raumgrenzen hinaus. Nach der ersten
Kamerafahrt dreht Linksziehen den Blick am aktuellen Standort. Rechtsziehen
verschiebt die Kamera seitlich und nach oben/unten, auch in der Ego-Perspektive. Umschalt beschleunigt
die Mausradbewegung. „Übersicht“ beziehungsweise „Kamera zurücksetzen“ stellt
den Ausgangsblick wieder her; in der Ego-Perspektive setzt Zurücksetzen den
Standort und die Blickrichtung zurück.

**Raumstile in der 3D-Vorschau:** In „Deinen Raum planen“ oder „Raum & Lichtfläche“
lässt sich zwischen Club, Veranstaltungssaal und Industriehalle wählen. Wände
und Böden erhalten einfache Materialflächen und Bodenmuster, auch in VR. Der
Stil wird mit dem Raum gespeichert; ältere Räume verwenden den Club-Stil. In
der Außenansicht öffnen sich die Wände zur Kamera. „Umgebungshelligkeit“ regelt
Raumflächen, Modelle und Hintergrund von 0 bis 100 %; Standard sind 30 %.
Scheinwerfer und Lichtkegel behalten ihre Showhelligkeit. Der Wert wird pro
Raum gespeichert und nach VR übertragen. AR zeigt weiterhin den echten Raum.

**Eigene Raummodelle und AR-Scans:** Unter „Deinen Raum planen → Eigenes 3D-Modell importieren“
können statische GLB-Dateien (empfohlen), glTF mit eingebetteten Daten oder OBJ
geladen werden. Einheit, Hochachse und Drehung sind vor dem Import wählbar.
Der Import erstellt einen neuen Raum, zentriert die Geometrie und setzt sie
auf Bodenhöhe. Der zunächst rechteckige Plan lässt sich anschließend anpassen.
Unter „Raumdarstellung“ kann zwischen Raumstil, vorhandenen AR-Scanflächen und
eigenem Modell gewechselt werden. Modellgeometrie und Auswahl bleiben beim
Speichern, JSON-Export und bei der Übertragung zur Brille erhalten.

Die Vorschau übernimmt Geometrie und Materialgrundfarben, keine Fototexturen,
Animationen oder Draco-/Meshopt-Kompression. Grenzen: 10 MB Eingabedatei,
5.000 Modelldreiecke und 256 KB für den gespeicherten Raum; größere Modelle
vorher vereinfachen. WebXR-Scans verwenden die von der Brille gelieferten
Raumflächen. In AR bleibt die reale Umgebung sichtbar.

**Frei zusammenstellbare Bühne:** Unter „Bühne einstellen → Deine Ausstattung“
mit „+ Scheinwerfer“ und „+ Lichtleiste“ beliebig gemischte Geräte hinzufügen.
Jede Lichtleiste besitzt eine eigene Segmentanzahl; „Entfernen“ nimmt nur dieses
Gerät aus der Bühne. Scheinwerfer und mehrere Lichtleisten spielen gleichzeitig
mit derselben Musikanalyse. Die bisherigen Grenzen von vier Scheinwerfern und
acht Segmenten entfallen. Größere Bühnen scrollen innerhalb der Vorschau.

Die Simulation verwaltet derzeit ein Universum mit insgesamt 512 Kanälen.
Ein Scheinwerfer benötigt vier, eine Lichtleiste drei Kanäle pro Segment.
Die Belegung wird angezeigt; eine Änderung, die das Universum überschreitet,
wird mit einem Hinweis abgelehnt. Je Leiste sind technisch bis zu 170 Segmente
möglich, soweit die übrige Bühne Platz lässt. Leere Bühnen sind erlaubt und
bleiben dunkel. Die gemeinsame Farbobergrenze orientiert sich an allen
verfügbaren Scheinwerfern und Segmenten; Lauflichter berücksichtigen die Länge
jeder Leiste separat.

Geräteliste, Segmentzahlen, Gruppen sowie allgemeine und abschnittsbezogene
Gestaltungen bleiben gespeichert. Beim Entfernen werden nur die Einstellungen
des entfernten Geräts gelöscht; andere Geräte behalten ihre Zuordnung. Alte
Scheinwerfer-/Lichtleisten-Einstellungen werden übernommen. Die Ausstattung
wird weiterhin manuell angegeben. USB-/LAN-Ausgänge werden über einen lokalen
OLA-Dienst automatisch erkannt; die Ausgabe wird ausdrücklich eingeschaltet.

**Automatische Lichtshow:** Im rechten Einstellungsbereich „Automatische
Lichtshow“ wählen und unter „Maximale Farben gleichzeitig“ eine bis vier Farben
zulassen. Diese Zahl ist eine Obergrenze: In ruhigen Passagen darf die gesamte
Bühne dieselbe Farbe zeigen. Fließende Passagen verwenden bis zu zwei Farben,
Aufbauten erweitern die Palette schrittweise, kräftige Passagen können die ganze
gewählte Farbvielfalt nutzen. Die aktuelle Palette und eine kurze Erklärung
werden direkt angezeigt. Die Deckfarbe bildet den Ausgangspunkt; die Automatik
ergänzt verwandte oder kontrastierende Farben und verteilt Helligkeitswellen
auf Scheinwerfer und Lichtleiste. Es müssen keine Geräte einzeln programmiert
werden. Musik- und Abschnittsmerkmale stammen aus der vorhandenen vorbereiteten
Show; die zusätzliche Darstellung benötigt keine erneute KI-Analyse. Die
musikalische Zuordnung ist eine Gestaltungsheuristik, keine Garantie einer
optimalen Show. Ohne Abschnittsinformation verwendet sie bis zu zwei Farben;
ohne Beat-Raster bleibt die Bewegung aus. Crossfades mischen pro Farbplatz,
sodass die gewählte Obergrenze auch während eines Übergangs erhalten bleibt.
Helligkeitsabstufungen können zusätzliche sichtbare Schattierungen erzeugen.

**Bisheriger und manueller Modus bleiben erhalten:** „Gemeinsamer Lichtmix · wie
bisher“ bleibt bei der ersten Verwendung die Voreinstellung und gibt allen
Geräten dieselbe Farbe und Helligkeit. „Manuell · pro Gerät gestalten“ bietet
individuelle Farben, Gruppen und Animationen. Der automatische Modus verwendet
eine eigene Gestaltung und lässt manuelle Regeln gespeichert. Ein Wechsel
zwischen den Modi löscht nichts; Modus und maximale Farbanzahl bleiben gespeichert.
Im automatischen Modus führt ein Klick auf die Bühne zur Farbauswahl, im
manuellen oder gemeinsamen Modus zur Gestaltung des angeklickten Geräts.

**Lichtshow gestalten:** Unter „Bearbeiten“ die gesamte Bühne, eine Gruppe oder
ein Gerät auswählen. Gruppen heißen Links, Rechts und Hintergrund; jedes Gerät
kann einer dieser Gruppen zugeordnet werden. Anfangs gehören Scheinwerfer 1/2
zu Links und 3/4 zu Rechts. Neue Lichtleisten gehören zunächst zum Hintergrund. Rechts verwendet
im neuen Modus zunächst eine Gegenfarbe. „Eigene Einstellungen“ schaltet eine
abweichende Gestaltung ein; ausgeschaltet übernimmt die Auswahl ihre Vorgaben.
„Diese Auswahl zurücksetzen“ entfernt die Abweichung, bei der gesamten Bühne
setzt es deren Vorgaben zurück. Andere Geräte- und Gruppenregeln bleiben erhalten.

Farbmodi: Lichtmix übernehmen, Gegenfarbe, feste Farbe, eigene Palette und die
bekannten Paletten aus dem DJ-Pult. Bereits gespeicherte eigene DJ-Paletten
stehen beim Öffnen der DJ-Seite ebenfalls zur Auswahl. Farbe A/B bearbeitet
eine eigene Zweifarbenpalette; feste Farbe verwendet A. Helligkeit und
Animationsstärke sind separat einstellbar. Die Automatik kombiniert
abwechselnde Akzente, eine animierte Lichtleiste und Flächenlicht in ruhigen
Abschnitten. Alternativ stehen originale Helligkeit, Hintergrundlicht,
Beat-Impulse, Wechselakzente, Farbwelle und Lauflicht zur Verfügung.
Dauer und Versatz werden in Beats angegeben; vier Beats bedeuten nicht
zwingend einen Takt. Ohne Beat-Raster folgen rhythmische Effekte der
ursprünglichen Helligkeit. Farbwellen/Lauflichter verteilen Paletten räumlich;
mit „Lichtmix übernehmen“ bleibt die Ausgangsfarbe erhalten.

**Gestaltung pro Songabschnitt:** Während der Wiedergabe unter „Gültigkeit“
„Aktueller Songabschnitt“ wählen. Die Regel gilt für diesen Track und diesen
Abschnitt. Bei zwei Decks zeigt der Editor den Abschnitt des stärker gewichteten
Decks; jedes Deck wird dennoch mit seinen eigenen Regeln berechnet und danach
pro Gerät überblendet. Abschnittsvorgaben haben Vorrang vor allgemeinen Regeln;
innerhalb einer Ebene gilt Gerät vor Gruppe vor gesamter Bühne. Die Auswahl
„Aktueller Songabschnitt“ folgt der laufenden Wiedergabe; die Bezeichnung zeigt,
welcher Abschnitt gerade bearbeitet wird. Abschnittsregeln sind an Track-ID und
Abschnittsstart gebunden; nach einer Neuanalyse mit veränderten Grenzen müssen
sie gegebenenfalls neu gesetzt werden.

Modus und Gestaltung werden lokal im Browser gespeichert. Speicherfehler werden angezeigt; Löschen der Browserdaten entfernt
die Gestaltung. Es werden bis zu 256 Abschnittsregeln gespeichert. Die
Simulation erzeugt ein DMX-Universum mit 512 Kanalwerten: dynamisch aufeinanderfolgende Dimmer/RGB-Geräte und RGB-Segmente
mit automatisch zugeordneten Kanalbereichen. Die Darstellung interpretiert
diese Werte; Kanalbelegung und Werte stehen unter „Kanalbelegung & technische Details“. USB und LAN sind über OLA angebunden (siehe [Einrichtung](SETUP.md#dmx-über-usb-und-lan)). Herstellerprofile und
Moving Heads werden noch nicht unterstützt. Die Visualisierung ist keine physikalische Lichtberechnung.


**Echte DMX-Ausgabe:** Unter „Bühne einstellen → Echte Lampen verbinden“ einen
USB-/lokalen oder LAN-Ausgang wählen und einschalten. AnyDj prüft den lokalen
OLA-Dienst alle 2,5 Sekunden auf vorhandene und neu angeschlossene Interfaces.
Ein ausgewählter Ausgang steuert mehrere Lampen/Segmente im gemeinsamen
512-Kanal-Universum. Die Ausgabe folgt derselben Show wie die Vorschau; die
visuelle Demo und „Vorschau abdunkeln“ bleiben reine Vorschaufunktionen.
Demo-Start, Bühnen-Deaktivierung, geänderte Ausstattung und Stop schalten die
DMX-Ausgabe aus. Ohne neue Browserdaten versucht der Server nach 1,8 Sekunden
ein Schwarzbild zu senden; bei Verbindungsverlust kann dessen Empfang nicht
garantiert werden. Nach einer Trennung wird nicht automatisch neu eingeschaltet.
OLA muss separat installiert und eingerichtet sein; kein universeller
USB-Plug-and-play-Treiber. Die Web-Demo und der App-Demomodus senden kein DMX.

**DJ-Pult unter `/dj`:** Zwei unabhängig spielbare Decks, lokale Trackliste,
Drag & Drop, Cue-Punkte, Positionsregler und Lautstärke pro Deck. Der Crossfader
überblendet Audio und die beiden automatisch erzeugten Lichtshows. Mehrere
Dateien hinzufügen, mit „A/B“ oder per Ziehen laden, beide Decks starten und
überblenden. DMX-Ausgabe schaltest du bei Bedarf in den Bühneneinstellungen ein.
„Stopp“ pausiert beide Decks und die Lichtshow. Cue pausiert und springt zum gesetzten Punkt. Noch kein automatisches
Beatmatching oder Kopfhörer-Vorhören.

**Kompakte Ansicht:** Decks und Mixer stehen über zwei dauerhaft sichtbaren
Containern für Bibliothek und Warteschlange. Beide Listen scrollen unabhängig.
Desktop-Trackzeilen sind rund 41 Pixel hoch, mit Titel/Status links und kompakten
Aktionen rechts. „↻“ öffnet die erneute Dateiverknüpfung; der volle Titel und
Status bleiben beim Darüberfahren lesbar. Suche und „Alle einreihen“ teilen
sich eine Werkzeugleiste.
Bei 1024×768, 1280×720 und 1366×768 passen die Hauptfunktionen ohne Seitenscrollen;
nur die Listen scrollen. Auch mobil bleiben Bibliothek und Warteschlange
nebeneinander; dort scrollt zusätzlich die Seite.

**Ordner verbinden:** In unterstützenden Browsern wird ein lokaler Musikordner
inklusive Unterordnern verknüpft. Bei sichtbarem DJ-Tab wird alle zehn Sekunden
abgeglichen; „Aktualisieren“ stößt den Abgleich sofort an. Neue Dateien erscheinen,
entfernte verschwinden, geänderte erhalten beim nächsten Laden eine neue Analyse.
Geladene Decks werden erst nach dem Entladen aktualisiert oder entfernt. Eine
physisch geänderte Datei kann der Browser dennoch nicht mehr abspielen.
Die Dateien selbst werden niemals verändert. Ordner-Tracks werden erst beim
Laden auf ein Deck analysiert. „Trennen“ beendet den Abgleich und behält die Liste;
ein neuer Ordner ersetzt die bisherigen Ordner-Einträge. Manuell hinzugefügte
Tracks bleiben erhalten. Maximal 2.000 Audiodateien pro Ordnerverknüpfung.

Die Ordnerverknüpfung bleibt im selben Browser und Ursprung gespeichert;
gegebenenfalls muss der Lesezugriff erneut erlaubt werden. Ohne Directory-Picker
ist eine Ordnerauswahl möglich, die zum Aktualisieren erneut ausgewählt werden
muss. Das ist kein automatischer Abgleich im Hintergrund.

**Berechnungsstatus:** Deck und Trackliste zeigen die aktuelle Analysephase.
„Spielbereit · Songaufbau wartet/läuft“ erlaubt bereits die Wiedergabe;
„✓ Vollständig berechnet“ erscheint erst nach erfolgreicher Hintergrundanalyse.
Bei abgeschaltetem Songaufbau steht „✓ Fertig · ohne Songaufbau“, bei einer
fehlgeschlagenen Teilanalyse „⚠ Fertig · Teilanalyse“ mit dem Grund im Tooltip.

**Lichtshow im DJ-Mixer:** „Automatisch“ verwendet die musikalisch gestaltete
Basis-Show. „Party“ verstärkt Akzentkontrast und Farbsättigung; „Disco“ setzt
dichtere, kontrastreiche Farbwechsel auf die ausgewählten rhythmischen Ereignisse.
Die Farben bleiben zwischen diesen Ereignissen stehen. Ein höheres Grundlicht
und kleinere Helligkeitsimpulse reduzieren im Disco-Profil das dauernde Pumpen. Gehaltene Passagen und Stille erhalten keinen
zusätzlichen Farbwechsel. Alle Modi behalten Beat-Zeitpunkte und Helligkeitslimits.
Erkannte Strophen halten jetzt Farbkontrast und Wechselgeschwindigkeit zurück,
wenn das Lied einen akustisch ausreichend kräftigen Refrain oder Soloabschnitt
enthält. Diese Hauptabschnitte erhalten den vollen Farbkontrast und mehr
Helligkeitsspielraum. Die Abschnittsrolle bleibt von der lokalen Schlagzeugstärke
getrennt: Eine kräftige Strophe wird dadurch nicht automatisch genauso dicht wie
der Refrain. Ruhige oder gegenüber der Strophe deutlich schwächere vorhergesagte
Refrains lösen diese Hervorhebung nicht aus. Ohne belastbare Abschnittshinweise
bleibt die bisherige akustische Gestaltung verfügbar. Es gibt keine Regeln für
bestimmte Dateinamen, Künstler oder Songzeitpunkte.
Die Auswahl gilt für beide Decks und folgende Queue-Tracks und bleibt gespeichert.
Beim Wechsel während der Wiedergabe wird über zwei Sekunden überblendet.
Die KI muss dafür nicht erneut laufen; die ursprüngliche Show bleibt erhalten,
sodass „Automatisch“ sie exakt wiederherstellt.

Am Beispieltrack (264 Sekunden) dauerte die vollständige Basisvorbereitung mit
lokalen Beat- und Stilmodellen im Browsertest 14,9 Sekunden. Die zusätzliche
All-In-One-Struktur benötigte in der vorherigen Messung rund 103 Sekunden und
kann im Hintergrund weiterlaufen. Profilwechsel selbst benötigten rund 3–4 ms.
Diese Laufzeiten sind Messungen dieses Rechners und Tracks, keine Garantie.
Die Profile steuern Gestaltungspräferenzen; eine objektiv optimale Lichtshow
ist dadurch nicht nachgewiesen. Details: `reports/dj-show-profiles-check.md`.

**Automatische Animationsmuster:** Die Show kombiniert ruhige Flächen, breite
Lichtwellen, wechselnd kräftige Akzente, Aufbauten und kurze Impulse. Abschnitt,
lokaler Stilverlauf und wiederkehrende Motive bestimmen die Auswahl. Längere
Passagen wechseln an erkannten Taktgrenzen das Muster; ohne Taktanfänge dienen
Gruppen der ausgewählten Akzente als Ersatz. Party und Disco behalten diese
Abwechslung. Der Stil wird pro Musterphrase neu berücksichtigt; Aufbauten
steigern sich über den gesamten Abschnitt. Intensive Einsätze starten mit einem
klaren Impuls, interne Musterwechsel mischen den ersten Akzent, und Lichtwellen
klingen bis auf null aus. Die Musterauswahl berücksichtigt zusätzlich die hörbaren Anschläge pro Phrase:
Ausgeprägte rhythmische Anschläge bevorzugen Impulse und Wechselakzente, weiche
Passagen Wellen und Wechselakzente. Die Takterkennung bleibt unverändert. Bereits vorbereitete Tracks
müssen für die neuen Muster erneut berechnet werden. Prüfbericht:
`reports/animation-pattern-check.md`.

**Lokale Coverbilder:** Die Bibliothek zeigt eingebettete Cover aus MP3 (ID3),
FLAC, M4A und WAV mit ID3-Metadaten neben dem Titel. JPEG-, PNG- und WebP-Bilder
werden lokal zu kleinen Vorschaubildern verkleinert und im Browser gespeichert.
Es werden keine Bilder aus dem Internet geladen. Ohne Cover bleibt die Textzeile
erhalten. Bereits vorhandene Titel werden ergänzt, sobald die Audiodatei lokal
verfügbar bzw. der Ordner freigegeben ist. Ogg-Cover und separate Bilddateien im
Musikordner werden derzeit nicht ausgewertet.

**Musikalische Übergänge (früher „Auto Beat“):** Die standardmäßig aktive
Checkbox im zentralen Mixer wählt geeignete Takt- und Abschnittsgrenzen für
Auto-Crossfade und Warteschlange. Sie verändert weder das Tempo noch die
laufende Beatphase der Songs. Ein normaler Play-Start springt nicht mehr auf
den Takt des anderen Decks. Beim automatischen Übergang kann das nächste Lied
an einem nahegelegenen erkannten Taktanfang starten.

Fehlt ein brauchbares Raster oder ist die Option aus, wird zeitbasiert mit der
eingestellten Übergangsdauer überblendet. Die gespeicherte Schalterstellung
bleibt erhalten; die Web-Version kann die Option ebenfalls verwenden und fällt
bei fehlendem Raster auf den zeitbasierten Start zurück. „Überblenden“ startet
weiterhin sofort. Nur der manuelle Tempo-Regler und der ausdrücklich betätigte
Sync-Button ändern die Wiedergabegeschwindigkeit. Manuelles Tempo bleibt beim
Ein-/Ausschalten der musikalischen Übergänge unverändert.

**Adaptive Übergangsplanung:** Bei „Übergangsdauer → Automatisch“ vergleicht
AnyDj kurze Wechsel und mehrere Überblendvarianten. Neben Rhythmus, Gesang
und Bass zählen anhaltende Gesangspausen, geschätzte Phrasengrenzen und der
Energieverlauf vor und nach dem Wechsel. Vorhandene Tonhöhenverteilungen
liefern eine lokale Tonartschätzung; unsichere Ergebnisse werden nicht gewichtet.
Das sind musikalische Näherungen, keine Erkennung des Liedtextes und keine
Garantie für einen perfekten Übergang.

Bei musikalischen Übergängen mit automatischer Dauer wird die Audiokurve
zusätzlich aus den RMS-Pegeln der aktuell gewählten Ein- und Ausstiegsbereiche
berechnet. Ein behutsamer Ausgleich von maximal 2 dB während der Überlagerung
kann das Pegelloch in der Mitte verringern. Bei hohen gemessenen Pegeln wird der
Ausgleich reduziert; bei fehlenden Daten, sehr leisen Bereichen, demselben
Bibliothekstitel auf beiden Decks und kurzen Wechseln entfällt er. Es gibt keine
hinterlegten Songkombinationen. Dies ist ein Energieausgleich, keine
LUFS-Normalisierung oder Garantie gegen Pegelspitzen.

Die Lautstärkekurven aller Übergänge laufen auf der Audio-Zeitachse. Kanalpegel
bleiben währenddessen bedienbar; die Hörprobe und ihre Grafik verwenden dieselbe
Kurvenberechnung. Feste Übergangsdauern behalten ihre bisherigen Kurven.

Unter „Automatik einstellen → Einstiegssuche“ lässt sich die Suche optional
von zwei auf 16 oder 30 Sekunden erweitern. Dadurch darf die Automatik einen
Teil des Intros überspringen. Ein mit „Cue setzen“ markierter Punkt bleibt
exakt verbindlich, auch bei 0:00; Shift-Klick auf „Cue setzen“ hebt ihn wieder auf.

„Übergang bearbeiten & probehören“ zeigt ein gemeinsames interaktives Diagramm
für beide Titel. Kurve wählen, eigene Punkte hinzufügen und mit Maus oder Touch
verschieben: horizontal den Zeitpunkt, vertikal die Lautstärke. Pfeiltasten
verschieben den fokussierten Punkt; Entf löscht ihn. Rückgängig und Zurücksetzen
sind direkt verfügbar. Start- und Endpegel bleiben für eine vollständige Übergabe
fest. Unter „Zeitpunkte & Vorlagen“ stehen Einstiege, Dauer und Analysevorschläge.
Hörprobe und Live-Übergang verwenden dieselben eigenen Lautstärkekurven. Die
Änderung betrifft zunächst nur die Vorschau; „Übergang übernehmen“ übernimmt sie
für das aktuelle Songpaar. Bereits verstrichene oder inzwischen veraltete
Pläne werden abgelehnt. Optional lässt sich der gewählte Stil als leichte
Präferenz speichern; unter „Automatik einstellen → Leichte Stilpräferenz“
ist sie veränderbar oder mit „Keine“ zurücksetzbar. Einstiegssuche und Präferenz
werden auf dem Gerät gespeichert. Die Hörprobe läuft unabhängig von den Decks
über den gewählten Kopfhörerausgang, ohne Deckpositionen oder Warteschlange zu
ändern. Unter „Audioausgabe“ im Mixer oder direkt im Übergangseditor
zuerst „Master / Publikum“, danach „Kopfhörer / Vorschau“ auswählen. Beide
Felder wenden die Auswahl direkt an; der Master ist in der Kopfhörerliste gesperrt.
Gerätefreigabe und Aktualisierung liegen unter „Gerät fehlt? Gerätezugriff & Hilfe“.
Master- und Kopfhörerausgang sowie Kopfhörerlautstärke werden lokal für diese
App-Adresse gespeichert. Beim nächsten Besuch werden verfügbare Geräte nach
der ersten Interaktion wieder aktiviert, ohne eine Hörprobe zu starten. Fehlende
Geräte werden gemeldet; die gespeicherte Auswahl bleibt erhalten.
Ohne getrennte Ausgänge bleibt das Probehören deaktiviert; Bearbeiten und
Übernehmen sind weiterhin möglich. Bei einem Gerätewechsel oder Ausgabefehler
stoppt nur die Hörprobe. Falls im Browser Geräte fehlen, kann „Audiogeräte
freigeben“ mit kurzzeitigem Mikrofonzugriff die Geräteauswahl freischalten.

**Farbmodi und Vorschau:** Direkt unter dem Tracknamen jedes DJ-Decks öffnet
„Farbmodus“ eine Auswahl mit Textsuche und Farbgruppenfiltern. Neben Songanalyse,
warmen, kühlen, bunten und weißen Paletten lassen sich eigene benannte Farbpaare
hinzufügen. Die Auswahl wird pro Lied im Browser gespeichert und ohne erneute
KI-Analyse angewandt; explizite Abschnittsfarben behalten Vorrang. Ein Profilwechsel
oder Neuberechnen behält den gewählten Farbmodus bei. „Songanalyse“ stellt die
ursprünglichen automatischen Farben wieder her.

Oben im Mixer zeigen drei Farbpunkte Deck A, den Lichtmix und Deck B. Die
Mixvorschau berücksichtigt Crossfader, Lautstärken und laufende Übergänge. Bei
pausierten Decks bleibt deren aktuelle Farbe sichtbar; ohne aktive Wiedergabe
ist der Mixpunkt inaktiv. Dies ist die berechnete Vorschau, keine Rückmeldung
der physischen Lampe.

**Neu berechnen:** Der Button am Track startet die Analyse erneut. Eine vorhandene
Show bleibt bis zum fertigen Ersatz nutzbar; das neue Ergebnis wird gespeichert.
Falls nötig, wird zuvor die Musikdatei erneut ausgewählt.

**Gespeicherte Lichtshows:** Der DJ-Modus speichert die berechnete Basis-Show
und spätere Verfeinerungen automatisch lokal im Browser (IndexedDB). Nach einem
Neuladen stehen sie wieder bereit, auch mit Party/Disco. Bei noch ausstehendem
Songaufbau werden die Analysemerkmale mitgespeichert; die Hintergrundanalyse
kann nach Wiederverbinden der Datei fortgesetzt werden. Dateiname, Größe,
Änderungsdatum, Berechnungsversion und Gestaltungsoptionen müssen übereinstimmen,
sonst wird neu berechnet. Änderungen an der Show-Erzeugung müssen deshalb
`SHOW_PLAN_VERSION` in `public/show-plan.js` erhöhen.

Audiodateien werden nicht kopiert. Ohne dauerhafte Dateiberechtigung muss die
Musik nach einem Neuladen erneut verknüpft werden; die passende Lichtshow bleibt
erhalten. Der Speicher gilt für denselben Browser und dieselbe Adresse mit Port.
Gelöschte Browserdaten entfernen auch gespeicherte Shows. Speicherfehler werden
angezeigt, verhindern aber die Wiedergabe nicht. Details und Browserprüfung:
`reports/dj-show-cache-check.md`.

**Warteschlange:** Tracks über „+ Queue“ oder die gefilterte Bibliothek über
„Alle einreihen“ hinzufügen. Im Container „Warteschlange“ die Reihenfolge mit ↑/↓ ändern
oder Einträge entfernen; derselbe Track kann mehrfach eingereiht werden.
„Start“ übernimmt ein bereits laufendes Deck oder startet den ersten Eintrag.
Der nächste Track wird im freien Deck vorbereitet und am Songende über die
gewählte Crossfade-Dauer eingeblendet. Anschließend folgt automatisch der nächste.
Spielbereitschaft genügt; die zusätzliche Songstruktur darf weiterrechnen.

„Automatik pausieren“ lässt die Musik und einen bereits laufenden Übergang zu
Ende laufen, startet aber keinen weiteren. Manuelle Deckbedienung oder Eingriffe
am Crossfader pausieren die Warteschlangen-Automatik ebenfalls. „Stopp“ pausiert
beide Decks. Während eines Warteschlangen-Übergangs ist die Reihenfolge gesperrt.
Ist der Folgetrack noch nicht spielbereit, wartet die Automatik darauf; endet
vorher der laufende Titel, entsteht eine Pause. Fehlende oder defekte Dateien
halten die Automatik mit einer Fehlermeldung an, statt Titel still zu überspringen.
Die verbleibende Reihenfolge wird gespeichert; nach Neuladen ist ein bewusster
Start und gegebenenfalls erneuter Dateizugriff erforderlich.

**Musikalische Übergänge:** Sobald beide Titel im Deck vorbereitet sind, erstellt
AnyDj einen gemeinsamen Übergangsplan. Mit vorhandener Instrumentenanalyse
vergleicht er Gesang, Bass, Energie und rhythmische Unterschiede an möglichen
Ein- und Ausstiegsstellen. Direkt unter dem Crossfader zeigt ein Status, ob Titel noch vorbereitet werden,
ein Basisübergang bereits nutzbar ist oder der gemeinsame Plan bereit ist.
Die fertige Planung nennt die Variante:
„Sanfter Übergang“, „Bassübergabe“ oder „Kurze Überlagerung“. Die Bassübergabe
senkt den alten Bass vor dem neuen ab; eine kurze Überlagerung reduziert
konkurrierenden Gesang oder auseinanderlaufende Rhythmen. Manuelle EQ-Werte
bleiben erhalten. Nach Abschluss oder Abbruch werden die Übergangsfilter
zurückgesetzt.

Die eingestellte Dauer ist die Obergrenze; kurze Restlaufzeiten verkürzen den
Übergang. Der automatische Start darf bis zu vier Sekunden bzw. eine halbe
Übergangsdauer vor dem bisherigen Start liegen. Der nächste Titel darf an einem
erkannten Taktanfang bis zu zwei Sekunden hinter seinem Cue starten. Änderungen
an Titel, Cue, manuellem Tempo oder Dauer erneuern den Plan. Ein laufender
Übergang behält seinen Plan. „Überblenden“ beginnt sofort an der aktuellen Stelle.
Das Tempo wird nicht automatisch geändert.

Ohne Instrumentenanalyse bleibt der sanfte Crossfade mit vorhandenen Takt- und
Abschnittsgrenzen erhalten; ohne brauchbares Raster startet er zeitbasiert.
Die Auswahl ist eine Heuristik auf den vorhandenen lokalen Analyseergebnissen,
keine Garantie für einen musikalisch perfekten Mix. Browser- und Audiolatenzen
erlauben keine samplegenaue Synchronisation. Ein neues KI-Modell ist nicht nötig.

**Lichtmotive und Höhepunkte in der automatischen Lichtbühne:** Wiederkehrende
Motivgruppen der vorbereiteten Show verwenden denselben Farbanker. Ihr
Bewegungsablauf beginnt relativ zum jeweiligen Abschnitt, damit ein späterer
Refrain wiedererkennbar wirkt. Die bestehenden Motiverkennungen sind heuristisch;
bei KI-Abschnitten beruhen sie auf Abschnittslabels. Unbekannte Motive verwenden
weiter die laufende Deckfarbe. Ruhige Passagen erhalten die halbe bisherige
Helligkeit, fließende 85 %, Aufbauten steigen von 55 % bis 100 %. Höhepunkte
nutzen den vorhandenen Maximalwert, ohne ihn zu erhöhen. Farbobergrenze,
Blackout und Crossfade bleiben wirksam. Gemeinsamer und manueller Lichtmodus
behalten ihre bisherige Gestaltung. Gespeicherte Shows erhalten diese
Bühneninterpretation beim Laden ohne erneute Audioanalyse.

**Auto-Crossfade:** Beim Öffnen des DJ-Pults standardmäßig aktiv. Beide Decks mit vorbereiteten Tracks belegen. Ein Deck starten
und den Crossfader ganz auf dessen Seite stellen. „Auto-Crossfade“ startet das zweite Deck am Cue-Punkt und blendet Audio und Licht
über die gewählte Dauer (2–20 Sekunden, standardmäßig 8) um. Danach pausiert
das bisherige Deck. Bei kurzen verbleibenden Laufzeiten wird der Übergang gekürzt.
„Überblenden“ startet den Übergang sofort; ein bereits spielendes Zieldeck
behält seine Position. Der Verlauf folgt der Audio-Uhr des Browsers.

Manuelles Ziehen am Crossfader, Pause, Cue oder „Abbrechen“ beendet einen laufenden Übergang und pausiert die Automatik bis zum nächsten Play- oder Überblenden-Start. Die gespeicherte Auto-Crossfade-Einstellung bleibt erhalten.
Positionsregler, Hotcues und Beat-Sprünge lassen Auto-Crossfade und die laufende
Warteschlange aktiv. Ein laufender Übergang setzt seinen Verlauf fort; sonst
richtet sich der nächste Start nach der neuen Songposition.
Beim Abbrechen bleibt die aktuelle Mischung erhalten; „Stopp“ pausiert
beide Decks. Für den nächsten automatischen Übergang einen neuen Track auf das
freigewordene Deck laden. Bereits ausgeblendete Tracks werden nicht automatisch
wieder gestartet. Für fortlaufendes Nachladen die Warteschlange verwenden.

Die Trackliste speichert Metadaten und, wo unterstützt, lokale Dateiverweise in
IndexedDB. Audiodateien werden dabei nicht kopiert. In Chrome/Edge auf localhost
können über „+ Dateien“ oder echtes Datei-Drag & Drop gespeicherte Verweise
nach Neuladen erneut geöffnet werden; der Browser kann Lesezugriff erneut
anfragen. Andere Browser beziehungsweise unsichere LAN-HTTP-Seiten verwenden
Dateiauswahl mit „Erneut verknüpfen“ nach dem Neuladen. Gleicher Browser und
Server-Ursprung (einschließlich Port) sind erforderlich. Veränderte Dateien als
neue Tracks hinzufügen, damit keine alte Analyse verwendet wird. Unterstützte
Audioformate hängen vom Browser ab; maximal 50 MB und 15 Minuten pro Track.
Die Bibliothek ist die Sammlung; die Warteschlange bestimmt die automatische Abspielreihenfolge.
[Browser-Dokumentation zu gespeicherten Dateiverweisen](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).

**Farbbewegung:** Die automatische Show wechselt in rhythmischen Passagen die
Farbpaarung. Fließende Stellen orientieren sich an erkannten Taktanfängen;
intensive Passagen wechseln häufiger auf ausgewählten Akzenten. Ohne erkannte
Taktanfänge werden vorhandene Akzente gruppiert, keine Taktart unterstellt.
Jedes Motiv erhält ein kontrastierendes Farbpaar. Bei zu ähnlichen automatischen
Palettenfarben wird eine Gegenfarbe ergänzt; benutzerdefinierte Paletten bleiben
erhalten. Farbwechsel werden auch zwischen den 125-ms-Vorschaubildern am
tatsächlichen Akzentzeitpunkt ausgewertet. Ruhepassagen, manuelle Gestaltung,
Beat-Zeitpunkte und Helligkeitskurven werden dadurch nicht verändert.

**Lokaler Stilverlauf:** Discogs-EffNet ergänzt die automatische Show in Player und
DJ-Pult. Installation: `bash scripts/install-style.sh` (separate `.venv-style`,
ca. 18 MB Modell, Python-Abhängigkeiten zusätzlich). Auf diesem Rechner eingerichtet.
Nach Server-Neustart und erneutem Vorbereiten eines Tracks wird das Modell
automatisch verwendet. Bei fehlendem Modell bleibt die akustische Gestaltung
verfügbar; der Status-Tooltip nennt den Grund.

Die Analyse betrachtet 2,048-Sekunden-Fenster und erhält mehrere Stilanteile
zugleich. Elektronische, rockige, poppige, groovebetonte, akustische, orchestrale
und atmosphärische Einflüsse werden über etwa sechs Sekunden weich gewichtet.
Das Ergebnis beeinflusst Akzentkontrast, Abklingen, Grundlicht, Farbgeschwindigkeit
und das Verhältnis melodischer zu rhythmischer Farbbewegung. Es ersetzt weder
Beat This! noch Songabschnitte. Die Zuordnung zu Lichtparametern ist unsere
Gestaltungslogik; das Modell erzeugt selbst keine Lichtshow. Es trennt auch keine
Instrumentenspuren. Stilwerte sind Schätzungen, keine kalibrierten Prozentangaben;
unsichere Ergebnisse erhalten die akustische Gestaltung. Die manuelle Gestaltung
bleibt unbeeinflusst.

Die nächste Datei wird beim Laden auf Deck B vorbereitet, während Deck A läuft.
Die Modellinferenz nutzt maximal zwei CPU-Threads und keinen Netzwerkzugriff;
bereits analysiertes PCM wird für bis zu vier Tracks im Server-Arbeitsspeicher
zwischengespeichert. Nicht alle Tracks eines verknüpften Ordners werden vorab analysiert.

Modell und Herkunft: [Discogs-EffNet / Essentia](https://essentia.upf.edu/models.html#discogs-effnet),
400 gleichzeitig bewertbare Discogs-Stile, offizielle MusiCNN-Vorverarbeitung.
Die Modellgewichte stehen unter CC BY-NC-SA 4.0; Essentia unter AGPL-3.0.
Die Installation prüft SHA-256-Prüfsummen. Laufzeitmessung und Testgrenzen stehen
in `reports/style-integration-check.md`.

**Songaufbau mit lokaler KI:** All-In-One ergänzt Intro, Strophe, Refrain und
weitere Abschnitte als ausdrücklich gekennzeichnete KI-Schätzung. Auf der
Musikseite „Songaufbau im Hintergrund verfeinern“ wählen; im DJ-Pult ist dies
standardmäßig aktiv und abschaltbar. Sobald die Basis-Show bereit ist, kann das
Lied spielen. Die zusätzliche Analyse läuft weiter und übernimmt ihren fertigen
Verlauf an der aktuellen Wiedergabeposition mit zwei Sekunden Lichtüberblendung.
Audio und Wiedergabezeit werden dabei nicht zurückgesetzt. Abschnitte beeinflussen
Farbfamilien, Sättigung, Helligkeitsbögen und die Auswahl musikalischer Akzente;
Beat This! bleibt für die erkannten Beat-Zeitpunkte zuständig.
Die manuelle Gestaltung auf der Musikseite behält Vorrang.

Die dabei ohnehin getrennten Demucs-Spuren (Schlagzeug, Bass, Gesang und übrige
Begleitung) liefern zusätzlich Pegelverläufe in 100-ms-Schritten. Es wird kein
zweiter Trennlauf gestartet. Die Show bewertet Intensität relativ zum gesamten
Song, unterdrückt rein gesangsbedingte Rhythmusimpulse bei wenig Schlagzeug und
reserviert Kontrast vor erkennbar stärkeren Abschnittseinsätzen. Abschnittsnamen
allein bestimmen damit nicht mehr, wie kräftig die Show ausfällt. Die Zuordnung
bleibt eine Gestaltungsheuristik, keine verifizierte Instrumententranskription.

Beat-, Stil- und Songaufbauanalyse haben kein automatisches Laufzeitlimit.
Sie laufen bis zum Abschluss, einem Fehler oder einem Abbruch. Manuelles Abbrechen,
Verbindungsabbruch und das Beenden der Anwendung stoppen laufende Berechnungen.
Analyse und Instrumentenverlauf werden mit der DJ-Show gespeichert. Bestehende
Shows werden wegen der neuen Planversion einmal neu berechnet.

```bash
bash scripts/install-structure.sh
```

Die separate CPU-Umgebung `.venv-structure/` verwendet `all-in-one-infer==3.1.0`
und `demucs-infer==4.2.2`; die bestehenden Beat-Modelle bleiben getrennt.
Der Installer lädt Harmonix- und Demucs-Gewichte nach `data/structure/` und
protokolliert Versionen und SHA-256-Dateiprüfsummen in `ready.json`. Die
Inferenz läuft anschließend ohne Modell-Downloads; Netzwerkverbindungen sind
im Python-Adapter gesperrt. Ein erster CPU-Test der rund 264 Sekunden langen
Beispiel-MP3 benötigte etwa 103 Sekunden reine Inferenz und lieferte 16 Abschnitte.
Das ist eine Einzelmessung; Abschnittsgrenzen sind nicht manuell verifiziert.

Der Browser sendet dekodiertes 44,1-kHz-Stereo-Audio an den lokalen AnyDj-Server.
Für diese Analyse werden PCM, WAV und Zwischenprodukte vorübergehend in einem
eigenen temporären Verzeichnis gespeichert und nach Abschluss oder Abbruch
entfernt. Ein hart beendeter Prozess kann temporäre Dateien hinterlassen.
Maximal ein Strukturauftrag gleichzeitig, 5 Sekunden bis 15 Minuten Audio,
ohne Laufzeitlimit; vier Ergebnisse bleiben im Server-Arbeitsspeicher.
Die DJ-Trackliste verarbeitet Basisanalysen und Strukturaufträge jeweils
nacheinander. Ergebnisse und Lichtpläne werden nach einem Seitenneuladen neu
berechnet (gegebenenfalls aus dem Server-Cache). Fehlende Modelle oder Fehler
lassen die Basis-Show verfügbar. Abwählen der Hintergrundanalyse bricht ihren
aktuellen Auftrag ab; „Stopp“ beendet nur die Wiedergabe.

Modellquelle: [All-In-One Inference](https://github.com/openmirlab/all-in-one-infer).
Der Inferenzcode steht unter MIT; die Harmonix-Modellgewichte unter
[CC-BY-NC-SA-4.0 laut Checkpoint-Konfiguration](https://github.com/openmirlab/all-in-one-infer/blob/main/src/allin1_infer/config/checkpoints.toml).

**Automatische Gestaltung ist der Standard.** Die vorbereitete Show wechselt
zwischen ruhigen Passagen, Klangbewegung, Aufbauten und rhythmischen Akzenten.
Das Beat-Raster liefert Zeitpunkte; Pegelanstiege, Bassanschläge und spektrale
Änderungen entscheiden, welche dieser Zeitpunkte eine Lichtreaktion erhalten.
Kräftige Refrains können auf dicht aufeinanderfolgende Anschläge reagieren;
Strophen werden zurückhaltender gestaltet. Das Grundlicht bleibt zwischen den
Impulsen erhalten. Konstante Töne werden nicht allein wegen eines Modellrasters
zum Dauerblinker. Digitale Stille bleibt auf Mindesthelligkeit.

Farbe reagiert wieder sichtbar auf Klangkontur und Anschläge: aktive Passagen
wechseln schneller zwischen verwandten Palettenfarben, ruhige Passagen langsamer.
Aufbauten entwickeln ihren Helligkeitsbogen über den Abschnitt. Es gibt keine
pauschale Sperre von 3,5 Sekunden zwischen Akzenten mehr. Die Auswahl und Stärke
hängen von Abschnitt und akustischen Merkmalen ab; starke Reaktionen bleiben
innerhalb der konfigurierten Helligkeitsgrenzen.

Die Basisanalyse arbeitet ohne All-In-One. KI-Songabschnitte ergänzen sie, wobei
ein energiegeladenes Intro nicht automatisch ruhig gestellt wird. Die Regeln
sind eine automatische Gestaltungsheuristik, keine garantierte musikalische
Choreografie. Live-Automatik verwendet weiterhin fließendes Licht; die hier
beschriebene Abschnittsgestaltung gilt für vorbereitete Shows und das DJ-Pult.

Unter **„Optional: selbst feinabstimmen“ → „Für dieses Lied manuell anpassen“**
werden die automatisch gewählten Werte übernommen und können bearbeitet werden.
Ausschalten stellt die Automatik wieder her. Ein neues Lied beginnt automatisch;
eine manuelle Gestaltung wird nicht unbemerkt auf das nächste Lied übertragen.
Wiedergabe-Einstellungen und Analysedetails sind zunächst eingeklappt. Der
Lichtshow-Editor bleibt für gezielte Eingriffe in einzelne Farbpunkte verfügbar.

Im **DJ-Pult → „Abschnittslicht“** am Deck oder **„Abschnitte“** in der Trackliste
lassen sich analysierte Songabschnitte einzeln gestalten. „Ruhig“, „Ausgewogen“
und „Intensiv“ setzen Akzentdichte, Bewegungsstärke und Farbverhalten; diese Werte
und die Farben sind auch einzeln editierbar. Grenzen und Teilungen rasten auf
erkannten Beats ein. Gleiche Motivgruppen können dieselben Lichteinstellungen
übernehmen; die vorgeschlagenen Gruppen sind keine bestätigte Motiverkennung.
„Speichern und anwenden“ übernimmt Änderungen auch bei laufender Wiedergabe und
speichert sie pro Track im Browser. Die Basisanalyse bleibt erhalten, sodass
keine Neuberechnung nötig ist. „Abbrechen“ verwirft ungespeicherte Änderungen.

Live-Audio wählt die Gestaltung aus den letzten Klangmerkmalen und bestätigt
Moduswechsel über zwei Bewertungen, um hektisches Umschalten zu vermeiden.

**Beat This! für vorbereitete Lichtshows:** In „Musik → Lichtshow vorab erstellen“
oder im Lichtshow-Editor unter „Analyse-Einstellungen“ lässt sich die
Beat-Erkennung zwischen „Beat This! · lokale KI“ und „Standard · schnelle Analyse“
umschalten. Beat This! erkennt Beats und Taktanfänge vor der Wiedergabe. Die
Automatik gewichtet diese Schläge nach Anschlägen, lokalem Groove und Stilverlauf.
Die manuelle Gestaltung behält die gleichmäßigen Beat-Impulse als bewusste
Option. Die Helligkeit wird zur tatsächlichen Wiedergabezeit berechnet,
unabhängig vom 125-ms-Raster der Farbkurve. Der Server leitet vorbereitete
Lichtbilder direkt nach Empfang weiter (höchstens zehn Befehle pro Sekunde,
ohne Warteschlange). Die Musikseite und das DJ-Pult reservieren Sendetermine
für die tatsächlich ausgewählten Akzente. Netzwerk, Browser-Timer und
Lampenreaktion bleiben begrenzende Faktoren.

Die optionale lokale Installation erfolgt aus dem Projektordner:

```bash
bash scripts/install-beat-this.sh
```

Der Installer benötigt Internetzugang, Python mit `venv` und installiert eine
eigene Umgebung in `.venv-beat-this/`. Getestet mit Python 3.14.4 unter Linux.
Das Modell `final0` wird einmalig nach `data/beat-this/final0.ckpt` geladen und
per SHA-256 geprüft. Danach läuft die Analyse offline. Die CPU-Installation ist
bewusst der Standard: Die Beispiel-MP3 mit rund 264 Sekunden benötigte auf dem
Entwicklungsrechner etwa fünf Sekunden einschließlich Python-/Modellstart.
Das ist ein Einzelmesswert, keine garantierte Laufzeit.

Der Browser überträgt für Beat This! bereits dekodiertes Mono-Audio an den
Rechner, auf dem AnyDj läuft – beim Zugriff vom Handy also über das lokale
Heimnetz. Es gibt keinen Cloud-Upload. Der Server speichert diese Audiodaten
nicht auf Platte. Maximal ein Lied wird gleichzeitig analysiert, bis zu
15 Minuten; vier erfolgreiche Ergebnisse bleiben im Arbeitsspeicher bis zum
Serverneustart. Datei-/Moduswechsel oder Schließen der Musikseite brechen eine
laufende Anfrage ab. Bei fehlender Installation, Fehlern oder einer belegten
Analyse wird sichtbar auf die Standard-Erkennung zurückgegriffen.

Farben und Melodieanalyse bleiben die bestehenden Verfahren. Beat This! erkennt
keine Strophen oder Refrains. Seine Zeitpunkte bleiben bei Änderungen der
Effektregler erhalten. Für einen direkten Vergleich die Beat-Erkennung beim
gleichen Lied wechseln; mehr erkannte Beats allein belegen keine bessere Qualität.

Optional lassen sich `ANYDJ_BEAT_PYTHON`, `ANYDJ_BEAT_MODEL` (lokale `final0`-Datei)
und `ANYDJ_BEAT_DEVICE=cpu|cuda|auto` konfigurieren. CUDA setzt eine separat passend
installierte GPU-Version von PyTorch voraus; der mitgelieferte Installer richtet
CPU-Betrieb ein. Der bestehende Node-Server benötigt keine neuen npm-Pakete.
Nach Aktualisierung des Servercodes den Server neu starten und die Seite neu laden.

Verfahren und Lizenz: [Beat This! – offizielles Repository](https://github.com/CPJKU/beat_this).

## Lokal starten

```sh
npm start
```

Öffne `http://127.0.0.1:3030/`. Du landest direkt im DJ-Pult. Mit `npm run demo`
startest du ohne Hardwareausgabe. Für echte Lampen nutzt du DMX über den separat
installierten OLA-Dienst. Lichtshows, Raumplanung und Full funktionieren auch
ohne angeschlossene Hardware.

`npm run dev:https` startet mit lokalem HTTPS. `npm run lan` macht die App im
Heimnetz erreichbar. Verwende die im Terminal angezeigte Rechneradresse.

## Konfiguration

| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` | `3030` | Lokaler Serverport |
| `HOST` | `127.0.0.1` | Bind-Adresse; `--lan` verwendet `0.0.0.0` |
| `ANYDJ_WEB_TOKEN` | leer | Optionaler Web-Zugangscode mit mindestens 20 Zeichen; Eingabe direkt im DJ-Pult |
| `ANYDJ_DATA_DIR` | `./data` | Lokale Serverdaten, etwa die VR-Kopplung |
| `ANYDJ_BEAT_PYTHON` | `.venv-beat-this/bin/python` | Python für die Beat-Analyse |
| `ANYDJ_BEAT_MODEL` | `data/beat-this/final0.ckpt` | Lokales Beat-Modell |
| `ANYDJ_BEAT_DEVICE` | `cpu` | Analysegerät: `cpu`, `cuda` oder `auto` |

`.env`-Dateien werden nicht automatisch geladen. Setze Variablen in deiner Shell
oder Prozessverwaltung. Zugangscodes gehören nicht ins Repository.

## Lokale API

`/api/meta` liefert den App-Status. Musikanalyse verwendet `/api/analysis/beats`,
`/api/analysis/style` und `/api/analysis/structure`. Hardwareausgabe liegt unter
`/api/dmx/*`, die VR-Übertragung unter `/api/vr-preview/*`. Schreibzugriffe benötigen
`X-AnyDj-Local: 1`; ein konfigurierter Zugangscode wird als Bearer-Token übergeben.

Die frühere WLAN-Lampensteuerung und ihre Such-, Geräte- und Musik-Endpunkte
sind entfernt. Alte Gerätedateien bleiben unangetastet und werden nicht geladen.
Bestehende Bibliotheken und Einstellungen werden auf die aktuellen AnyDj-
Bezeichnungen übernommen. Tracks, Setlisten, Lichtshows und eigene Anpassungen
bleiben dabei erhalten; neuere Einträge werden nicht überschrieben.

## Tests und Entwicklung

```sh
npm test
npm run dev
```

Die Tests nutzen lokale Server und simulierte DMX-Ausgänge. Echte Hardware wird
dabei nicht angesprochen. Frontend-Änderungen werden nach dem Neuladen sichtbar.

### Zusammenhängender Liedverlauf

Die vorbereitete Show verwendet zusammenhängende Abschnitte aus relativer Energie, Bassanteil und Klanghelligkeit. Klanglich ähnliche wiederkehrende Abschnitte erhalten dieselbe Farbfamilie. Innerhalb einer Passage bleibt die Farbe zusammenhängend und reagiert auf Klangveränderungen; eine ununterbrochene zeitgesteuerte Farbkreiswanderung entfällt. Klangveränderungen und Steigerungen beeinflussen die Farbgestaltung; die Helligkeit bleibt an Beats gebunden. Übergänge nehmen den kürzeren Weg durch die Palette. Die Abschnittserkennung ist weiterhin heuristisch und bezeichnet keine sicher erkannten Strophen oder Refrains.

Im Live-Disco bleiben Timing und Helligkeit der Beat-Akzente erhalten. Farbwechsel erfolgen weich nach jeweils acht erkannten Schlägen. Diese Gruppierung ist keine Erkennung der Takt-Eins oder einer musikalischen Phrase; für die Berücksichtigung des ganzen Liedverlaufs dient die Vorab-Show.


### Trennung von Beat-Helligkeit und Ton-Farbverlauf

Die Vorab-Show setzt jeden erkannten Beat auf einen Helligkeitsakzent und lässt ihn anschließend zur Mindesthelligkeit abklingen. Die mittlere Lautstärke, Tonhöhe und Farbglättung beeinflussen die Grundhelligkeit nicht. Empfindlichkeit und Helligkeitskurve formen weiterhin die Beat-Hüllkurve.

Für die Farben wird zusätzlich der dominante Tonanteil im Bereich 180–1800 Hz geschätzt, damit tiefer Bass die Tonhöhensteuerung weniger dominiert. Ein geglätteter Verlauf kombiniert diese Schätzung mit der Klanghelligkeit und passt die Farbauslenkung an das ganze Lied an. „Klangfarben folgen“ mischt diese Tonsteuerung mit den wiederkehrenden Farbfamilien. Die Erkennung ist keine vollständige Transkription einer isolierten Gesangsmelodie.

Kurze Schwankungen um eine Lautstärkeschwelle erzeugen keine sofortige neue Farbfamilie mehr. Anhaltender Rückgang des Bassanteils hilft, ruhigere Zwischenstücke trotz komprimierter Gesamtlautstärke zu unterscheiden.

### Zusätzliche Soundmerkmale der Vorab-Show

Die Lichtgestaltung berücksichtigt zusätzlich fünf normalisierte Frequenzbereiche (40–180, 180–500, 500–1500, 1500–3500 und 3500–6000 Hz), ein Profil aus zwölf Tonklassen, spektrale Flachheit, die Frequenzgrenze von 85 % der Spektralenergie und positive Änderungen der Frequenz- und Tonklassenverteilung. Diese Merkmale beschreiben Klanganteile; sie trennen keine Instrumente und erkennen keine benannten Akkorde.

Frequenzbalance, harmonische Verteilung und Tonkontur lenken gemeinsam die Farbposition. Tonalität, mittlere/hohe Frequenzanteile und geräuschhafte Textur beeinflussen die Sättigung. Deutliche spektrale Wechsel beschleunigen den geglätteten Farbübergang. Harmonische Ähnlichkeit verbessert zudem die Zuordnung wiederkehrender Farbfamilien. Die Helligkeit bleibt ausschließlich an die unveränderten Beat-Ereignisse gebunden. Während der Show erscheint eine kurze Beschreibung der aktuell dominanten Klangmerkmale.

Die vorbereitete Show zeigt „Klangfarben V2“ und den berechneten Farbverlauf des
Liedes. Die kombinierte Klangkurve wird am gesamten Lied kalibriert, damit auch
die Randfarben der gewählten Palette genutzt werden. Sättigung bleibt nahe am
eingestellten Wert. Die Anzeige unter dem Verlauf zeigt die zuletzt an den
Server übergebenen RGB- und Helligkeitswerte. Die Helligkeit bleibt ausschließlich
beatgesteuert. Live-MP3 und Rechner-Audio verwenden weiterhin ihren Live-Effekt;
der Wechsel zu Rechner-Audio überschreibt die gespeicherte MP3-Moduswahl nicht.

Live-Klangbild: Rechner-Audio, Tab-Audio und Live-MP3 analysieren jetzt zusätzlich
alle 80 ms das Stereo-Spektrum. Fünf Frequenzanteile, dominante Tonanteile,
Klanghelligkeit, harmonischer Schwerpunkt, Geräuschhaftigkeit und Klangwechsel
werden unter „Klangbild“ angezeigt. Im Live-Disco- und Farbverlauf-Modus steuern
sie die Farbposition und Übergänge; „Klangfarben folgen“ regelt ihren Einfluss.
Disco-Helligkeit und Beat-Erkennung bleiben davon unabhängig. Die Analyse trennt
keine Gesangsstimmen oder Instrumente. Die Prozentwerte sind spektrale Merkmale,
keine Wahrscheinlichkeiten für bestimmte Instrumente.

**Melodieverlauf in der Vorab-Show (Klangfarben V3):** Die MP3-Analyse verfolgt
harmonisch gestützte Tonhöhenkandidaten über das ganze Lied. Eine kontinuierliche
Tonspur steuert eine geordnete Farbpalette: aufwärts, abwärts und gehaltene Töne.
Unsichere Stellen halten die letzte Farbposition. Pausen und Gruppen von acht
Beats liefern mögliche Phrasengrenzen; ähnliche zeitliche Tonkonturen werden als
Motivkandidaten verglichen und erhalten bei Wiederholung denselben Farbverlauf,
auch bei Transposition. Das ist eine Schätzung aus dem Mix, keine Trennung von
Gesang/Instrumenten oder garantierte Erkennung der führenden Melodie.

Über der Farbvorschau zeigt eine Kurve die nutzbaren Tonsegmente mit Lücken bei
Unsicherheit. Der Prozentwert bezeichnet die zeitliche Abdeckung, nicht die
Erkennungsgenauigkeit. Helligkeit und erkannte Beats bleiben unabhängig von der
Tonspur. Die musikalische Partitur (`score`: Tonspur, Noten, Phrasen, Motive)
enthält keine AnyDj-Befehle; erst der Renderer erzeugt daraus die RGB-Bilder für
eine Lampe. So können spätere Lichtanlagen dieselbe Partitur verwenden. Live-
Audio bleibt bei der bisherigen kausalen Spektralanalyse ohne Vorab-Motivsuche.

Effektregler können auch während einer vorbereiteten Show geändert werden.
Nach einer kurzen Bündelung schneller Eingaben wird der Lichtverlauf mit den
bereits analysierten Audiodaten in einem Hintergrund-Worker neu berechnet.
Der Player läuft weiter; die Show übernimmt die neue Version an seiner aktuellen
Position, nachdem der Server die zugehörigen Einstellungen angenommen hat.
Stimmung bleibt in der Vorab-Show ohne Funktion; Datei, Quelle und Lampe werden
weiterhin vor dem Start gewählt. Einstellungen bleiben im Browser gespeichert.

**Klangfarben V4:** Die Vorab-Show kombiniert die Melodiespur mit dem Klangbild.
Eine sichere Tonspur führt, kurze Erkennungslücken werden etwa 300 ms überbrückt.
Bei längerer Unsicherheit geht ihr Einfluss weich zurück und die spektrale
Klangauswertung übernimmt. Nur tatsächliche Pausen halten die Farbposition
unabhängig vom Spektrum fest. Dies ersetzt das durchgehende Halten unsicherer
Passagen in V3. Unter der Vorschau steht, ob Melodie, Klangbild, eine Mischung
oder eine Pause den aktuellen Verlauf bestimmt. Beat-Helligkeit und Partitur
bleiben unverändert; bestehende Einstellungen werden weiterverwendet.

**Stimmungsmodus (Klangfarben V5, Vorab-Show):** Unter „Stimmungsmodus“ die Option
„An · Farben nach musikalischer Stimmung“ wählen. Der Modus ist zunächst aus,
bleibt im Browser gespeichert und kann während der Wiedergabe umgeschaltet werden.
Tonklassenprofile werden über etwa acht Sekunden gesammelt und mit einfachen
Dur-/Moll-Profilen verglichen. Energie, erkanntes Tempo und Klangwechsel ergänzen
diese Tendenz. Zwei aufeinanderfolgende Bewertungen bestätigen eine neue Palette;
die Farbanker blenden über mehrere Sekunden über. Bei unklarer Tonart bleibt die
letzte Stimmung bestehen, zu Beginn die gewählte Startpalette.

Die gestalterischen Zuordnungen sind: warm/gold/pink für Dur-Tendenzen, blau/
violett für ruhigere Moll-Tendenzen, violett/pink/rot für energiereichere Moll-
Tendenzen. Sie sind eine Heuristik und keine zuverlässige Erkennung menschlicher
Gefühle. „Tonart unklar“ und „Palette beibehalten“ machen Unsicherheit sichtbar.
Die aktuelle Stimmung steht unter dem Schalter. Melodieverlauf, Klangreaktion,
Sättigungsregler und Beat-Helligkeit bleiben wirksam. Live-Audio verwendet diesen
Vorab-Modus nicht; dort ist der Schalter deaktiviert.

## Lichtabschnitte bearbeiten

Öffne im DJ-Pult bei einem analysierten Titel „Abschnittslicht bearbeiten“.
Dort kannst du Farben, Helligkeit und Übergänge im Songverlauf anpassen und
in der Bühnenvorschau prüfen. Deine Änderungen werden pro Titel gespeichert.

### Website und Desktop-Apps gemeinsam deployen

```sh
npm run deploy:full
```

Baut die vollständige native Desktop-App inklusive KI-Modellen, stellt die
Installer mit Prüfsummen auf der eigenen Downloadseite bereit und veröffentlicht
Website und Pakete über das bestehende FTPS-Deployment. Build-Voraussetzungen
und Windows-Übernahme: [vollständiger Deploy-Ablauf](builder/README.md#website-und-vollständige-desktop-apps-gemeinsam-veröffentlichen).
Mit `-- --reuse-analysis --dry-run` werden vorhandene KI-Laufzeiten verwendet
und die Veröffentlichung ausgelassen.

### Desktop-Anwendung / Installer

Alle drei Betriebssysteme vom Linux-Rechner aus nativ bauen:

```sh
pnpm run deploy:all
```

Synchronisiert den aktuellen Projektstand per SSH auf Mac und Windows, baut
parallel vollständige Desktop-Apps mit lokaler KI, holt geprüfte Installer
nach `.build/desktop-downloads/` zurück und veröffentlicht sie auf der Downloadseite. Einrichtung und dauerhafte
SSH-Anmeldung: [SSH-Builds für alle drei Systeme](docs/deploy-all.md).
`pnpm run sync:all` überträgt nur die Quellen; `pnpm run deploy:all:check`
prüft die Verbindungen und Werkzeuge. `--build-only` baut ohne Upload;
`pnpm run deploy:downloads` veröffentlicht vorhandene Installer ohne neue Builds.

Einzelne Installer auf dem jeweiligen Build-Rechner:

```sh
npm ci
npm run pack -- --linux  # AppImage und .deb
npm run pack -- --win    # Windows-Setup.exe; bevorzugt auf Windows bauen
```

Die Dateien entstehen unter `dist/`. `npm run pack` wählt das aktuelle
Betriebssystem. Für das vollständige Paket zuerst `npm run pack:analysis` in den eingerichteten
Analyseumgebungen ausführen. `pack` enthält dann lokale KI-Laufzeiten und Modelle;
eine Basisversion ohne KI erfordert ausdrücklich `--lite`.
Details, Build-Voraussetzungen und Grenzen: [Desktop-Pakete](desktop/README.md).

### Web-Demo ohne Serveranalyse

`npm run build:web` erstellt eine statische Startseite mit DJ-Demo unter
`dist/web/`. `npm run preview:web` öffnet einen lokalen Vorschau-Server auf
Port 4173. Zum Hosten den Inhalt von `dist/web/` auf HTTPS-Webspace hochladen.
Die Analyse läuft im Browser; weder KI-Modelle noch Musik-Uploads sind nötig.
Die Web-Version zeigt eine Lichtvorschau, steuert aber keine echten Lampen.
[Web-Build und Hosting](web/README.md).

### DJ-Werkzeuge und zentraler Mixer

Das Pult ordnet Deck A links, Lichtbühne und Mixer mittig sowie Deck B rechts
an. Das Bühnenfenster öffnet sich ebenfalls mittig. Auf schmalen Displays
stehen die Bereiche in derselben Reihenfolge untereinander.

- Audio-Wellenform mit Abspielposition und Hotcue-Markierungen. Der mittlere
  Signalpegel (RMS) wird kräftig dargestellt, kurze Spitzen liegen als dezente
  Hülle dahinter. Eine gemeinsame Skalierung pro Titel verhindert abgeschnittene
  Spitzen; laute Passagen behalten erkennbare Energieunterschiede. Alte
  Wellenformdaten werden beim Laden der Audiodatei automatisch ersetzt. Der kleine
  Lichtverlauf bleibt separat erhalten. BPM und Restzeit berücksichtigen das Tempo.
- Tempo ±16 %, Tonhöhe halten und einmaliges Sync zum laufenden anderen Deck.
  Manuelles Tempo ist unabhängig von musikalischen Übergängen. Nur der ausdrücklich
  betätigte Sync passt das Tempo an; er benötigt ein passendes Beat-Raster.
- Vier gespeicherte Hotcues pro Track: leere Marke setzen, belegte anspringen.
  Shift-Klick oder „Löschen“ und anschließende Markenwahl entfernt eine Marke.
- Beat-Loops mit 1/2/4/8/16 Beats und Sprünge um vier Beats. Aktive Loops
  unterdrücken den automatischen Crossfade des betreffenden Decks. Manuelle
  Sprünge beenden den Loop und pausieren die Warteschlangenautomatik.
- Gain und Dreiband-EQ pro Deck; Kanalpegel vor dem Fader, Masterlautstärke,
  Masterpegel vor der Dynamikbegrenzung und Übersteuerungsanzeige.
- Vorhören vor dem Kanalfader und Crossfader auf einem getrennten Ausgang:
  unter „Audioausgänge & Vorhören“ zuerst Master, dann Kopfhörer wählen.
  Browserabhängig über native Geräteauswahl oder bereits freigegebene Ausgänge.
  Gleiche oder Standard-Ausgänge sind als Kopfhörerpaar nicht zulässig.
  Nach einer Geräteänderung die Ausgänge erneut wählen. Es gibt kein automatisches
  Zurückfallen des Vorhörsignals auf den Master.
- Master-Mix als WebM/Opus oder Ogg/Opus aufnehmen und herunterladen. Aufnahme
  enthält den Mix nach der Dynamikbegrenzung, ohne Kopfhörersignal. Höchstens
  zwei Stunden bzw. ungefähr 128 MB pro Aufnahme; vor einer weiteren Aufnahme
  die vorherige herunterladen. Beim Verlassen mit laufender oder noch nicht
  heruntergeladener Aufnahme greift die Browser-Rückfrage.
- Tastenkürzel: A = Q/W und 1–4, B = O/P und 7–0 für Play/Cue/Hotcues.
  Shift + Ziffer löscht einen Hotcue; Texteingaben und Dialoge bleiben ausgenommen.

„Abschnittslicht“ liegt nun beim jeweiligen Deck im Farbmodus-Menü.
Die Lichtshow nutzt weiterhin die Songanalyse und den Crossfader; EQ und Gain
ändern das Audiosignal, nicht die vorbereiteten Lichtfarben.

Die Loops beruhen auf zeitgesteuerten Sprüngen im Browser-Audioplayer. Sie sind
nicht samplegenau; Hintergrund-Drosselung kann ihre Genauigkeit beeinträchtigen.
Die Dynamikbegrenzung ist ein Kompressor, kein garantierter True-Peak-Limiter.
Mehrkanal-Soundkartenrouting, MIDI/HID-Controller, Jogwheel/Scratch, DVS,
Stems und Effektketten sind noch nicht implementiert. Vorhören wurde mit
simulierten Ausgangs-IDs geprüft, nicht mit zwei physischen Audiogeräten.

### Mehrere Warteschlangen und gespeicherte Listen

Im Warteschlangenbereich wählst du zwischen der **aktuellen Warteschlange** und
beliebigen benannten Listen. „+ Neue Liste“ erstellt eine leere Liste; den Namen
kannst du direkt bearbeiten. Einreihen aus der Bibliothek, „Alle einreihen“,
Verschieben und Entfernen wirken auf die gerade ausgewählte Liste.

Mit „Als Liste speichern“ sicherst du die noch ausstehenden Titel der aktuellen
Warteschlange als wiederverwendbare Liste. Änderungen an benannten Listen werden
automatisch auf diesem Gerät gespeichert; „Liste speichern“ speichert zusätzlich
explizit. Der Speicherstatus zeigt Erfolg oder Fehler an.

Während eine Warteschlange läuft, kannst du eine andere Liste vorbereiten.
Das Wechseln der Ansicht verändert die Wiedergabe nicht. „Liste starten“ kopiert
die gespeicherten Titel in die aktuelle Warteschlange. Ein bereits laufender
Titel spielt weiter, anschließend folgt die neue Reihenfolge. Während eines
laufenden Crossfades ist dieser Wechsel gesperrt. Die gespeicherte Liste bleibt
vollständig erhalten, auch wenn ihre Wiedergabekopie bereits abgearbeitet wurde.

Listen, Namen und ausgewählte Ansicht bleiben nach dem Neuladen gespeichert;
Musik startet niemals automatisch. Die bisherige einzelne Warteschlange bleibt
als aktuelle Warteschlange erhalten. „Liste löschen“ entfernt nur die benannte
Vorlage, nicht die laufende Kopie oder Musikdateien. Speichern umfasst lokale
Track-Verweise, keine Kopien der Audiodateien. Nach einem Neustart müssen Dateien
gegebenenfalls erneut freigegeben/verknüpft werden. Die Speicherung gilt pro
Browserprofil bzw. lokaler App; es gibt keinen Cloud-Abgleich.

### Warteschlange als MP3 und Lieder schneiden

**„Als MP3 exportieren“** exportiert alle beim Öffnen angezeigten Einträge der
aktuellen Warteschlange oder ausgewählten Setliste in ihrer Reihenfolge,
inklusive mehrfach eingereihter Titel. Bereits aus der Warteschlange verbrauchte
Titel gehören nicht dazu. Der Export beginnt von vorn und verändert die laufende
Wiedergabe oder Warteschlange nicht. Gespeicherte Set-Übergänge mit eigenen
Lautstärkekurven und Bassübergaben werden übernommen; für andere Paare gelten
die aktuellen Automatikeinstellungen. Ein einzelner Titel wird vollständig mit
seinen Schnitten exportiert, ohne zusätzlichen End-Crossfade.

Im Exportdialog stehen 192 und 320 kbit/s, Fortschritt, Abbrechen und anschließend
**„MP3 herunterladen“** bereit. Die Berechnung läuft lokal mit kurzen Audioblöcken
und einem separaten MP3-Worker. Es werden die gerade benötigten Titel dekodiert,
nicht das gesamte Set auf einmal. Lange Einzeltitel benötigen dennoch entsprechend
Arbeitsspeicher; die komprimierte MP3 bleibt bis zum Schließen im Speicher.
Die Web-Version benötigt dafür keine zusätzliche Installation. Exportpegel ist
80 % mit Begrenzer; Live-EQ, Masterregler, manuelle Loops und spontane Deckaktionen
sind kein Teil dieses vorberechneten Exports.

**„Lied schneiden“** ist in den Titelaktionen der Bibliothek, an den Einträgen
der Warteschlange und unter „Deck einstellen“ erreichbar. Auf der Wellenform
ziehen oder Von/Bis eingeben, dann „Bereich entfernen“ wählen. Ein einfacher Klick
auf die Wellenform setzt die Hörposition, ohne die Auswahl zu verändern. Mit
←/→ lässt sie sich um eine Sekunde verschieben, mit Shift um fünf Sekunden.
Unter „Probehören“ kann eine genaue Position im gewählten Zeitformat eingegeben
und mit „Springen“ oder Enter angesprungen werden; −5 s/+5 s dienen zum schnellen
Navigieren. Die Hörprobe startet anschließend dort. Entfernte Bereiche werden
übersprungen. Unter
„Format“ direkt neben Von/Bis lässt sich zwischen Sekunden (z. B. `90,5`) und
Minuten:Sekunden (z. B. `1:30,5`) wechseln. Vorhandene Werte werden automatisch
umgerechnet; die bevorzugte Eingabeart wird auf diesem Gerät gemerkt. Komma
und Punkt sind für Nachkommastellen möglich.
Die Wellenform hat eine Zeitachse in Minuten:Sekunden. Auswahl und Vorschau zeigen
zusätzlich genaue Zeitwerte; Originalposition und bearbeitete Position werden
nebeneinander angezeigt. Songabschnitte können ebenfalls ausgewählt werden.
Mehrere Schnitte, Wiederherstellen einzelner Bereiche, Rückgängig und vollständiges
Zurücksetzen sind möglich.

Die Bereiche „Bereich auswählen“, „Deine Schnitte“ und „Probehören“ bündeln die
jeweiligen Bedienelemente. Die Schnittliste zeigt entfernte Bereiche und die
resultierende Lieddauer. Speichern und Abbrechen bleiben beim Scrollen erreichbar;
Speichern wird erst bei Änderungen aktiv.
Im Übergangsmanager öffnet „Lied schneiden“ am jeweiligen Titel denselben Editor
direkt im Fenster. „Schnitte anwenden“ speichert die Änderungen für den Titel und
aktualisiert Wellenform und Hörprobe. Der gewählte Übergang bleibt erhalten;
Songstellen und Dauer werden bei Bedarf an die hörbaren Bereiche angepasst.
Den aktualisierten Übergang anschließend probehören und übernehmen.
Die Übergangsfläche lässt sich auch direkt in der Wellenform über rote, entfernte
Passagen ziehen. Nur die benötigten Teile der Überblendung werden für die Hörprobe
wieder hörbar und grün markiert. „Übergang & Schnitte übernehmen“ speichert diese
Wiederherstellung zusammen mit dem Übergang; Schließen verwirft sie. Beim weiteren
Verschieben zählt ausschließlich die endgültige Position, nicht der Weg dorthin.
Betroffene Titel in den Decks müssen zum Speichern pausiert sein.
**„Optimieren“** vergleicht im Hintergrund mehrere Tausend Kombinationen aus
Songstellen, Überblendlängen und Übergangsarten. Die musikalische Bewertung teilt
der Editor mit der automatischen Übergangsplanung: Gesangsüberschneidungen,
konkurrierende Bässe, Energieverlauf, Beat- und Taktgrenzen, Songabschnitte und
vorhandene Tonartschätzungen fließen ein. Gemessene Audiopegel ergänzen den Vergleich.
Die Suche darf die gewählte Stelle deutlich verschieben, bleibt aber in ihrer
Umgebung (bis zu 48 Sekunden zurück und 32 Sekunden vorwärts). Eigene
Lautstärkekurven bleiben erhalten. Fehlende Instrumentendaten werden angezeigt;
Beat-, Abschnitts- und Wellenformdaten erlauben weiterhin eine eingeschränkte Suche.
Die Berechnung ist abbrechbar und verändert weder die laufenden Decks noch
gespeicherte Übergänge, bis das Ergebnis übernommen wird.

Im Schnittmanager optimiert **„Übergänge optimieren“** alle inneren Schnittstellen
gemeinsam als Entwurf. Jede Suche bleibt in den zwei angrenzenden, erhaltenen
Liedteilen; entfernte Passagen werden dabei nicht zurückgeholt. Vorhandene
Nachbarüberblendungen begrenzen den verfügbaren Platz. Schnittgrenzen können
für einen passenden Einsatz weiter gekürzt werden. Einmal „Rückgängig“ verwirft
die gesamte gemeinsame Optimierung. Einzelne Schnittübergänge lassen sich
zusätzlich im Übergangsmanager optimieren. Anschließend probehören und speichern.
Mit „Auswahl wiederherstellen“ lassen sich auch nur markierte Teilbereiche eines
Schnitts zurückholen. „Änderungen verwerfen“ kehrt zum Übergang zurück, ohne den
Schnittentwurf zu speichern.

**„Mit Übergang entfernen“** öffnet den Übergangsmanager für die Verbindung
zwischen dem erhaltenen Teil vor und nach einem inneren Schnitt. Das geht direkt
für eine markierte Auswahl oder über „Übergang gestalten“ am Eintrag eines bereits
entfernten Bereichs.
Überblenddauer, sanfte Überblendung, Bassübergabe, kurze Überlagerung und eigene
Lautstärkekurven sind wie bei Titelübergängen verfügbar. „Übergang übernehmen“
aktualisiert den Entwurf; „Schnitte speichern“ speichert ihn für die Wiedergabe und
den MP3-Export. Mit „Ohne Überblendung“ bleibt die Schnittstelle als einfacher
Sprung erhalten. Intro und Ende werden gekürzt; ein Schnittübergang braucht
hörbare Teile auf beiden Seiten. Überblendungen überlappen diese Teile und
verkürzen die bearbeitete Gesamtdauer zusätzlich. Benachbarte Überblendungen
dürfen sich nicht gegenseitig überdecken. Die Hörprobe verwendet den gewählten
Vorschauausgang. Zum Speichern muss der betreffende Titel in beiden Decks
pausiert sein.

Schnitte verändern keine Originaldateien und gelten für den Bibliothekstitel in
allen Listen. Sie bleiben auf diesem Gerät gespeichert. Die Wiedergabe überspringt
diese Bereiche; die Lichtshow folgt weiterhin der Originalposition im Lied.
Auch der Übergangseditor berücksichtigt diese Schnitte bei Vorschlägen,
Beat-Anpassung und der Auswahl von Songstellen und Überblenddauer. Entfernte
Bereiche sind in der vollständigen Wellenform rot markiert. Die Hörprobe
überspringt Schnitte im Vor- und Nachlauf; die Überblendung bleibt innerhalb
erhaltener Liedteile.
Im Export werden die Bereiche herausgerechnet und interne Schnittkanten über
5 ms geglättet. Gespeicherte Übergänge, die gelöschte Teile überdecken, müssen
neu bearbeitet oder entfernt werden. Zu kurze Titel mit überlappenden Ein- und
Ausblendungen werden mit einer Erklärung abgewiesen.

Voraussetzung sind vorbereitete, verfügbare lokale Audiodateien. Streaming-Einträge
und gespeicherte Übergänge mit verändertem Tempo werden derzeit mit einer
Erklärung abgewiesen. Der MP3-Encoder ist das separat eingebundene, unveränderte
[lamejs 1.2.1](https://github.com/zhuker/lamejs); Lizenz und lesbarer Encoderquelltext
sind im Exportdialog verlinkt. Browser-Abnahme: `node scripts/check-queue-export.mjs`.

### Vereinfachte DJ-Oberfläche

Die Grundansicht zeigt pro Deck Wiedergabe, Cue, Wellenform und Lautstärke.
„Weitere Aktionen“ enthält Cue setzen und Entladen. „Mix-Werkzeuge“ öffnet
Tempo, Hotcues, Loops, Klang und Vorhören; aktive Loops, Vorhören und abweichendes
Tempo bleiben in der Zusammenfassung sichtbar. „Lichtgestaltung“ bündelt
Farbmodus, Abschnittslicht und den separaten Lichtverlauf.

Der zentrale Mixer gliedert sich in Lichtshow, Überblenden und Master.
Übergangsdauer und musikalische Startauswahl stehen unter „Automatik einstellen“.
Audioausgänge, Aufnahme und Tastenkürzel liegen unter „Audio & Aufnahme“;
laufende und fertige Aufnahmen bleiben an dessen Überschrift erkennbar.

In der Bibliothek gibt es pro Titel „+ Warteschlange“ und „Mehr“. „Mehr“ enthält
beschriftete Aktionen zum Laden auf Deck A/B sowie Analyse und Verwaltung.
„Musik hinzufügen“ bündelt Datei- und Ordnerzugriff. Gespeicherte Listen werden
weiterhin direkt ausgewählt; Erstellen, Speichern, Umbenennen und Löschen liegen
unter „Liste verwalten“. Beim Erstellen öffnet sich die Namenseingabe automatisch.


Der DJ-Arbeitsstand wird automatisch lokal im Browser gespeichert: beide Decks mit Track,
Position und Cue sowie Lautstärke, manuelles Tempo, Tonhöhenhaltung, EQ, Loop-Länge,
Crossfader, Master-/Kopfhörerlautstärke und Übergangseinstellungen. Nach einem Reload
bleibt die Wiedergabe pausiert; aktive Loops, Vorhören und Aufnahmen werden nicht gestartet.
Musikdateien werden dadurch nicht kopiert. Besteht der Lesezugriff auf eine verknüpfte
Datei noch, wird sie automatisch wieder geladen. Andernfalls bietet das Deck
**Datei verbinden** an; nach Auswahl derselben Datei bleibt die gespeicherte Position erhalten.
Der Stand gehört zum jeweiligen Browserprofil und zur verwendeten App-Adresse;
beim Löschen der Browserdaten geht er verloren.


Titel lassen sich über **+ Warteschlange** direkt aus der Bibliothek einreihen.
Die Vorbereitung läuft auch ohne gestartete Wiedergabe: Eine laufende Analyse wird
abgeschlossen, danach haben geladene Decks und die Titel der aktuellen bzw. gerade
bearbeiteten Warteschlange Vorrang vor der übrigen Bibliothek. Basis- und zusätzliche
Songaufbau-Analyse laufen nacheinander. Auch Ordner-Titel werden dafür vorab gelesen,
soweit der Browser den Dateizugriff bereits erlaubt. Fehlender Zugriff wird am Titel
angezeigt; andere Titel können weiter vorbereitet werden. Bereits berechnete Shows
werden wiederverwendet. Die tatsächliche Bereitschaft hängt von Dateizugriff und
Rechenzeit ab; Einreihen allein startet keine Wiedergabe.

**Spotify-Bibliothek:** Tabs für lokale Dateien und Spotify, Konto-Anmeldung per
PKCE, eigene Playlists, Lieblingssongs, Katalogsuche und Playlist-Links. Unter
„Mehr → Datei zuordnen“ Spotify-Titel mit eigenen Audiodateien verbinden; unter
„Set vorbereiten“ zugeordnete Titel einreihen oder als DJ-Liste speichern.
Spotify-Titel spielen mit Premium über den Spotify-Player in den Decks und
können mit lokalen Dateien in derselben Warteschlange stehen. Spotify-Titelwechsel
erfolgen ohne Crossfade; Audioanalyse und Aufnahme verwenden lokale Dateien. Eine Spotify Client ID und konfigurierte Redirect URI sind nötig:
[Einrichtung](SETUP.md#spotify-in-der-dj-bibliothek).

### Feste Setlisten mit vorbereiteten Übergängen

Im Warteschlangenmenü erstellt „+ Feste Setliste“ eine dauerhaft gespeicherte Liste.
Titel bleiben beim Abspielen sichtbar und werden als laufend oder bereits gespielt
markiert. Die Wiedergabe nutzt eine eigene Kopie; Änderungen an der Setliste gelten
beim nächsten Start und verändern den laufenden Auftritt nicht.

Ab dem zweiten lokalen, analysierten Titel öffnet „Übergang anlegen“ den
Diagrammeditor für das vorherige Titelpaar. Vorbereitung und Kopfhörer-Hörprobe
belegen keine Live-Decks. „Übergang übernehmen“ speichert Start, Einstieg, Dauer,
Übergangsart und eigene Kurvenpunkte mit der Liste auf diesem Gerät. Beim
Set-Start werden diese Pläne automatisch verwendet. Geänderte Nachbarpaare oder
unpassende Titellängen müssen erneut geprüft werden. Spotify-Paare unterstützen
keine lokalen Übergangskurven. Nach einem Neustart gegebenenfalls die Originaldateien
wieder verbinden; die Setliste enthält keine Kopie der Audiodateien.

### Klangabhängige Farbwelten (Versuch)

Im automatischen Farbmodus „Songanalyse“ entstehen die Paletten aus Bass- und
Höhenanteilen, Klanglage, Textur und tonaler Sicherheit des Audiosignals.
Der gesamte Track gibt eine gemeinsame Farbwelt vor; die einzelnen Abschnitte
entwickeln sie weiter. Palettenübergänge werden geglättet. Identische Analysedaten
liefern identische Farben, ohne Zufall, Songtitel-Zuordnung oder Songpaare.
Die Zuordnung von Klang zu Farbe ist eine gestalterische Interpretation.

Rhythmische Farbwechsel verwenden diese aktuelle Palette. Lichtbühne und Full
übernehmen sie ebenfalls, statt daraus immer dieselben Farbtonabstände zu
konstruieren. Die vier Full-Flächen bleiben; sie können bei einer bewusst
gewählten Einzelfarbe auch dieselbe Farbe zeigen. Manuelle Track-Paletten und
Abschnittsfarben haben Vorrang. Für alte Tracks die Lichtshow neu berechnen;
die Show-Cache-Version wurde auf 18 erhöht. Keine erneuten Modelldownloads nötig.

### Farbprofil als Cover-Ersatz

Lokale Titel ohne nutzbares eingebettetes Cover erhalten nach der Showberechnung
in der Bibliothek einen Farbverlauf als Cover-Ersatz. Er fasst bis zu sechs
ähnliche Farbgruppen der effektiven Lichtshow zusammen; ihre Breite entspricht
ungefähr ihrem Anteil an der sichtbaren Zeit, nicht ihrer Helligkeit. Kurze weiche
Übergänge verbinden die Gruppen. Es ist eine Farbverteilung, keine Zeitleiste.
Blackouts werden ausgelassen. Der Tooltip nennt die ungefähren Zeitanteile.

Vorhandene Cover haben Vorrang, auch wenn sie erst nachträglich eingelesen werden.
Ohne Show oder bei ausschließlich dunklen Bildern wird kein Profil erfunden.
Änderungen an Track- oder Abschnittsfarben werden bei der nächsten Darstellung
aus dem neuen Showplan übernommen. Profile werden nur im Arbeitsspeicher pro Plan
zwischengespeichert; es gibt keine Bildsuche, Uploads oder zusätzlichen KI-Aufrufe.

### Farbdramaturgie und direkter Vergleich

„Songanalyse“ verwendet jetzt eine separate Farbplanung pro musikalischer Phrase.
Sie berücksichtigt Klangveränderungen, vorhandene Stimmungsinformationen und,
sofern verfügbar, Instrumentaktivität. Wiederkehrende ähnliche Motive erhalten
ihre Farbidentität zurück. Grund-, Begleit- und Akzentfarbe haben verschiedene
Rollen; es gibt keinen dauernden Zweifarbenwechsel oder frei laufenden Regenbogen.
Die Planung verwendet kräftige Farben unabhängig von der Klangtextur. Übergänge
verlaufen über OKLCH mit Begrenzung auf darstellbares RGB; die vorhandene
Dimmer-, Beat- und Bewegungsplanung bleibt erhalten.

Im Farbmenü eines Decks kann direkt zwischen **Songanalyse · Farbdramaturgie**
und **Songanalyse · Bisherige Farben (Vergleich)** gewechselt werden. Beide
verwenden denselben Track, dieselbe Wiedergabeposition und dasselbe Lichtprofil.
Die Wahl wird pro Track gespeichert. Das ist ein hör-/sichtbarer Vergleich,
kein randomisierter Blindtest. Vorhandene manuelle Paletten und Abschnittsedits
haben weiterhin Vorrang. Lichtbühne, Full und Profil-Cover verwenden dieselbe
Farbspur.

Für vorhandene Titel die Lichtshow neu berechnen (Show-Version 19). Für den
Wechsel zwischen den beiden Farbplanungen danach ist keine neue Audioanalyse
nötig. Der Ansatz ist gestalterisch und heuristisch; ob er besser gefällt, muss
der Vergleich mit unterschiedlichen Songs und echten Lampen zeigen.

### Atmosphärische Bewegung im Auto-Modus

Automatische Bewegung berücksichtigt jetzt den Charakter der musikalischen
Phrase: zeitlichen Pegelkontrast, Dichte ausgewählter Musikereignisse und
vorhandene Evidenz für einen treibenden Rhythmus. Absolute Lautstärke allein
löst keine Verlangsamung aus. Ein leiser Groove kann schnell bleiben; eine
laute gehaltene Fläche kann atmosphärisch behandelt werden.

In der automatischen, ausgewogenen Moving-Head-Steuerung haben atmosphärische
Phrasen mindestens vier Sekunden Abstand zwischen Bewegungszielen und mindestens
drei Sekunden Fahrzeit. Die automatische Geräteverteilung fügt dort keine
zusätzliche umlaufende Helligkeitswelle oder Farbrotation hinzu. Die vorbereitete
Helligkeit und Farbspur bleiben erhalten. Explizite Lauflicht- und Moving-Head-
Stimmungen behalten ihre Steuerung. Vorhandene Shows neu berechnen (Version 20).

Validiert mit Charakter-, Bewegungs- und Seekingtests sowie Browserprüfung der
Moving Heads. Die Klassifikation bleibt eine Heuristik und sollte mit realen
Songs und Lampen beurteilt werden. `scripts/check-auto-quiet-motion.mjs` zeigt
weiterhin den bewusst erlaubten Fall: leiser, aber treibender Rhythmus kann
häufige Bewegungsziele behalten.

### Songabhängige Schwenkmotive

Bei **Automatisch → Ausgewogen** plant die Moving-Head-Vorschau ihre Figuren aus
Phrasencharakter, Klangfarbe, Energie und – sofern vorhanden – Instrumentenanteilen.
Atmosphärische Abschnitte erhalten langsame Bögen, treibende Passagen kompakte
rhythmische Figuren, gesangsbetonte Passagen einen engeren inneren Fokus.
Aufbauten öffnen den Fächer im Verlauf des Abschnitts. Peaks können weiter und
schneller werden. Ähnliche wiederkehrende Songmotive verwenden dieselbe Figur;
bei deutlich veränderter musikalischer Evidenz entsteht eine neue Variante.

Weite, Geschwindigkeit und Zielabstand werden getrennt geplant. Fahrten enden
auf ausgewählten Musikereignissen, bleiben innerhalb der Bewegungsgrenzen und
halten zwischen Fahrten ihre Position. Seeking verwendet die vorbereitete
Zeitspur; Deck-Übergänge nutzen weiterhin die bestehende gewichtete Mischung.
Farben und Helligkeiten werden durch diese Bewegungsplanung nicht verändert.
Manuell gewählte Bewegungsstile behalten ihr bisheriges Verhalten.

Seite neu laden und Moving Heads mit „Ausgewogen“ aktivieren. Bereits mit
Show-Version 20 berechnete Songs benötigen keine neue Audioanalyse; ältere
Shows einmal neu berechnen. Ohne Phrasenmetadaten bleibt die bisherige Planung
als Fallback erhalten. Dies betrifft die **visuelle Moving-Head-Simulation**:
Eine gerätespezifische DMX-Pan/Tilt-Ausgabe ist damit noch nicht implementiert.

### Player-Tastenkürzel und Übergangseditor

- **Leertaste / K:** Play/Pause für das Deck mit Tastaturfokus. Ohne Deckfokus
  wird das einzige laufende Deck gewählt, sonst das am Crossfader gewählte Deck.
- **← / →:** fünf Sekunden zurück/vor; mit **Shift** eine Sekunde.
- **↑ / ↓:** Masterlautstärke um fünf Prozentpunkte ändern.
- **Q / O:** Deck A/B Play/Pause; **W / P:** Cue.
- **1–4 / 7–0:** Hotcues für A/B; mit Shift löschen.

Eingabefelder, Regler und offene Dialoge sind vor globalen Kürzeln geschützt.
Leertaste und Pfeiltasten behalten auf fokussierten Buttons und anderen nativen
Bedienelementen ihre übliche Funktion. Gehaltene Tasten lösen keine wiederholten
Transportaktionen aus.

Der Übergangseditor öffnet direkt den Variantenvergleich. **Anhören** aktiviert
und spielt eine Variante; **Anpassen** öffnet ihre Bearbeitung direkt in derselben
Zeile. Dauer, aufklappbare Startstellen und optionale Lautstärkekurve gehören zur
jeweiligen Variante. Ein zusätzlicher Auswahlschritt entfällt. Hörprobe und
Übernehmen bleiben am unteren Rand erreichbar. Änderungen bleiben beim Vergleich
erhalten. Zeitfelder zeigen höchstens zwei Nachkommastellen; unveränderte Werte
behalten ihre berechnete Genauigkeit.
Im Dialog startet/stoppt **Leertaste** die separate Kopfhörer-Hörprobe,
**Strg/⌘ + Enter** übernimmt gültige Änderungen und **Esc** schließt den Dialog.
Die laufenden Decks werden durch die Hörprobe nicht gesteuert.

Im Übergangseditor stehen zusätzliche Kurvenkürzel bereit (außerhalb von
Eingabefeldern): **1 / 2** wählen ausgehende/eingehende Kurve, **N** fügt einen
Punkt hinzu, **Entf / Backspace** löschen den ausgewählten inneren Punkt.
**Strg/⌘ Z** macht Kurvenänderungen rückgängig, **Strg/⌘ Shift Z** bzw.
**Strg/⌘ Y** wiederholt sie. **Tab** fokussiert die Kurvenpunkte; Pfeiltasten
verschieben den fokussierten Punkt, Shift vergrößert den Schritt. Die aktive
Auswahl zeigt Zeit und Pegel. Die Audioeinrichtung bleibt zunächst eingeklappt;
bei fehlendem Kopfhörerausgang führt ein eigener Button zur Einrichtung.

### Persönliche Übergangsbibliothek

Über **↗** am Warteschlangeneintrag oder **↗ Übergänge** im Deck werden die
Verknüpfungen des Quelltitels geöffnet. „Anderen Titel verknüpfen“ sucht einen
lokalen Zieltitel und öffnet den Editor. Dort die Variante benennen, bei Bedarf
auf Kopfhörern probehören und speichern. Pro Richtung und Titelpaar sind mehrere
Varianten möglich. Im normalen Deck-/Setlisten-Editor kann zusätzlich „In
Übergangsbibliothek speichern“ aktiviert werden.

„Als nächsten Titel wählen“ legt eine Kopie direkt hinter den gewählten Queue-Eintrag;
beim Deck landet sie vorn in der aktuellen Queue. Die vorhandene Queue-Automatik
bereitet sie vor; bei gestoppter Automatik diese mit „Start“ aktivieren. Es wird
kein sofortiger Wechsel ausgelöst. Ein bereits eingereihter Zieltitel kann
stattdessen ausdrücklich verschoben werden. Ein laufender Übergang wird nicht
verändert; während seines Ladevorgangs ist erneutes Einfügen gesperrt.

Eingeplante Übergänge behalten ihren eigenen Stand, auch wenn die Vorlage später
geändert oder gelöscht wird. Falscher Vorgänger, andere Dateimetadaten, andere
Länge oder abweichendes Tempo verhindern die Anwendung. Die Automatik pausiert
bei einem unpassenden vorbereiteten Wechsel. „Übergang entfernen“ am Eintrag
kehrt zur automatischen Planung zurück. Ein bereits vergangener Ausstieg kann
für den aktuellen Deck-Durchlauf nicht mehr ausgewählt werden.

Dateizugriff und Analyse bleiben erforderlich. Eine neue Lichtanalyse allein
invalidiert die Vorlage nicht. Die Dateiprüfung verwendet Bibliotheks-ID, Name,
Größe und Änderungsdatum, keinen Audio-Fingerprint. Die Bibliothek liegt in
IndexedDB auf diesem Gerät/in diesem Browser und enthält keine Audiodateien.
Web- und Desktop-Bibliotheken werden nicht synchronisiert; Export/Import ist
noch nicht enthalten. Streaming-Titel werden nicht als Übergangsvorlagen erfasst.

### Titel im Übergang zeitlich verschieben

Im Übergangseditor zeigt „Ausschnitte für den Übergang“ zwei Zeitspuren.
Den markierten Bereich ziehen, um die Wechselstelle im ausgehenden Titel bzw.
den Einstieg im nächsten Titel zu verschieben. Der rechte Rand verändert die
**gemeinsame Überblenddauer**. Dateigrenzen und Wiedergabetempo werden dabei
berücksichtigt. „Details vergrößern“ zeigt den Bereich um den Übergang;
„Ganzen Titel zeigen“ stellt die Gesamtübersicht wieder her.

Fokussierte Markierungen lassen sich mit Links/Rechts um 0,1 Sekunden bewegen,
mit Shift um eine Sekunde. Vorhandene Wellenformdaten werden dargestellt;
ohne diese zeigt die Spur nur die Zeitachse. Die Änderungen betreffen die echte
Hörprobe, gespeicherte Vorlagen und die spätere Wiedergabe. Während des Editierens
werden die laufenden Decks nicht verschoben. Eigene Lautstärkepunkte bleiben beim
Ändern der Zeitpunkte erhalten und werden auf die neue Überblenddauer skaliert.

Die Vorschlagsliste zeigt berechnete Varianten mit Lautstärkekurven, Dauer,
Ausstieg und Einstieg. „Anpassen“ aktiviert die Variante und öffnet ihre Einstellungen;
„Anhören“ startet ihre separate Kopfhörer-Hörprobe. Ein weiterer Klick stoppt
sie, eine andere Variante beendet die bisherige Probe. Ohne Kopfhörerausgang
öffnet die Aktion die Audioauswahl direkt beim Vergleich. Änderungen an einer
Variante bleiben beim Vergleich innerhalb des geöffneten Titelpaars erhalten.
Die Kurven zeigen Lautstärke, nicht die zusätzliche Bass-EQ-Übergabe.

Im Übergangsvergleich öffnet „Anpassen“ die Einstellungen direkt in der
jeweiligen Vorschlagskarte. Dauer und Übergangsart lassen sich dort ändern,
die Lautstärkekurve bei Bedarf aufklappen. „Startstellen anpassen“
öffnet die Zeitachsen direkt innerhalb der Variante. Änderungen bleiben beim Variantenwechsel erhalten.
Fehlende Übergangsarten werden als ausdrücklich gekennzeichnete Vorlagen
ergänzt (sanft, Bassübergabe, kurze Überlagerung, kurzer Wechsel); diese sind
keine zusätzlichen Analyseempfehlungen und beachten die verbleibende Titellänge.
