# Farbchoreografie statt vorwiegender Helligkeitsimpulse

Die bisherige Farblogik hielt lange eine Farbfamilie und erlaubte größere
Farbänderungen vorwiegend bei Abschnitts-/Klangänderungen. Disco verstärkte
hauptsächlich Sättigung und Helligkeitspulse. Die Instrumentenanalyse alleine
änderte diese gestalterische Beschränkung nicht.

Die neue Choreografie hält ein kontrastierendes Farbpaar auf ausgewählten
musikalischen Ereignissen. Automatisch und Party wechseln zurückhaltender,
Disco dichter. Klangmuster, lokale Schlagzeugaktivität, Abschnittsdynamik und
Taktanfänge bestimmen die Dichte. Innerhalb eines als „Fließend“ eingeschätzten
Abschnitts kann ein kräftiger Schlagzeugeinsatz die Dichte erhöhen. Es werden
keine neuen Beat-Zeitpunkte oder zufälligen Timer hinzugefügt. Wiederkehrende
Motivgruppen beginnen mit demselben Paar. Eine sichere automatische Erkennung
musikalisch identischer Motive ist damit weiterhin nicht behauptet.

Disco erhöht außerdem das Grundlicht und verringert die Helligkeitsakzente,
sodass die Farbe nach einem Akzent stehen bleibt und nicht jede Reaktion
vorwiegend als Hell-dunkel-Puls erscheint. Ruhe und Stille erhalten keine neuen
Farbwechsel. Manuelle Abschnittsfarben und reduzierte Bewegungsstärke bleiben
auch bei der exakten Laufzeitauswertung wirksam.

## Konkreter Vergleich

Datei aus dem Screenshot: `djsfrommars20years.mp3`, Dauer 275,528 s.
Vollständige lokale CPU-Analyse inklusive Beat, Stil, Instrumente, Songstruktur
und Showberechnung: **129,49 s**. Das ist eine einzelne Messung einschließlich
parallel laufender Prüfungen, keine Laufzeitgarantie. Kein zusätzliches KI-Modell
wurde eingeführt; das vorhandene Analysezeitbudget bleibt bestehen.

Die Automatik erzeugte 229 Farbereignisse, Disco 445. Davon unterscheiden sich
438 aufeinanderfolgende Disco-Ereignisse tatsächlich in der Farbe. Ereigniszahlen
sind eine Funktionskontrolle und kein objektives Maß musikalischer Qualität.
Die subjektive Wirkung an der physischen Lampe wurde nicht geprüft.

[Abspielbarer Bildschirmvergleich](color-comparison.html): bisheriger Farbverlauf,
neue Automatik und neues Disco-Profil. Optional kann die lokale Musikdatei für
einen synchronen Vergleich ausgewählt werden. Kein Audio wird hochgeladen.

## Prüfungen

199 Node-Tests bestanden. Neue Prüfungen decken genaue Farbwechsel zwischen den
125-ms-Vorschaubildern, gehaltene Farben, Springen in der Wiedergabe, lokale
Schlagzeugabhängigkeit, benutzerdefinierte Paletten und manuelle Abschnittswerte ab.
Die früheren Erwartungen „Disco hält immer denselben Farbton“ und „Disco hat die
stärksten Helligkeitsimpulse“ wurden entsprechend dem geänderten Ziel ersetzt.
Beide Browserprüfungen (Abschnittseditor sowie DJ-Cache/Wiedergabe/Layout) bestanden.
Die eigenständige Vergleichsvorschau wurde in Chrome geöffnet und visuell geprüft.

Show-Planversion 16 erneuert gespeicherte Shows bei der nächsten Vorbereitung.
Laufende App liefert das neue Modul auf Port 3030 aus.
