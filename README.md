# AnyDj – Prototyp 0.1.0

**Layout anpassen:** Auf breiten Bildschirmen lassen sich die Trennlinien zwischen
Decks und Mixer, zwischen Pult und Listen sowie zwischen Bibliothek und
Warteschlange ziehen. Die Größen werden im Browser gespeichert. Fokussierte
Trennlinien reagieren auf Pfeiltasten (mit Umschalt in größeren Schritten).
Doppelklick setzt die jeweilige Aufteilung zurück; „Einstellungen → Layout
zurücksetzen“ stellt alle Standardgrößen wieder her. Auf schmalen Displays
bleibt die gestapelte Ansicht erhalten.

**Full-Modus für Parties:** Bei „Lichtshow“ auf „Full“ klicken: Weich bewegte,
bildschirmfüllende Farbflächen folgen den Songfarben, der Helligkeit und dem
aktuellen Crossfade. Musik und Warteschlange laufen weiter, auch ohne Lampe.
Die Bedienung verschwindet nach kurzer Zeit und erscheint bei Mausbewegung
oder Antippen wieder. Mit Escape oder „Schließen“ zurück zum Pult.
Pause und Stopp schalten die Farben dunkel. Ohne Browser-Vollbildunterstützung
füllt die Ansicht das Browserfenster.

**Virtuelle Lichtbühne im DJ-Pult:** Im Mixer „Lichtbühne aktivieren“
anklicken. Die Bühne ersetzt oben die Farbvorschau; „Bühne einstellen“ öffnet
die Einstellungen. Beim Schließen der Einstellungen läuft die Bühne weiter.
„Lichtbühne deaktivieren“ stellt die Farbvorschau wieder her. Die gewählte
Anzeige bleibt beim Neuladen erhalten. Die gewählte Ausstattung zeigt
die Lichtshow direkt im Browser – auch bei „Nur Audio“ und in der Web-Demo.
„Demo ohne Musik starten“ zeigt einen Beispielverlauf mit simulierten 120 BPM.
Sobald ein Deck spielt, übernimmt die Musik. Pause und Stopp schalten die
Vorschau dunkel. „Vorschau abdunkeln“ betrifft ausschließlich die Simulation.

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

Modus und Gestaltung werden lokal im Browser gespeichert, getrennt von der
WiZ-Steuerung. Speicherfehler werden angezeigt; Löschen der Browserdaten entfernt
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
überblenden. Die Lampe vor der Wiedergabe auswählen; „Nur Audio“ ist ebenfalls
möglich. „Stopp“ pausiert beide Decks und stellt das vorherige Licht
wieder her. Cue pausiert und springt zum gesetzten Punkt. Noch kein automatisches
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

„Übergang ansehen & probehören“ bietet bei vollständiger Paaranalyse bis zu
drei Vorschläge mit Zeitpunkt, Dauer und Begründung. Die Auswahl im Dialog
ändert zunächst nur die Vorschau; „Für Automatik übernehmen“ übernimmt sie
für das aktuelle Songpaar. Bereits verstrichene oder inzwischen veraltete
Pläne werden abgelehnt. Optional lässt sich der gewählte Stil als leichte
Präferenz speichern; unter „Automatik einstellen → Leichte Stilpräferenz“
ist sie veränderbar oder mit „Keine“ zurücksetzbar. Einstiegssuche und Präferenz
werden auf dem Gerät gespeichert. Die Hörprobe benötigt pausierte Decks und
spielt über den Systemausgang, ohne die Deckpositionen oder Warteschlange zu ändern.

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

Optional lassen sich `WIZ_BEAT_PYTHON`, `WIZ_BEAT_MODEL` (lokale `final0`-Datei)
und `WIZ_BEAT_DEVICE=cpu|cuda|auto` konfigurieren. CUDA setzt eine separat passend
installierte GPU-Version von PyTorch voraus; der mitgelieferte Installer richtet
CPU-Betrieb ein. Der bestehende Node-Server benötigt keine neuen npm-Pakete.
Nach Aktualisierung des Servercodes den Server neu starten und die Seite neu laden.

Verfahren und Lizenz: [Beat This! – offizielles Repository](https://github.com/CPJKU/beat_this).

Eine lokale Webapp für AnyDj-WLAN-Lampen: Node.js-Backend, Browser-Frontend, keine npm-Abhängigkeiten und keine Cloud-Anbindung der Webapp.

**Voraussetzung:** Die Lampe ist bereits im WLAN und akzeptiert ungesicherte lokale AnyDj-Befehle. Diese Version unterstützt **nicht** „Only verified controls / Nur verifizierte Steuerungen“ mit dem AnyDj Home Security Key. Für die WLAN-Ersteinrichtung gibt es einen [experimentellen lokalen Ablauf](SETUP.md), bisher ausschließlich für ESP03_SHRGB1C_01 mit Firmware 1.32.0. Sicherheitseinstellungen werden nicht umgangen. AnyDj beschreibt diese Unterscheidung in seinen lokalen Integrations- und Sicherheitshinweisen [1, 2].

## Start auf Kubuntu / Ubuntu

ZIP entpacken und ein Terminal im Ordner `wiz-local` öffnen:

```bash
node --version
node server.mjs
```

Das Projekt benötigt **Node.js 22 oder neuer**. Es gibt keinen Build-Schritt und kein `npm install`. `npm start` ist ein alternativer Startbefehl, sofern npm installiert ist.

Im Browser öffnen:

```text
http://127.0.0.1:3030
```

Im Frontend **„Lampen suchen“** wählen. Die Suche verändert keinen Lichtzustand. Eine gefundene Lampe auswählen. Werden mehrere Netzwerke angezeigt, unter „Netzwerk auswählen“ möglichst die tatsächliche WLAN- oder LAN-Schnittstelle verwenden, nicht eine Docker- oder VPN-Schnittstelle. Alternativ unter **„IP manuell hinzufügen“** die Lampen-IP aus dem Router eintragen.

Zum Beenden im Terminal `Strg+C`. Während der Benutzung muss der Node-Prozess laufen. Die Lampe muss am Wandschalter mit Strom versorgt bleiben.

**Die Datei `public/index.html` nicht per Doppelklick öffnen:** Die Bedienoberfläche braucht das lokale HTTP-Backend.

## Bedienung

Ein/Aus wird als eindeutiger Zielzustand gesendet, nicht als Toggle auf der Lampe. Dadurch führt ein wiederholtes UDP-Paket nicht versehentlich zum Zurückschalten.

Helligkeit, RGB-Farbe, Hex-Farbwert und Weißtemperatur lassen sich getrennt einstellen. Änderungen an Reglern und Presets **schalten die Lampe ein**. Der Helligkeitsregler sendet 1–100 Prozent; die tatsächliche Mindesthelligkeit hängt vom Gerät ab. RGB-Schwarz ist bewusst kein Ersatz für den Ausschaltbefehl.

Die UI enthält sechs **eigene, statische Presets**, keine vollständige Liste der nativen AnyDj-Effekte. Das Umschalten zwischen den Tabs „Weißlicht“ und „Farbe“ sendet noch keinen Befehl. Erst ein geänderter Wert wird übertragen.

Der Server liest soweit möglich Modul und Temperaturbereich aus. Nicht unterstützte Funktionen werden bei bekannten Modultypen deaktiviert. Kann der Bereich nicht ermittelt werden, zeigt die UI ausdrücklich einen voreingestellten Bereich von 2200–6500 K. Die Lampe kann Werte ignorieren oder begrenzen; maßgeblich bleibt der zurückgelesene Zustand. Ungewöhnliche Geräte und Mehrzonenleuchten können zusätzliche Anpassungen benötigen. Die zugrunde liegenden AnyDj-Felder und Modellabfragen sind unter anderem in pywizlight nachvollziehbar [3].

Unter **„Verbindung & Diagnose“** stehen IP, MAC, Modul, Firmware, aktuelle Rohdaten und ein begrenzter Verlauf gesendeter/empfangener Pakete. Namen können dort lokal geändert werden. „Aus Liste entfernen“ löscht nur den App-Eintrag und setzt die Lampe nicht zurück.

Reglerereignisse werden gebündelt; Befehle werden je Lampe nacheinander gesendet. Nach einem bestätigten Schreibbefehl wird der Zustand erneut gelesen. Ein Timeout ist **kein Beweis**, dass der Befehl nicht angekommen ist. Die Oberfläche meldet deshalb eine fehlende Bestätigung und erfindet keinen Erfolg.

## Vom Handy im selben Heimnetz

Den bisher laufenden Server zuerst mit `Strg+C` beenden. Anschließend:

```bash
node server.mjs --lan
```

Alternativ:

```bash
npm run lan
```

Der Server lauscht nun auf `0.0.0.0` und zeigt seine lokalen Adressen sowie einen zufällig erzeugten **Web-Zugangscode** im Terminal. Eine dieser Adressen auf dem Handy im Heimnetz öffnen, zum Beispiel:

```text
http://192.168.178.20:3030
```

Das ist die **IP des Rechners mit dem Node-Server**, nicht die IP der Lampe. Den Zugangscode im Anmeldedialog eingeben. Der Code wird nur für die Browser-Sitzung gespeichert. Bei einem Neustart wird standardmäßig ein neuer Code erzeugt.

Der Web-Zugangscode schützt diese Webapp und hat **nichts mit dem AnyDj Home Security Key** zu tun. Er schaltet den verifizierten AnyDj-Modus nicht frei.

**Sicherheitsgrenze:** Dieser Prototyp nutzt HTTP, kein HTTPS. Der LAN-Zugangscode ist daher auf dem Übertragungsweg nicht zusätzlich durch TLS geschützt. Nur in einem vertrauenswürdigen Heimnetz benutzen, nicht öffentlich bereitstellen und keine Internet-Portweiterleitung einrichten. Der Standardstart bindet absichtlich nur an Loopback. Host-/Origin-Prüfungen, ein zusätzlicher Schreibheader und Eingabevalidierung bieten Basisschutz, sind aber kein Ersatz für eine gehärtete produktive Bereitstellung.

## Demo ohne echte Lampe

```bash
node server.mjs --demo
```

Oder `npm run demo`. Die Demo verwendet zwei simulierte Lampen und dieselbe Bedienoberfläche. Der gelbe Demo-Hinweis ist dauerhaft sichtbar. **Es werden keine UDP-Pakete an echte Geräte gesendet.** Demo-Zustände und Demo-Namen verschwinden beim Neustart; die echten gespeicherten Geräte werden weder geladen noch verändert.

## Konfiguration

| Einstellung | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `3030` | HTTP-Port |
| `HOST` | `127.0.0.1` | Bind-Adresse; `--lan` verwendet `0.0.0.0` |
| `WIZ_WEB_TOKEN` | leer / im LAN zufällig | Eigener Web-Zugangscode, mindestens 20 Zeichen |
| `WIZ_DATA_DIR` | `./data` relativ zum Projekt | Ordner für gespeicherte Geräte |

Beispiel für einen anderen Port:

```bash
PORT=3031 node server.mjs
```

Ein fester Zugangscode kann über `WIZ_WEB_TOKEN` gesetzt werden. Keine echten Zugangscodes ins Git-Repository schreiben. `.env`-Dateien werden **nicht automatisch geladen**; Variablen direkt in der Shell oder in der Prozessverwaltung setzen.

Im echten Modus liegen IP-Adressen, MAC-Adressen und eigene Namen in `data/devices.json`. Es werden keine Passwörter oder AnyDj-Zugangsdaten darin gespeichert. Zustände werden nicht über einen Neustart hinweg als aktuell ausgegeben. Bei einer defekten Gerätedatei bricht der Server ab, anstatt sie still zu überschreiben. Bei einer Wiederentdeckung per MAC bleibt der eigene Name auch bei geänderter DHCP-Adresse erhalten.

## Wenn keine Lampe antwortet

Zuerst IP und WLAN-Verbindung im Router prüfen und die IP manuell hinzufügen. Ein fehlendes Suchergebnis beweist nicht, dass die Lampe keine lokale Steuerung unterstützt. Der Rechner sollte für den ersten Test direkt im gleichen Netz laufen, nicht in einer VM oder einem Docker-Bridge-Netz.

Der Prototyp sendet an den AnyDj-Port **UDP 38899** [3]. Er verwendet auf dem Rechner dynamische UDP-Quellports. Antworten müssen an diese Quellports zurückkommen können; nur pauschal eingehendes UDP 38899 freizugeben beschreibt die benötigte Verbindung deshalb nicht vollständig. Für die Suche werden Broadcasts der ausgewählten lokalen IPv4-Schnittstellen verwendet. Gastnetz-Isolation, VLAN-Grenzen, VPN-Routing oder Firewall-Regeln können die Verbindung verhindern.

Unter AnyDj **Settings → Security** muss lokale Kommunikation erlaubt sein. Diese Version benötigt **„All controls / Alle Steuerungen“**. Bei **„Only verified controls“** fehlt diesem Prototyp die authentifizierte Protokollimplementierung; bei deaktivierter lokaler Kommunikation wird lokales UDP nicht akzeptiert [1, 2]. Ein Timeout kann diese Fälle nicht zuverlässig voneinander unterscheiden.

Wenn eure AnyDj-App nicht funktioniert, aber die Lampe weiterhin im WLAN und für lokale Befehle offen ist, benötigt der laufende Prototyp keinen App-Login. Eine nicht mehr eingerichtete oder gesperrte Lampe lässt sich damit jedoch nicht einfach übernehmen. **Nicht vorschnell auf Werkseinstellungen zurücksetzen**, da danach die WLAN-Ersteinrichtung erneut nötig wäre. Die offizielle Home-Assistant-Dokumentation setzt ebenfalls eine bereits konfigurierte AnyDj-Netzwerkverbindung voraus [4].

Die App greift ausschließlich lokal zu. Sie verändert oder sperrt nicht die Cloud-Verbindungen, die die Lampe selbst eventuell weiterhin aufbaut.

## Projektstruktur

```text
wiz-local/
├── server.mjs            HTTP-API, Zugriffsschutz, Geräteverwaltung, Speicherung
├── lib/
│   ├── wiz.mjs           UDP, Discovery, Validierung und Modellinformationen
│   └── demo.mjs          Simulierter Transport ohne echte Lampen
├── public/
│   ├── index.html        Bedienoberfläche
│   ├── style.css         Responsive Gestaltung, ohne externe Ressourcen
│   └── app.js            UI, Presets, Reglerbündelung und Statusabgleich
├── test/
│   └── app.test.mjs      Automatisierte Tests mit Node-Bordmitteln
├── package.json
├── README.md
├── TESTING.md
└── .gitignore
```

Die Transportklasse `WizClient` ist von der HTTP-API getrennt. Ein späteres React-/Next.js-Frontend kann dieselben HTTP-Endpunkte nutzen, wenn es im selben Origin ausgeliefert wird. Eine direkt eingebaute Next.js-Variante müsste den UDP-Code in der Node-Runtime ausführen, nicht im Browser oder in einer Edge-Runtime. Der verwendete UDP-Baustein ist Nodes `dgram` [5].

Sinnvolle Erweiterungspunkte sind eigene gespeicherte Presets, Räume/Gruppen, ein zentraler Scheduler und eine separat zu implementierende Unterstützung des AnyDj Home Security Key. Keine dieser Erweiterungen wird hier bereits vorgetäuscht.

## HTTP-API

Alle Schreibanfragen benötigen `Content-Type: application/json` und `X-AnyDj-Local: 1`. Bei aktiviertem Web-Zugangscode wird zusätzlich `Authorization: Bearer <WEB-ZUGANGSCODE>` benötigt. Es gibt bewusst keinen frei aufrufbaren AnyDj-RPC-Endpunkt.

| Methode / Pfad | Zweck |
| --- | --- |
| `GET /api/meta` | Version, Demo-Status, Anmeldebedarf; ohne Geheimnisse |
| `GET /api/devices` | Gespeicherte Geräte und Netzwerkschnittstellen |
| `POST /api/discover` | Suche; Body `{}` oder `{"interface":"192.168.178.20"}` |
| `POST /api/devices` | Lampe prüfen/hinzufügen; Body `{"ip":"192.168.178.42","name":"Wohnzimmer"}` |
| `GET /api/devices/:ip` | Aktuellen Status von einer bekannten Lampe lesen |
| `POST /api/devices/:ip/pilot` | Kontrollierte Lichtparameter senden |
| `PATCH /api/devices/:ip` | Eigenen Namen speichern; Body `{"name":"Wohnzimmer"}` |
| `DELETE /api/devices/:ip` | Nur lokalen Eintrag entfernen; Body `{}` |

Beispiel: bereits hinzugefügte Lampe auf violett mit 70 Prozent Helligkeit setzen. **Dieser Aufruf verändert den Lichtzustand tatsächlich.**

```bash
curl -X POST http://127.0.0.1:3030/api/devices/192.168.178.42/pilot \
  -H 'Content-Type: application/json' \
  -H 'X-AnyDj-Local: 1' \
  --data '{"state":true,"r":170,"g":20,"b":255,"dimming":70}'
```

## Tests und Entwicklungsmodus

```bash
npm test
npm run dev
```

Alternativ ohne npm:

```bash
node --test test/*.test.mjs
node --watch server.mjs
```

Die Tests verwenden Demo-Adapter und lokale UDP-Testserver, nicht eure Lampe. `node --watch` startet das Backend bei Änderungen an importierten Serverdateien neu. Frontend-Änderungen werden nach einem Neuladen der Seite sichtbar; ein Browser-Hot-Reload ist nicht eingebaut.

**Testumfang und Grenzen stehen in `TESTING.md`. Ein erfolgreicher Test mit eurer konkreten AnyDj-Birne ist noch nicht nachgewiesen.**

## Quellen zum Protokoll und zu den Voraussetzungen

[1] AnyDj: Local integrations – verifizierte/unverifizierte Steuerungen und Home Security Key.
https://wizconnected.helpshift.com/hc/en/7-wiz-v2/faq/1178-local-integrations/

[2] AnyDj: Secure or Disable local network communication.
https://wizconnected.helpshift.com/hc/en/7-wiz-v2/faq/548-secure-or-disable-local-network-communication/

[3] pywizlight: primäre Implementierung und Felder für lokale AnyDj-Steuerung.
https://github.com/sbidy/pywizlight
https://github.com/sbidy/pywizlight/blob/master/pywizlight/bulb.py
https://github.com/sbidy/pywizlight/blob/master/pywizlight/discovery.py

[4] Home Assistant: AnyDj-Integration und lokale Netzwerkverbindung.
https://www.home-assistant.io/integrations/wiz/

[5] Node.js: UDP / dgram.
https://nodejs.org/api/dgram.html

Stand der für diesen Prototyp geprüften Quellen: 19.09.2026. Unabhängiger Prototyp; kein offizielles Produkt von AnyDj oder Signify.

## Live zur Musik

Unter **[Musiksteuerung](http://localhost:3030/music)** eine gespeicherte Lampe auswählen:

- **Rechner-Audio starten:** Reagiert auf die Standard-Audioausgabe des Server-Rechners, etwa Musik aus einem Player oder Browser. Auf dem eingerichteten Linux-Rechner funktioniert dies über PulseAudio/PipeWire und `parec` (Paket `pulseaudio-utils`). Die Seite direkt über localhost öffnen. Die gewünschte Audioausgabe vor dem Start wählen; nach einem Wechsel den Effekt neu starten.
- **MP3 hierher ziehen:** Datei ablegen oder auswählen und im eingebauten Player auf Play drücken. Die MP3 wird lokal im Browser abgespielt und analysiert; nur Audiopegel gehen an den lokalen Server. Maximal 200 MB. Pause und Titelende beenden den Effekt.
- **Browser-Tab teilen:** Alternative über den Freigabedialog des Browsers. Einen Tab samt Audio freigeben. Ob Ton verfügbar ist, hängt von Browser und Betriebssystem ab.

Für die manuelle Gestaltung stehen vier Effekte bereit: sanftes Licht, Bass-Puls, fließender Farbverlauf und **Disco**. Disco verfolgt wiederkehrende Schlagabstände, zeigt geschätzte BPM und Erkennungsstatus und filtert bei stabilem Rhythmus Impulse außerhalb des Beatrasters. Bassimpulse haben Vorrang vor breitbandigen Anstiegen, sobald ausreichend Bass vorhanden ist. Jeder akzeptierte Beat setzt die maximale Helligkeit; eine Farbfamilie bleibt jeweils über acht Schläge erhalten und geht dann weich in die nächste über; dazwischen klingt der Akzent mit etwa 110 ms Zeitkonstante zur Mindesthelligkeit ab. Die Erkennung benötigt mehrere Schläge; vor der Stabilisierung reagiert sie auf einzelne Impulse. Synkopen, Tempowechsel oder Musik ohne klare Percussion können die Schätzung weiterhin erschweren.

Fünf Farbpaletten (Sonnenuntergang, Regenbogen, Neon, Feuer und Ozean) sowie zwei eigene Farben stehen bereit. Farbwechsel-Tempo und Sättigung sind einstellbar. Sanft und Bass-Puls verwenden die erste Palettenfarbe, Farbverlauf und Disco durchlaufen die Palette. Das Farbwechsel-Tempo steuert ausschließlich den Farbverlauf. Disco folgt den erkannten Beats ohne zusätzliche feste 500-ms-Sperre. Empfindlichkeit, Helligkeitskurve und Glättung sind in Disco deaktiviert, damit sie den klaren Beat-Akzent nicht verwischen.

Für feinere Helligkeitsabstufungen gibt es Mindest- und Maximalhelligkeit (5–100 %), drei Helligkeitskurven, Empfindlichkeit und zeitbasierte Glättung. Die Regler wirken während der Wiedergabe. Die Lampe erhält weiterhin ganzzahlige Helligkeitswerte und höchstens acht Befehle pro Sekunde; WLAN-Latenz und die Übergänge der Lampenfirmware beeinflussen das sichtbare Ergebnis. Pro Sitzung wird eine Lampe gesteuert.

**Stoppen** stellt den zuvor gelesenen Lichtzustand wieder her. Während der Sitzung sind andere Lichtbefehle der App für diese Lampe gesperrt. Die Übertragung erfolgt mit höchstens acht Lichtbefehlen pro Sekunde und ohne Warteschlange. Bei ausbleibender Browserverbindung endet die Sitzung nach zehn Sekunden; bei nicht erreichbarer Lampe kann die Wiederherstellung fehlschlagen. Ein harter Prozessabbruch oder Stromausfall kann ebenfalls keine Wiederherstellung garantieren.

Rechner-Audio erfasst ausschließlich den Ausgabemonitor, kein Mikrofon. Audioaufnahmen werden weder gespeichert noch an einen Cloud-Dienst gesendet. Die Rechner-Audioquelle ist im Demo-Modus deaktiviert; MP3 kann dort mit simulierten Lampen getestet werden.

### Audio- und Bassanzeige

MP3/Tab-Audio wird kontinuierlich in einem AudioWorklet ausgewertet, Rechner-Audio mit derselben Analyse am Server. Je 20 ms werden der Audiopegel und ein separat gefiltertes Bassband (40–180 Hz) berechnet. Stereokanäle werden energetisch gemittelt, damit gegenphasige Signale nicht verschwinden. Eine laufende Impulsnummer erhält kurze erkannte Anstiege bis zur nächsten Übertragung.

Die getrennten Audio- und Bassbalken passen ihre Skala an die jüngsten Signalspitzen an; sehr leises Rauschen wird nicht hochgezogen. Die daneben angegebenen dBFS-Werte zeigen den absoluten Pegel. Die Impulsanzeige reagiert auf tatsächliche Pegelanstiege, nicht auf eine dekorative Animation. Beim Rechner-Audio wird die Anzeige alle 125 ms aktualisiert. Browseranalyse und Pegelanzeige laufen unabhängig von den höchstens acht Lichtbefehlen pro Sekunde. Die neue Browseranalyse benötigt AudioWorklet-Unterstützung (im lokalen Chrome geprüft).

### Kommunikation während Musik

Statusabfragen der Hauptseite zeigen während einer Musiksitzung ausdrücklich den zuletzt gelesenen Zustand, statt zusätzliche `getPilot`-Pakete zu senden. Eine erneute Lampensuche ist erst nach dem Stoppen möglich. Unveränderte Lichtwerte werden höchstens alle zwei Sekunden erneut bestätigt; nach fehlenden Antworten pausiert die Musikübertragung zunehmend, bevor sie bei vier aufeinanderfolgenden Fehlern endet. Die Wiederherstellung sendet entweder eine gültige Szene, Weißtemperatur oder RGB-Werte; der reine Statuswert `sceneId: 0` wird nicht zurückgeschickt.

## Automatische Verbindungsprüfung beim Öffnen

Haupt- und Musikseite prüfen die gespeicherte Lampe beim Laden. Bei ausbleibender Antwort sucht die App automatisch nach derselben Gerätekennung (MAC). Eine neue IP ersetzt die alte erst nach bestätigter Identität; der Name bleibt erhalten. Ist noch kein Gerät gespeichert, wird automatisch eine gefundene Lampe geprüft und hinzugefügt. Die Hauptseite prüft weiter regelmäßig, die Musikseite versucht bei fehlender Verbindung alle 15 Sekunden erneut zu verbinden. Gleichzeitige Prüfungen werden zusammengefasst; erfolglose Suchen werden für 20 Sekunden zwischengespeichert.

Die Musiksteuerung und die normalen Lichtknöpfe werden erst bei bestätigter Verbindung freigegeben. Während einer bestehenden Musiksitzung werden Statuswerte aus dem gekennzeichneten Cache genutzt. Eine IP, die nun einem anderen Gerät gehört, wird nicht stillschweigend übernommen.

Auf dem lokalen Linux-Rechner prüft die App bei fehlender Lampe außerdem die von NetworkManager sichtbaren WLAN-Namen. Ein passendes AnyDjConfig-Netz führt zum Hinweis auf erneute WLAN-Einrichtung mit Link zur Einrichtungsseite. Es werden weder WLAN-Zugangsdaten dauerhaft gespeichert noch beim Seitenaufruf Netzwerke umgeschaltet. Ein ausgeschaltetes Gerät, verlorene WLAN-Einrichtung oder ein Firmwarefehler können durch eine Webseite nicht verhindert werden; in diesen Fällen zeigt sie den erkannten Zustand an und gibt keine vermeintlich betriebsbereite Steuerung frei.

## Lichtshow vorab erstellen

Auf der Musikseite ist für MP3s zusätzlich **„Lichtshow vorab erstellen“** verfügbar und vorausgewählt. Datei hineinziehen, die Analyse abwarten und anschließend im Player Play drücken. **„Live zur Musik“** bleibt als Alternative wählbar; Rechner- und Tab-Audio nutzen weiterhin die Live-Analyse.

Die Voranalyse decodiert das ganze Lied lokal auf 16 kHz und berechnet Pegel, Bass und erkannte Schläge in einem Web Worker. Ein zweiter Durchlauf vergleicht die Energie über das gesamte Lied und berücksichtigt benachbarte, auch kommende Abschnitte. Daraus entstehen vorberechnete Lichtbilder und eine klickbare Verlaufsvorschau mit „Ruhig“, „Aufbau“, „Fließend“ und „Intensiv“. Das sind heuristische Energieabschnitte, keine semantische Erkennung von Strophe, Refrain oder Stimmung.

Die Helligkeit folgt ausschließlich erkannten Beats. Tonverläufe und Klangmerkmale bestimmen die Farben. Palette, Sättigung, Farbtempo, Empfindlichkeit, Helligkeitskurve sowie Minimum und Maximum können vor dem Start geändert werden; der Ablauf wird dabei neu berechnet. Während der Show sind diese Regler gesperrt. Nach Pause sind sie wieder verfügbar. Die Live-Stimmung beeinflusst die vorbereitete Show nicht. „Weiche Übergänge“ glättet in der Show nur Farbposition und Sättigung; das Beat-Timing bleibt erhalten.

Die Wiedergabe nutzt die aktuelle Zeit des MP3-Players, nicht einen unabhängig laufenden Show-Timer. Springen und Fortsetzen wählen damit die passende Stelle des vorberechneten Ablaufs. Zum Start wird auf die Lampensitzung gewartet. Pause, Ende und Stoppen stellen den vorherigen Lichtzustand wieder her; bei ausbleibenden Show-Daten endet die Sitzung automatisch. WLAN-Latenz und die Lampenfirmware begrenzen weiterhin die Genauigkeit der sichtbaren Synchronität. Maximal acht Lichtbilder pro Sekunde.

Grenzen der Voranalyse: 50 MB und 15 Minuten pro MP3. Die MP3, Audiodaten und komplette Show bleiben im Browser; nur das jeweils aktuelle Lichtbild wird an den lokalen Server gesendet. Nach Neuladen ist eine erneute Analyse nötig. Es findet kein Upload zu einem Cloud-Dienst statt.


### Gespeicherte Einstellungen und Klangverläufe

Die Musikseite speichert Effektregler, Farbpalette, Wunschfarben, MP3-Modus, Klangfarben-Einfluss, Licht-Vorlauf und Player-Lautstärke/Stummschaltung im Browser (`localStorage`). Die ausgewählte Lampe wird ebenfalls gemerkt. MP3 und vorberechnete Show werden nicht dauerhaft gespeichert. Ungültige gespeicherte Werte werden verworfen; bei gesperrtem Browserspeicher funktioniert die Seite weiterhin mit temporären Einstellungen.

Die Voranalyse berechnet zusätzlich ein Spektrum pro 80 ms (Hann-Fenster, 2048 Samples bei 16 kHz) und schätzt Klanghelligkeit, dominante Tonklasse und deren spektralen Anteil. Diese Merkmale lenken die Farbposition auch bei gleicher Lautstärke. „Klangfarben folgen“ mischt diesen Einfluss mit dem bisherigen rhythmischen Farbverlauf; „Weiche Übergänge“ verbindet die Farb- und Abschnittswechsel. Das ist eine Schätzung dominanter Klangmerkmale, keine vollständige Notentranskription mehrstimmiger Musik.

„Licht-Vorlauf“ korrigiert den angeforderten Zeitpunkt der vorberechneten Show zwischen −500 und +500 ms. Positive Werte senden kommende Lichtbilder früher, negative Werte später. Der Wert bleibt gespeichert und kann Verzögerungen durch WLAN oder Lampe nachjustieren; wechselnde Netzwerklatenz und die auf acht Bilder pro Sekunde begrenzte Übertragung bleiben praktische Grenzen.

Das Raster der Musikseite begrenzt beide Spalten unabhängig von der Länge der Vorschau. Lange Dateinamen umbrechen; auch sehr viele Abschnitte vergrößern die Seite nicht horizontal.


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

Wiederfinden nach Stromunterbrechung: „Lampen suchen“ wiederholt erfolglose
Suchrunden bis zu 90 Sekunden. Bei Suche über alle Netzwerke werden zusätzlich
bis zu zwölf bekannte IP-Adressen direkt geprüft. Statusfehler werden nur fünf
Sekunden zwischengespeichert; „Status neu lesen“ erzwingt eine frische Prüfung.
Beim Zurückkehren zum Browser-Tab wird erneut geprüft. Neue DHCP-Adressen werden
weiterhin über die MAC zugeordnet. Ein tatsächlich sichtbares AnyDjConfig-Netz
weist dagegen auf Einrichtungsmodus hin; dazu zeigt die App die WLAN-Einrichtung.

**Automatische WLAN-Wiederherstellung:** Für die bekannte Lampe kann der lokale
Server eine private Konfiguration in `data/recovery.json` verwenden. Bei einem
passenden AnyDjConfig-Netz verbindet er die konfigurierte WLAN-Schnittstelle
vorübergehend mit der Lampe, prüft vollständige MAC/Modell/Firmware, überträgt die
hinterlegten WLAN-Daten, wartet auf den bestätigten Beitritt und schließt die
Einrichtung ab. Erst eine MAC-geprüfte UDP-Antwort im Heimnetz bestätigt Erfolg.
Die temporäre Verbindung wird entfernt und eine vorherige WLAN-Verbindung
wiederhergestellt. Eine parallele LAN-Verbindung ist vorteilhaft.

Die Zugangsdaten liegen nur in der lokalen Datei mit Modus 0600 (Klartext für den
Serverbenutzer), nicht im Browser oder der Gerätehistorie. Die Datei liegt im
ignorierten Datenverzeichnis. `GET /api/setup/recovery` zeigt ausschließlich den
Status; die lokale, geschützte POST-Route konfiguriert/deaktiviert die Automatik.
Ein persistentes Auftragsjournal verhindert erneutes Senden nach unklarem
HTTP-Timeout, auch nach Serverneustart. Ein positiv bestätigter Auftrag darf nach
weiterhin bestätigtem Gerätestatus 0 einmal wiederholt werden. Fehler führen zu
einer zweiminütigen Pause zwischen automatischen Versuchen. Die Automatik läuft
nur für die konfigurierte bekannte MAC, bei lokaler Verbindungsprüfung und ohne
aktive Musiksitzung. Rechner und App-Server müssen eingeschaltet bleiben.

## Lichtshow-Editor

`http://localhost:3030/editor` bietet einen eigenen manuellen Ablauf pro Lied und
Lampe. MP3 laden (bis 50 MB/15 Minuten), in Wellenform/Zeitleiste eine Stelle wählen,
„Punkt setzen“ anklicken und Farbe, Helligkeit sowie weichen oder direkten Übergang
festlegen. Änderungen sind während laufender Lichtwiedergabe möglich; Löschen und
Rückgängig helfen beim Bearbeiten. Die Wellenform ist auch über den Positionsregler
per Tastatur bedienbar.

Die Vorschau spielt zunächst nur Audio. „Musik + Licht starten“ aktiviert die
gewählte Lampe, Pause/Stop stellt ihren vorigen Zustand wieder her. Optional
steuert die vorhandene Beat-Analyse die Helligkeit zwischen 5 % und dem am Punkt
gewählten Wert. RGB-Lampen erhalten Farben; Weißlichtlampen ihre unterstützte
Weißtemperatur, reine Dimmer nur Helligkeit. Geräte mit unklarer Dimmbarkeit
werden nicht gestartet. Momentan spielt jeweils eine Lampe; ein separater Entwurf
pro Lampe wird anhand MAC und SHA-256 der Musikdatei im Browser gespeichert. Zum
Wiederöffnen dieselbe MP3 auswählen; die Audiodatei selbst wird nicht gespeichert
oder hochgeladen. Löschen des Browser-Speichers entfernt diese Entwürfe.

### Editor mit Maus und Tastatur

Die Zeitleiste besitzt direkt bedienbare Farbmarkierungen: Doppelklick auf die
Wellenform setzt einen Punkt, Ziehen einer Markierung verschiebt ihn. Optional
rasten Positionen innerhalb von 0,15 Sekunden an erkannten Beats ein (Alt beim
Ziehen übergeht das Raster). Der Startpunkt bleibt fest bei 0; Punkte können
nicht übereinander oder aneinander vorbei geschoben werden. Zoom von Gesamtansicht
bis 16× und horizontales Scrollen erlauben Detailarbeit. Die Markierungen sind
fokussierbare Buttons; die zusätzliche Punktliste bleibt aufklappbar verfügbar.

Leertaste auf der Zeitleiste: Musikvorschau starten/pausieren. N: Punkt setzen.
1–6: Schnellfarbe. Entf: ausgewählten Punkt löschen. Strg/Cmd+D: Punkt an der
Abspielposition duplizieren (bei belegter Position 0,5 s später). Strg/Cmd+Z:
rückgängig. Strg/Cmd+Umschalt+Z oder Strg/Cmd+Y: wiederholen. Auf einem Marker
verschieben Pfeiltasten den Punkt um 0,05 s, Umschalt+Pfeil um 0,5 s; auf der
Zeitleiste springen sie um 1 bzw. 5 Sekunden. Eingabefelder behalten ihre normalen
Tastaturfunktionen. Analyse-Einstellungen und Punktliste sind einklappbar; am
Desktop bleibt die kompaktere Farbauswahl beim Scrollen sichtbar.

### Desktop-Anwendung / Installer

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
