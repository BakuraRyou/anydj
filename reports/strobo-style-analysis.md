# Strobo: Referenzanalyse und Diagnose der aktuellen Umsetzung

Stand: 28.09.2026. Dieser Schritt ändert keinen Produktionscode.

## Ergebnis

Das gewünschte Gestaltungsmittel ist eine musikalisch komponierte Folge sichtbarer Strahlenformationen. Die Animation entsteht durch das Zusammenspiel von Ausrichtung, Auswahl der leuchtenden Geräte, zeitlicher Reihenfolge, Leuchtdauer und Rollen verschiedener Gerätegruppen. Schnelles Blitzen ist eine mögliche Artikulation innerhalb dieser Gestaltung.

Unsere aktuelle Umsetzung besitzt eine eigene Strobo-Bewegungsplanung. Ihr Modell bleibt aber zu eng: Eine ausgewählte Motorfigur läuft mit einem regelmäßig durchgeschalteten Gruppenmuster. Dadurch kann sie rhythmisch korrekt und technisch flüssig sein und trotzdem wie ein beliebiger Effekt wirken.

## Grundlage und Grenzen

Untersucht wurden die beiden Videoreferenzen als zeitlich geordnete Bildfolgen, darunter eine Detailfolge mit vier Bildern pro Sekunde bei 1:38–1:44 der zweiten Referenz, sowie die aktuelle Implementierung. Die Bildfolgen belegen räumliche Muster, Ebenen und deren zeitliche Abfolge. Sie reichen nicht aus, um sehr kurze Blitzdauern oder die genaue Zuordnung zu Kick, Snare und musikalischen Offbeats zu bestimmen. Eine audiovisuelle Abnahme mit dmx-test.mp3 ist damit noch nicht erfolgt.

Quellen:

- [DJ Jakob: Didn’t expect Halo Moving Heads to look this good!](https://www.youtube.com/watch?v=A4NtCl60yjs)
- [M-Silver Light & Sound: 3D Festival DMX Drone Show](https://www.youtube.com/watch?v=NLfHonq3WEk)
- [grandMA3: Phasers](https://help.malighting.com/grandMA3/2.3/HTML/phaser.html)

Die zweite Referenz kombiniert Moving Heads mit weiteren visuellen Ebenen, unter anderem Drohnen und Pyrotechnik laut Videobeschreibung. Übertragbar sind ihre Komposition und zeitliche Organisation. Nicht jede dort sichtbare Linie ist ein durch unsere vorhandenen Geräte reproduzierbarer Beam.

## Konkrete Beobachtungen

### Zweite Referenz, ungefähr 1:38–1:44

| Zeitraum | Sichtbare Abfolge | Bedeutung für unseren Modus |
| --- | --- | --- |
| 1:38–1:39 | Helle obere Elemente und wechselnde Akzente an der Bühne | Mehrere räumlich getrennte Ebenen haben eigene Aufgaben. |
| 1:39,25–1:40,25 | Blaue Strahlen wechseln zwischen steileren Fächern und seitlich gerichteten Formationen; schmale warme Akzente bleiben erkennbar | Eine gemeinsame Farbe und klar lesbare Geometrie halten die Figur zusammen. |
| 1:40,5–1:40,75 | Blaue Strahlen verschwinden; rote Lichtpunkte und warme Akzente treten hervor | Das Wegnehmen einer Ebene gehört zum Motiv. Dunkelheit ist selektiv. |
| 1:41–1:41,75 | Die blaue Formationsfolge kehrt wieder | Wiederholung schafft Wiedererkennung. |
| 1:42–1:42,25 | Wieder die reduzierten roten Punkte | Die Unterbrechung beziehungsweise Antwort ist selbst Bestandteil des Musters. |
| 1:42,5–1:43,75 | Erneut blaue Fächer und seitliche Ausrichtungen | Vielfalt entsteht auch durch den Verlauf eines zusammenhängenden Motivs. |

Diese Zeiten sind näherungsweise visuell abgelesen. Die Bildfolge allein zeigt nicht, welcher Anteil eines schnellen Formationswechsels durch Motorbewegung oder durch Umschalten bereits ausgerichteter Geräte entsteht.

### Erste Referenz

Hier sind unter anderem rote Halo-Ringe, helle punktuelle beziehungsweise linienförmige Akzente sowie farbige Strahlen zu sehen. Um 2:38–2:44 wechseln grün/weiße Reihen, eine deutlich reduzierte warme Darstellung und gelbe radiale beziehungsweise gekreuzte Strahlenbilder. Auch hier erfüllen Lichtquellen und Strahlen unterschiedliche Aufgaben. Eine gemeinsam modulierte Helligkeit würde diese Unterschiede verlieren.

## Was den gewünschten Stil ausmacht

### 1. Die sichtbare Figur ist die Einheit der Gestaltung

Eine Figur braucht einen räumlichen Gedanken: etwa ein nach außen laufendes Paar, einen sich aufbauenden Fächer oder sich abwechselnde Diagonalen. Welche Geräte dunkel bleiben, bestimmt diese Figur ebenso wie die leuchtenden Geräte. Viele gleichzeitig sichtbare Strahlen können die Geometrie unleserlich machen.

### 2. Ausrichtung und Sichtbarkeit haben getrennte Zeitabläufe

Motoren können eine Position halten, während eine Auswahlfolge Bewegung im Lichtbild erzeugt. Andere Figuren benötigen sichtbare gemeinsame Bewegung. Wieder andere bereiten ihre nächste Ausrichtung im Dunkeln vor. Eine Motorfahrt muss deshalb nicht mit jedem Helligkeitsschritt neu beginnen oder ständig vorwärts und rückwärts laufen.

### 3. Leuchtdauer, Lücke und Überlappung sind Ausdrucksmittel

Kurze scharf begrenzte Impulse, gehaltene Strahlen, abklingende Antworten, Doppelimpulse und unterbrochene Läufe haben unterschiedliche Wirkungen. Weder ein gemeinsames Ausblenden nach jedem Schlag noch eine durchgehende Überblendung zwischen allen Gruppen ist dafür eine allgemeine Lösung.

Technisch werden solche Eigenschaften beispielsweise in grandMA3 getrennt beschrieben: Schrittbreite, Übergangsanteil, Geschwindigkeit, Phasenversatz und Länge des wiederholten Ablaufs sind eigene Größen. Diese Trennung ist für unser Modell relevant; das Handbuch allein legt jedoch keinen passenden künstlerischen Stil fest.

### 4. Gruppen brauchen eigenständige Rollen

Beispiel: Eine Gruppe zeichnet das Hauptmotiv, eine zweite antwortet an dessen Ende, eine dritte setzt einen seltenen Akzent. Sie teilen die musikalische Zeitbasis, benötigen aber eigene Ereignisfolgen, Farben und Pausen. Ein bloßer Versatz derselben Schleife erzeugt diese Rollen nicht.

### 5. Musikalische Passung benötigt mehr als Tempo und Energie

Die zeitliche Position eines Ereignisses und seine Funktion sind entscheidend: wiederholtes Riff, ausgelassener Schlag, Abschluss einer Phrase, Auftakt, Break oder neuer Einsatz. Ein leiser Abschnitt kann ein präzises, lebendiges Motiv brauchen; ein lauter Abschnitt kann durch ein großes gehaltenes Bild wirken. Deshalb ist die allgemeine Zuordnung leise = langsam und laut = schnell unzureichend.

Dies ist eine Gestaltungsanforderung aus Nutzerfeedback und Analyse, keine bereits nachgewiesene automatische Erkennung dieser Ereignisse. Bei unsicherer Audioanalyse muss ein stabiles einfaches Motiv möglich bleiben.

### 6. Wiederholung und Variation erzeugen Zusammenhang

Ein erkennbares Motiv sollte über mehrere Wiederholungen bestehen bleiben. Es kann anschließend gespiegelt, räumlich erweitert, anders besetzt oder am Phrasenende ergänzt werden. Eine hohe Zahl von Effektbezeichnungen beweist keine wahrnehmbare Vielfalt und keinen musikalischen Zusammenhang.

## Abgleich mit dem aktuellen Code

| Befund | Aktuelle Stelle | Konsequenz |
| --- | --- | --- |
| Die Form wird innerhalb einer Kandidatenliste über einen skalaren Tonwert gewählt. | public/dmx-strobe-score.js, strobeMusicalChoice | Kein ausdrücklicher Zusammenhang zwischen einer musikalischen Figur und ihrer visuellen Antwort. |
| Die Grundschritte liegen bei 0,5, 1 oder 2 Beats. | strobeMusicalChoice | Auch bei korrektem Beat-Raster bleiben die Folgen gleichmäßig; konkrete synkopierte oder ausgelassene Ereignisse werden hier nicht modelliert. |
| Die Sichtbarkeitsfolge hängt über form % 6 an der Motorfigur. | strobeComposition | Räumliche Geometrie und zeitliche Artikulation sind unnötig gekoppelt. |
| Gruppen wechseln nach gemeinsamer Schrittzahl und Zeilenbudget. | strobeComposition, membership | Keine eigenständig komponierten Haupt-, Antwort- und Akzentrollen. |
| Die Übergabe erfolgt grundsätzlich als Überblendung am Schrittende. | strobeComposition, handover | Der jüngste Ansatz vermindert gemeinsame Dunkelphasen, vereinheitlicht aber die Artikulation. |
| Motorpfade kehren zyklisch ihre Richtung um. | strobeScore, motionReverse | Mechanische Wiederholung kann den musikalischen Verlauf überlagern. |
| Ein RGB-Wert wird vor der Schleife über die Geräte berechnet. | public/dmx-strobe.js, renderStrobe | Unabhängige Farbrollen sind in diesem Renderer nicht vorgesehen. |
| Der Katalog zählt 20 Muster mal 6 Familien. Die gerichtete Ausgabe verwendet den eigenen Score. | public/dmx-strobe.js, STROBE_ANIMATIONS und renderStrobe | 120 Katalogeinträge sind keine 120 eigenständig komponierten Bühnenanimationen. |

Die frühere Prüfung, ob Helligkeitsglättung kurze Blitze verschluckt, betrifft die korrekte Wiedergabe einzelner Impulse. Sie kann fehlende Komposition nicht beheben.

## Konsequenz für einen späteren Umbau

Die Showplanung braucht pro Motiv unabhängig beschreibbare Bestandteile:

1. Räumliche Formation und reale Gerätegruppen.
2. Position halten, sichtbar fahren oder dunkel vorbereiten.
3. Eine Folge von Licht-Ereignissen mit Zeitpunkt, Gerätegruppe, Dauer und Helligkeitsverlauf.
4. Farbrollen je Ebene.
5. Wiederholungen, Antworten, Pausen und Abschlussvarianten.
6. Regeln, wann das Motiv zur musikalischen Passage passt und wie es in das nächste übergeht.

Die vorhandene musikalische Abschnittsplanung kann dafür Ausgangspunkt bleiben. Erst die Auswahl und Ausgestaltung dieser Motive soll den eigenständigen Strobo-Stil erzeugen. Zusätzliche Zufallsauswahl oder eine bloße Erhöhung der Effektzahl wäre keine ausreichende Lösung.

## Abnahme: Was tatsächlich geprüft werden muss

Ein anschließender Umbau sollte zunächst wenige repräsentative Passagen von dmx-test.mp3 mit dem tatsächlich verwendeten Geräteaufbau als Video mit synchronem Ton zeigen: eine reduzierte Passage, einen Groove, einen Aufbau und einen Höhepunkt samt Übergang.

Für jede Passage müssen folgende Fragen konkret beantwortbar sein:

- Welche hörbare Figur greift das Licht auf?
- Welches sichtbare Motiv wiederholt sich und wo wird es verändert?
- Welche Gruppe führt, welche antwortet, welche pausiert?
- Sind die Strahlenformationen klar lesbar?
- Sind Überlappungen und Dunkelphasen absichtlich gesetzt?
- Hat der Übergang einen musikalischen Anlass?
- Bleibt die Wirkung mit der vorhandenen Gerätezahl und Motorreichweite erhalten?

Ein hilfreicher Gegenversuch: Motorbewegung einfrieren. Bei einem Auswahlmotiv sollte die Animation durch das aufeinanderfolgende Sichtbarwerden verschiedener Strahlen noch erkennbar sein. Das gilt nicht als Pflicht für jede Figur, sondern prüft, ob der Modus überhaupt eigenständige Lichtfolgen besitzt.

Technische Tests sollen anschließend Timing, Gruppenzuordnung, Übergänge und Geräteausgabe sichern. Sie können die musikalische und visuelle Abnahme nicht ersetzen.
