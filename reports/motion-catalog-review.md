# Bewegungsprüfung: Automatik und Show

## Umfang und Grenzen

Geprüft wurden alle 13 aktiven Gruppenformen und alle 8 Show-Grundbilder. Die zehn bisherigen Gruppenformen und sechs bisherigen Show-Bilder sind unten einzeln bewertet. Die drei Show-Aktionen Hit, Answer und Launch bleiben Akzent-/Belegungssteuerung; ihre Motorbewegung kommt aus dem gemeinsamen Bewegungsplan. Alte Offsetpfade bleiben als kompatibler Fallback vorhanden und unterstützen auch die neuen Einträge.

Die Bewertung betrifft Geometrie, musikalische Auswahl, Übergänge und die technische Raum-/Motorpipeline. Sie ist keine visuelle Abnahme sämtlicher Lieder und kein Nachweis photometrischer Realitätsnähe. Die Tests im Preset „Club-Bühne · Publikum & Hintergrund“ prüfen alle Gruppenformen mit 48 Moving Heads, in beiden Modi und mit/ohne Ruhezonen auf gültige Ausgaben. Sie beweisen nicht, dass jeder Umweg ästhetisch überzeugt.

[Bahnübersicht](motion-catalog.svg) · [Messdaten](motion-catalog.json)

Die Übersicht zeigt normalisierte Zielbahnen. Gruppen werden über zwei Phasenumläufe, Show-Bilder über eine Passage abgetastet. Weglängen beider Kategorien sind deshalb nicht direkt vergleichbar. Mehr Weg ist kein Qualitätskriterium.

## Gruppenformen

| Form | Wirkung und Entscheidung |
| --- | --- |
| curtain | Klare Lichtlinie, wenig Bewegung. Aus treibenden, energiereichen Passagen ausgeschlossen. |
| mirror-pairs | Symmetrisches Öffnen; als geordnete Paarfigur beibehalten. |
| traveling-group | Wirkung hauptsächlich durch wandernde Helligkeit. In energiereicher Automatik ausgeschlossen; Show verwendet hier die wandernde Linie, weil Show die Belegung selbst steuert. |
| frame-center | Ruhiger Rahmen mit wenig bewegtem Zentrum. Aus energiereichen, treibenden Passagen ausgeschlossen. |
| question-answer | Verständliche Übergabe zwischen Hälften. Beibehalten. |
| gather | Konzentration zur Mitte als Aufbau brauchbar. Bei hoher Energie außerhalb von Aufbauten ausgeschlossen. |
| diagonal-sweep | Gemeinsame schräge Linie, gegensinnige Reihen bewusst gestaltet. Beibehalten. |
| depth-wave | Zeitversetzte Welle über Geräte und Reihen; beabsichtigte Staffelung, keine Unisonofigur. Beibehalten. |
| rotating-fan | Fächer mit gemeinsamer Rotation und festem Unterschied zwischen Reihen. Beibehalten. |
| crossed-banks | Gegenläufige Bänder mit getrennten Zentren. Beibehalten. |
| parallel-sweep (neu) | Ganze Linie wandert gemeinsam seitlich und in die Tiefe. Keine unabhängige Phase pro Kopf. |
| breathing-arch (neu) | Symmetrischer Bogen öffnet und schließt sich; gemeinsames Anheben und Senken. |
| hinged-lines (neu) | Zwei Linienhälften schwenken um getrennte Ansatzpunkte. Die Gruppen bleiben räumlich lesbar. |

Unpassende Formen sind aus den jeweiligen Auswahlkontexten entfernt, nicht aus gespeicherten Daten gelöscht. Die Regeln gelten auch beim Wiederaufnehmen eines Motivs. Neue Formen werden anhand musikalischer Merkmale gewählt, nicht über einen zusätzlichen Wechseltimer.

## Show-Grundbilder

| Form | Wirkung und Entscheidung |
| --- | --- |
| parallel | Großes gemeinsam gerichtetes Bild; bleibt als ruhiger Gegenpol. |
| fan | Öffnender Fächer; für Aufbau und räumliche Breite beibehalten. |
| converge | Statische Konzentration. Aus gewöhnlicher Formauswahl entfernt, nur für Aufbau/Einsatz verfügbar. |
| cross | Prägnantes gekreuztes Grundbild, Entwicklung durch Gruppenbewegung. Beibehalten. |
| wings | Seitliches Öffnen mit unterschiedlicher Höhe. Beibehalten. |
| tiers | Gestaffeltes Bild und Ruheposition. Beibehalten. |
| arc (neu) | Bogen über die Geräte, sich musikalisch öffnend. Auch für gesangsbetonte Bilder vorgesehen. |
| ribbon (neu) | Diagonales Band mit gemeinsamem seitlichem Verlauf. Für treibende Passagen vorgesehen. |

## Übergänge

Die auslaufende Gruppenform behält während der Überblendung ihre Bindung. Zuvor verlor sie zusätzlich zur Überblendung ihre eigene Gewichtung; dadurch konnte die alte Einzelbewegung zwischen zwei Figuren sichtbar werden. Bewegungsphase und Geschwindigkeit der auslaufenden Figur laufen weiter. Manuelle Bewegungshalte, Blackouts, Wandgrenzen und Ruhezonen bleiben aktiv.

Ein bestehender Test verlangte für jede Form zusätzliche Helligkeit bei höherer Energie. Für neue, vollständig belegte Linien ist das weder möglich noch sinnvoll. Der Test verlangt jetzt weiterhin stabile Führungslichter und Leistungsgrenzen; zusätzliche Unterstützung nur dort, wo zuvor tatsächlich unbeleuchtete/gedimmte Mitglieder vorhanden waren.

Reproduzierbare Geometrieprüfung: `node scripts/review-motion-catalog.mjs`. Für eine abschließende subjektive Bewertung sollten unterschiedliche reale Lieder und besonders beanstandete Zeitstellen folgen.

## Nachprüfung der Bahnkoordination

Gemeinsame Phasen allein ergaben bei mehreren Formen keine spiegelgleichen Bahnen. Neue Pläne legen deshalb `symmetry: paired` fest. Gegenüberliegende Mitglieder verwenden dieselbe Bahn mit gespiegelter Querposition; Tiefe und Verlauf bleiben gleich. Das gilt auch während Gruppenübergängen. Gemeinsame seitliche Quellbewegung verändert die Öffnung, statt die Figur aus der Mitte zu verschieben. Die Show-Grundbilder übernehmen dieselbe Paarbeziehung.

Zusätzlich hing die Höhe eines Wandziels bisher linear von der Querposition ab. Bei gepaarten Figuren wird nun der Abstand zur Mitte verwendet: Beide Mitglieder erhalten dieselbe Höhe. Asymmetrische Raumbegrenzungen werden dadurch nicht aufgehoben.

Neue Tests prüfen alle Gruppenformen und Show-Bilder auf Paargeometrie. Ein sechssekündiger Verlauf mit 48 Moving Heads im Bühnenraum prüft gespiegelte Auftreffpunkte nach Wandprojektion und Motorsteuerung, in Automatik/Show und mit/ohne Ruhezonen. Das ist ein synthetischer Regressionstest, keine Abnahme jeder Passage einer realen Nutzersitzung. Die Bahnübersicht wurde für die gepaarten Varianten neu erzeugt.
