# Automatisch: musikalische Bewegungsabläufe für Gerätegruppen

## Umsetzung

Zehn räumliche Abläufe ergänzen die bestehende automatische Choreografie: gegenläufige Fächer, wandernde Wellen, sich öffnende Bögen, diagonale Lichtvorhänge, verschränkte Paare, Kreisbewegungen, einklappende Tore, gestaffelte Aufwärtsbewegungen, nach außen laufende Wellen und gekreuzte Bänder.

Die Auswahl erfolgt einmal pro musikalischer Passage anhand von Energie, rhythmischem Antrieb, Gesangsanteil, Klangfarbe und bisheriger Verwendung. Unveränderte benachbarte Passagen werden zusammengefasst. Die Bahnen entwickeln sich über die ganze Passage. Die Gruppen haben versetzte Startpunkte, Bewegungsrichtungen und Amplituden; die Geräte werden erst nach Erweiterung auf den tatsächlichen Raum zugeordnet. Keine zufälligen Ziele und kein zusätzlicher Effektwechsel-Timer.

## Gruppen ohne manuelle Vorbereitung

- Explizite Gerätezuordnungen haben Vorrang.
- Unzugeordnete Geräte werden nach Montageposition und Höhe gruppiert.
- Im Großclub entstehen sechs Gruppen mit je zwölf Moving Heads.
- Bei unregelmäßigen Positionen wird die Anlage in räumlich zusammenhängende Gruppen aufgeteilt. Die größte räumliche Ausdehnung bestimmt die Aufteilung.
- Die Zuordnung bleibt bei umsortierten Gerätelisten gleich. Innerhalb einer Gruppe werden die Mitglieder räumlich geordnet.

## Integration und Grenzen

Die Erweiterung gilt für die automatische Raumchoreografie. Die vorhandenen kleinen Ausgangsformationen werden durch räumliche Gruppenbahnen ergänzt. Die Farben bleiben erhalten. Die unten beschriebene Erweiterung der Kompositionen verändert die Besetzung und damit einzelne Gerätehelligkeiten innerhalb des bestehenden Leistungsbudgets. Vorhersage und VR-Interpolation transportieren die Gruppenbewegungen mit. Manuelle Rhythmusvorgaben, Bewegungsstopps, eingeschränkte Gerätebereiche und reduzierte Bewegung werden berücksichtigt.

Die endgültigen Ziele durchlaufen weiterhin Raumgrenzen, Hindernisbehandlung und Motorsteuerung. Explizite Wandziele erhalten keine zusätzlichen Gruppenbahnen. Vorgegebene Bewegungsflächen begrenzen weiterhin die möglichen Figuren: Eine ausschließlich auf den Boden beschränkte Anlage erhält durch diese Änderung keine Deckenfahrten.

## Prüfung

- Fünf neue Regressionstests: zehn unterschiedliche vollständige Bahnen, Entwicklung in der zweiten Passagenhälfte, Gruppierung, manuelle Stops, Determinismus, Vorhersage, Bereiche und endgültige Motorbewegung.
- 37 gezielte Tests bestanden.
- Gesamttest: 792 von 795 bestanden; drei bereits bekannte Fehler in Rhythmus-Erholung und Stage-Motion.
- WebGL-Test mit vier Zuständen des echten vorbereiteten Pretty-Fly-Plans erfolgreich; keine Aussage über Hardware-FPS.
- Derselbe Audioplan wählt im gesamten Lied alle zehn Abläufe aus. Im ersten Refrain folgen unter anderem verschränkte Paare, Kreisbewegung, diagonaler Vorhang und wandernde Welle.

[Musikalischer Ablaufplan](automatic-group-motion-score.json)

Standbilder der isolierten Raumrekonstruktion: [0:50](automatic-group-motion-50.png), [0:52](automatic-group-motion-52.png), [1:16](automatic-group-motion-76.png), [1:18](automatic-group-motion-78.png). Die Rekonstruktion verwendet acht virtuelle Ausgangs-Moving-Heads und gemeinsame statische Farbframes, keine gespeicherte Nutzersitzung. Die zeitliche Bewegungsprüfung erfolgt zusätzlich über die Tests; Standbilder allein zeigen keinen flüssigen Ablauf.

## Nachbesserung: Übergänge ohne gemeinsamen Zwischenstopp

Benachbarte aktive Passagen kehren nicht mehr jeweils vollständig zur Grundstellung zurück. Die auslaufende Bahn wird während einer begrenzten Überblendung fortgesetzt, während die nächste Bewegung übernimmt. Die Übergangsdauer berücksichtigt beide Passagenlängen und beträgt höchstens 1,4 Sekunden. Beginn und Ende einer aktiven Folge sowie ruhige Passagen behalten ihre Ausläufe.

Ein zusätzlicher Regressionstest prüft Position und Geschwindigkeit direkt beidseits der Passagengrenze sowie deterministisches Zurückspringen. 16 gezielte Tests bestehen; im Gesamttest bestehen 793 von 796 Tests, mit denselben drei bekannten Fehlern. Diese Prüfung betrifft die zusätzlichen Gruppenbahnen; die vorhandene Hauptchoreografie besitzt weiterhin bewusst gehaltene Ziele und einzelne Akzentbewegungen. Eine visuelle Abnahme der konkreten Nutzersitzung steht noch aus.


## Erweiterung: sechs Kompositionen für Automatisch

Die automatische Auswahl der musikalischen Gruppenabläufe steuert jetzt sechs vollständige Kompositionen:

- **Lichtvorhang:** gemeinsame Linie mit freien Zwischenräumen bei größeren Gruppen.
- **Spiegelpaare:** äußere und innere Paare öffnen und schließen sich gemeinsam.
- **Wandernde Gruppe:** eine weiche Lichtübergabe wandert durch benachbarte Geräte.
- **Rahmen und Mitte:** ein schwächerer, ruhiger Rahmen begleitet die bewegte Mitte.
- **Frage und Antwort:** zwei Seiten übernehmen das Licht nacheinander.
- **Sammeln und Öffnen:** Ausdehnung und Zahl aktiver Mitglieder entwickeln sich gemeinsam.

Die Ziele werden direkt in die erlaubte Bewegungsfläche eingepasst. Zusätzliche Offsets, die an deren Rand abgeschnitten werden, bestimmen diese Kompositionen nicht mehr. Die Komposition übernimmt auch die Geräteauswahl innerhalb der aktiven Gruppen, damit sich verschiedene Paarmasken nicht gegenseitig vollständig ausblenden. Statische Begleitleuchten behalten ihre bisherige Steuerung. Räumliche Gruppierung gilt auch für kleine Anlagen.

Position und Besetzung werden gemeinsam überblendet; vorübergehend dunkle Mitglieder können ihre nächste Position vorbereiten. Farben, Blackouts, Bewegungsbereiche und die bestehende Begrenzung für große Anlagen bleiben berücksichtigt.

Prüfung dieser Erweiterung: 13 gezielte Tests bestanden, darunter sechs unterschiedliche Zielanordnungen auf einer Fläche von 1,6 × 1,2 Metern, verschiedene Besetzungen, kleine und ungerade Gerätezahlen, Blackouts und stetige Übergänge an Passagengrenzen. Gesamttest: 797 von 800 bestanden; dieselben drei zuvor bekannten Fehler in Rhythmus-Erholung und Stage-Motion. Die oben verlinkten Bilder stammen von der vorherigen Gruppenbahn-Version; sie sind keine visuelle Abnahme dieser sechs neuen Kompositionen. Die Wirkung im laufenden Lied muss noch in der Nutzersitzung beurteilt werden.

## Intensität bei dichter Musik

Die Kompositionen behalten bei hoher Passagenenergie zusätzliche Mitglieder als Begleitung (bis 45 % des jeweiligen Hauptlichtpegels). Kräftige, gleichbleibende Grooves dürfen bis zu denselben Reihenanteil wie Impacts nutzen. Damit wirken wenige ausgewählte Paare, Reihenbegrenzung und die feste Leistungsgrenze großer Anlagen nicht mehr unabhängig von der musikalischen Energie gemeinsam abdunkelnd. Quellhelligkeit, Blackouts, Farben und Wash-Begrenzung werden nicht angehoben.

Offline-Vergleich mit dem vorhandenen Atomic-Damage-Analyseplan im 192-Geräte-Preset: beispielsweise steigt die maximale summierte normierte Gerätepower im Fenster 40–48 s von 38,566 auf 42,521, das Minimum von 3,070 auf 3,557. Das sind Steuerwerte, keine photometrische Messung oder visuelle Abnahme. Der Plan enthält keine gespeicherte Nutzersitzung. 15 gezielte Tests prüfen zusätzlich die stärkere Besetzung, unveränderte Hauptlichtobergrenze und weiterhin funktionierende Blackouts.
