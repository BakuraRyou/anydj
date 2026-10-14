# Strobo: räumliche Strahlenbilder

## Umsetzung

Strobo besitzt jetzt eine eigene Raumprojektion. Die normierten Formationskoordinaten werden auf eine gemeinsame vertikale Ebene im Raum abgebildet. Die Richtung jedes Strahls ergibt sich aus seiner tatsächlichen Montageposition und diesem gemeinsamen Bild. Unterschiedliche Montagehöhen und Tiefen erzeugen deshalb keine unabhängigen lokalen Bewegungsmuster mehr. Der Strahl endet an der ersten getroffenen Raumfläche; bestehende Ausschlussbereiche werden weiterhin berücksichtigt.

Für Geräte mit ausdrücklich geplanten Wandbereichen fordert die Strobo-Komposition jetzt die Wandprojektion an. Zuvor war wallBlend für jedes Motiv null, wodurch diese Wandfiguren unterdrückt wurden. Explizite Bewegungsbereiche behalten ihre eigene Begrenzung.

Die Änderung gilt ausschließlich für Strobo. Die Raumprojektionen von Automatisch und Show wurden nicht geändert. Die vorhandene Auswahl der sichtbaren Strahlen und die musikalischen Motive bleiben an die Geometrie angeschlossen. Optische Geräteparameter und Strahlbreiten werden nicht künstlich verändert.

## Prüfung

- Bestehende 537 DMX- und Showprofil-Tests bestanden.
- Vier neue Tests für gemeinsame räumliche Ziele trotz unterschiedlicher Montagehöhe und Tiefe, verschiedene erhöhte Formationen, Wandbereiche und bestehende Bewegungsbegrenzungen bestanden.
- Abschließende gezielte Suite: 69 Tests bestanden.
- Vollständiger Offline-Durchlauf des gespeicherten Plans von dmx-test.mp3: 216 Sekunden, 15 Hz, Raum-Preset mit 48 Moving Heads. Messwerte: strobo-space.json.
- Geometrieansicht: strobo-spatial-figures.png. Sie zeigt die berechneten Strahlen mit allen Geräten sichtbar, ohne zeitliche Lichtfolge. Sie ist keine Aufnahme der Anwendung und keine audiovisuelle Abnahme.

## Grenze der Prüfung

Der tatsächliche gespeicherte Geräteaufbau aus dem Nutzervideo liegt nicht als Raumplan vor. Die neue Ausgabe wurde deshalb mit analytischen Tests und einem Raum-Preset geprüft. Die Gesamtwirkung zur Musik in genau diesem Aufbau ist noch nicht bestätigt.

Für einen laufenden Server ohne automatische Neustarts ist ein Neustart nötig, damit die neue JavaScript-Datei ausgeliefert wird; anschließend die Seite neu laden.
