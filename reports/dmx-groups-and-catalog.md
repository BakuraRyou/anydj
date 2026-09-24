# Gerätegruppen und Gerätekatalog

## Bedienung

Im Gerätemanager mehrere Scheinwerfer über die Kästchen auswählen und **Auswahl fest gruppieren** anklicken. Die Gruppe kann benannt werden und erscheint oberhalb der Geräteliste. Ein Klick auf die Gruppe oder ein Mitglied wählt die Einheit aus. Gemeinsame Lichtstärke, Lichtgruppe und bei Moving Heads Bewegungsbereich gelten für die ausgewählten Mitglieder.

Neue Scheinwerfer auswählen, unter **Zu vorhandener Gerätegruppe** die Zielgruppe wählen und **Auswahl hinzufügen** anklicken. Bereits gruppierte Auswahlen werden als ganze Einheit übernommen. **[Scheinwerfername] herauslösen** löst den aktuellen Anker aus der Gruppe; **Gruppe auflösen** erhält alle Scheinwerfer und Positionen. Gruppen mit weniger als zwei Mitgliedern werden aufgelöst.

Position und Montagehöhe verschieben die Auswahl gemeinsam, mit erhaltenen Abständen und Höhenunterschieden. **Drehung** und **+90° drehen** drehen eine Gruppe um ihre geometrische Mitte in der Draufsicht. Lichtziele bleiben ortsfest, wie in der Oberfläche beschrieben. Eine Drehung außerhalb des Raums wird vollständig abgewiesen. Auch Verkleinern des Aufbaus und symmetrisches Zurücksetzen dürfen feste Gruppen nicht auseinanderziehen.

Gerätegruppen werden im bestehenden lokalen Aufbau gespeichert, getrennt von den musikalischen Lichtgruppen Links/Rechts/Hintergrund. Es handelt sich um frei zusammengestellte Einheiten, nicht um auf Herstellervorlagen beschränkte Gruppen.

## Katalog und Ausgabe

**Aus Gerätekatalog hinzufügen** bietet Suche, Modus, Handbuchlink und Hinzufügen zum selben Aufbau. Der Startkatalog enthält sieben Profile etablierter Hersteller, keine behauptete Marktanteilsrangliste. Die DMX-Ausgabe verwendet deren konkrete Kanalbelegung; die Vorschau decodiert dieselben Werte. ADJ UV bleibt aus; interne Programme, Strobe und Makros werden nicht aktiviert. Startadressen werden weiterhin fortlaufend vergeben und in jeder Gerätezeile angezeigt. Bei Änderungen am Aufbau müssen die Adressen an den echten Geräten übereinstimmen.

Herstellerquellen, geprüft am 24.09.2026:

- [CHAUVET DJ SlimPAR 56, 3-CH RGB, S. 11](https://www.chauvetdj.com/wp-content/uploads/2015/12/SlimPAR_56_UM_Rev7_WO..pdf)
- [CHAUVET DJ SlimPAR 64, 3-CH RGB, S. 10](https://www.chauvetdj.com/wp-content/uploads/2015/12/SlimPAR_64_UM_Rev6_WO.pdf)
- [Cameo FLAT PAR CAN RGB 10 IR und TRI 3W IR, 3-Kanal-Modus 2, S. 6 und 15](https://www.cameolight.com/en/downloads/file/id/821189964)
- [ADJ Mega TriPar Profile Plus, 4CH RGB+UV, S. 17](https://assets.centryngroup.com/dl/files/MEGATRIPARPROFILEPLUSUSERMANUAL.pdf)
- [Stairville LED PAR 56/64 10 mm RGB, 7 Kanäle, S. 28–29](https://images.thomann.de/pics/atg/atgdata/document/manual/215926_c_115012_115025_215918_115048_215926_115050_v3_en_online.pdf)

Die lokale Ausgabe erfolgt über die vorhandene OLA-Anbindung. Es fand kein Test mit angeschlossenen Lampen statt. Moving Heads bleiben eine geometrische Vorschau ohne Ausgabe von Pan/Tilt-Motorkanälen. Die Gruppe verändert die Aufstellung in der Vorschau, nicht die mechanische Montage eines realen Geräts.

## Prüfung

- `node --test test/dmx-*.test.mjs`: 117 Tests bestanden, inklusive Rotation, Abstandserhalt, Persistenz, Raumgrenzen, Profilkanäle, Vorschau, Blackout und Universumgrenze.
- `node scripts/check-dmx-groups.mjs`: Erstellen, Drehen, gemeinsames Verschieben/Lichtstärke, Mitglieder hinzufügen/herauslösen, Neuladen, Katalogsuche/Hinzufügen und mobile Breite.
- `node scripts/check-dmx-layout.mjs`: bestehende Aufstellungsinteraktionen.
- `node scripts/check-device-manager-performance.mjs`: 20 Geräte, 3 Sekunden Scrollen, 351 Layouts und 4512 SVG-Mutationen; weiterhin innerhalb der Grenzen des optimierten Managers. Lokaler Headless-Test, kein Hardware-FPS-Versprechen.
