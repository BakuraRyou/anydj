# Eigener Raum und AR-Aufbauplanung

Der DJ-Modus kann eigene Raumgrundrisse und maßhaltige Geräteaufstellungen speichern. Die Raumpläne funktionieren in der normalen 3D-Vorschau, in VR und als Platzierungshilfe über dem realen Raum in AR. Hardwareunterstützung wird über WebXR-Funktionen geprüft; es gibt keine Hersteller-Auswahl und keine Bindung an eine Quest-Gerätekennung.

## Geführter Einstieg am Rechner

Unter **Lichtshow → 3D-Ansicht → Raum → Deinen Raum planen** führt ein Assistent durch drei Schritte:

1. **Raum:** Wähle „Maße eingeben“, „Grundriss zeichnen“ oder „Mit der Brille erfassen“. Ein rechteckiger Raum braucht zunächst nur einen Namen und seine Maße. Für andere Formen wählst du zunächst die Außenmaße und dann „Raumecken im Plan setzen“. Anschließend klickst du die Ecken direkt im gerasterten Plan an. Die Ecken sind nummeriert, eine Linie folgt dem Mauszeiger, und „Letzten Punkt entfernen“ korrigiert Eingaben. Erst „Raumform übernehmen“ oder ein Klick auf die erste Ecke schließt den Grundriss und übernimmt ihn. Abbrechen lässt den gespeicherten Grundriss bestehen.
2. **Geräte:** Wähle einen Gerätetyp, beispielsweise Moving Head, Scheinwerfer, LED-Bar, Stativ oder Traverse. Anschließend erscheint eine Platzierungsvorschau im Plan. Ein Klick innerhalb des Raumes speichert den Standort. Geräte lassen sich über ihre nummerierten Symbole oder die benannte Geräteliste auswählen und direkt im Plan ziehen. Höhe und Drehung stehen beim ausgewählten Gerät; exakte Koordinaten und Außenmaße befinden sich unter „Genau positionieren & Gerätemaße“. Hinzufügen, Entfernen und Änderungen können über „Letzte Änderung rückgängig“ zurückgenommen werden. Escape beendet eine laufende Platzierung oder Zeichnung.
3. **Fertig:** Die Zusammenfassung zeigt Raummaße und Gerätezahl. Der Raum kann in der Lichtshow verwendet, in AR geöffnet oder vom Headset an den Rechner gesendet werden. Die Oberfläche zeigt bei fehlendem AR-Zugang die nötigen nächsten Schritte zur Brille.

Du brauchst für die ersten Planungsgeräte keine verbundenen Lampen. Sie sind maßhaltige Platzhalter mit Beispielmaßen, die du an deine tatsächlichen Geräte anpassen kannst. Unter „Geräte aus meiner Lichtshow“ kannst du bestehende Showgeräte einzeln oder gemeinsam übernehmen. „Showgeräte konfigurieren“ führt zur bestehenden Geräteverwaltung; von dort gelangst du mit „Zurück zur Raumaufstellung“ wieder zum Plan. Bei einem aktiven eigenen Raum öffnet auch der obere Reiter **Geräte** direkt die Aufstellung dieses Raumes.

Gespeicherte Räume, Duplizieren, Löschen sowie Import und Export sind unter **Gespeicherte Räume & Dateien** zusammengefasst. Bestehende Raumpläne werden weiter gelesen; Gerätenamen können nachgetragen werden. Änderungen des Grundrisses, die Geräte außerhalb des Raums zurücklassen würden, werden mit einer konkreten Erklärung abgewiesen.

Positionen sind in Metern gespeichert und werden beim Wechsel zum eigenen Raum nicht proportional skaliert. Die Geräte werden als Quader mit den eingetragenen Außenmaßen dargestellt. Nicht mehr in der Live-Show vorhandene Geräte bleiben als ausgeschaltete Platzhalter sichtbar. Die Aufbauplanung verändert keine DMX-Konfiguration oder echte Lichtausgabe.

## Aufnahme und Platzierung in der Brille

**AR starten** wird separat von VR auf `immersive-ar` geprüft. Wie bei VR ist eine vom Headset akzeptierte HTTPS-Verbindung nötig. Am Rechner **VR-Vorschau verbinden → Übertragung starten** wählen, den Zugang im Headset öffnen und koppeln. **Raum vom Rechner übernehmen** lädt dort den aktiven Plan; nachfolgende Showframes überschreiben keine lokalen Planänderungen.

Das Menü steht am linken Controller, ohne linken Controller vor dem Kopf. Mit dem rechten Controller zeigen und den Zeigefinger-Trigger kurz drücken. Das Menü zeigt jeweils die Aktionen des aktuellen Schritts:

- **Raum automatisch erkennen:** Bereitgestellte Bodenflächen prüfen oder, wenn möglich, die Raumeinrichtung öffnen. Die gewählte Fläche ist grün umrandet. „Andere Bodenfläche“ wechselt die Auswahl, „Diesen Boden verwenden“ übernimmt sie. Wird kein Scan angeboten, bleibt „Ecken selbst setzen“ verfügbar.
- **Raumecken selbst setzen:** Auf die Ecken am Boden zeigen und jeweils einmal den Trigger drücken. Die Punkte erhalten Markierungen und Nummern; eine Linie zeigt die nächste Wand. „Raumform fertig“ wird ab drei Punkten verfügbar. „Letzte Ecke zurück“ und „Abbrechen“ bleiben im selben Menü erreichbar.
- **Bodenhöhe:** Falls die Brille keine Bodenreferenz liefert, schiebt der Ablauf diesen Schritt automatisch ein. Rechten Controller zum Boden halten und Trigger drücken. Danach geht es mit dem zuvor gewählten Arbeitsschritt weiter. Der Controller-Ursprung ist die manuelle Referenz, keine automatisch gemessene Gehäuse-Unterkante.
- **Geräte aufstellen:** Nach Raumaufnahme oder Ausrichtung führt das Menü direkt zur Geräteplanung. Ein neues Gerät wird sofort zur Platzierung angeboten. Eine grüne Vorschau folgt dem Bodenstrahl; außerhalb des Grundrisses wird sie rot. Ein Triggerdruck speichert den Standort und führt zurück zu Höhe, Drehung und Geräteauswahl. Weitere Triggerdrücke auf den Boden versetzen das Gerät nicht versehentlich.
- **Aufstellung fertig:** Die Übersicht bestätigt die lokale Speicherung. „An Rechner senden“ überträgt den Raumplan über die gekoppelte Verbindung und zeigt die Rückmeldung des Rechners. „Geräte weiter bearbeiten“ führt zur Aufstellung zurück. Über „Musik steuern“ ist das vorhandene Deck-Pult erreichbar; der linke Trigger führt zum Raumplan zurück.

Das ausgewählte Gerät ist gelb umrandet. Künstliche Stick-Fortbewegung und Snap-Turn bleiben in AR deaktiviert. Gerätemaße und frei gewählte Namen werden im Raumeditor außerhalb der immersiven Sitzung bearbeitet.

Passthrough benötigt keine Kamerabilder in JavaScript. Übernommen werden bereitgestellte Flächen und der Grundriss; es entsteht kein fototexturiertes Raummodell. Raumscan, Bodenreferenz und Anker sind optionale Fähigkeiten. Der Raumscan ist pro Sitzung höchstens einmal anforderbar.

## Wiederverwenden und Genauigkeit

Ein neuer AR-Einstieg blendet Geräte aus, bis der Raum ausgerichtet ist. **Gespeicherten Raum ausrichten** setzt zwei Bezugspunkte auf dem Boden: A an der vorderen linken Ecke des Begrenzungsrechtecks des Raumplans, B an der vorderen rechten Ecke. Die Punkte sind im 2D-Plan markiert, auch wenn sie bei einem konkaven Grundriss nicht auf physischen Wandecken liegen. Der gemessene A–B-Abstand und die geplante Breite werden zur Kontrolle angezeigt. Die Kalibrierung verschiebt und dreht die Planung, skaliert sie aber nicht.

Unterstützte Raumanker stabilisieren die Ausrichtung. Falls persistente Anker verfügbar und lokal speicherbar sind, wird der Anker beim nächsten Einstieg wiederhergestellt. Ankerkennungen verbleiben auf dem jeweiligen Headset und werden weder exportiert noch an den Rechner übertragen. Bei fehlendem oder verlorenem Anker kann jederzeit über die beiden Bezugspunkte neu ausgerichtet werden. Bei ausbleibender Ankerpose werden Geräte ausgeblendet. Ein Reset des Referenzraums ohne Anker fordert eine erneute Ausrichtung.

Gespeicherte Zahlenwerte sind keine Zusage zur realen Tracking-Genauigkeit. Vor dem Aufbau Maße und Bezugspunkte mit realen Referenzen kontrollieren. Insbesondere Raumscan-Vollständigkeit, Controller-Handhabung, Ankerwiederherstellung und Drift müssen auf der Quest 3 praktisch geprüft werden.

## Speicherung und Grenzen

- Bis zu 20 lokale Raumpläne, mit Name, Grundriss, Raumflächen und Geräteaufstellung.
- JSON-Import und -Export zum Übertragen und Sichern.
- Maximal 128 Grundrisspunkte, 128 Flächen mit je 128 Punkten, 512 Geräte und 256 KB pro Plan.
- Raummaße bis 60 × 60 m und 15 m Höhe. Ein Raum kann rechteckig oder ein einfacher konkaver Grundriss sein; getrennte Etagen und Löcher im Grundriss sind nicht Teil dieses Formats.
- Die Geräteposition bezeichnet den Mittelpunkt der horizontalen Grundfläche und die Unterkante des Geräteplatzhalters. Der Richtungspfeil zeigt die eingestellte Drehung. Es gibt keine automatische Kollisions-, Traglast- oder Montagemachbarkeitsprüfung.
- Speicherung und Transfer validieren Geometrie und Größen. Gespeicherte Aufstellungen ersetzen nicht automatisch die reale Geräteanordnung oder Lichtprogrammierung.

## Prüfung

`test/dmx-ar.test.mjs` prüft metrische Koordinaten, konkave Grundrisse, Aufnahme aus XR-Flächen, Controller-Platzierung, kontextbezogene Menüs, Abbrechen, Platzierungsvorschau, Referenzraum-Reset, Anker-Lebenszyklus, Tracking-Verlust, AR-Verfügbarkeit und Berechtigungsfehler. Die Relay-Tests prüfen authentifizierte Raumübertragung einschließlich größerer Pläne und ungültiger Daten.

`node scripts/check-dmx-ar.mjs` prüft im echten Headless-Chrome den Erstbenutzer-Ablauf mit echten Klicks und Ziehen, Zeichnen eines konkaven Grundrisses, Platzierung innerhalb und außerhalb der Raumgrenzen, Rückgängig, Persistenz nach Neuladen, Übertragung zwischen Headset-Ansicht und DJ-Rechner mit Rückmeldung sowie transparenten WebGL-Hintergrund, Gerätegeometrie und das AR-Pult. XR-Sitzungen und Raumtracking werden simuliert. Ein echter Quest-3-Test ist in dieser Entwicklungsumgebung nicht möglich.

Technische Grundlagen: [WebXR Plane Detection](https://immersive-web.github.io/plane-detection/), [WebXR Anchors](https://immersive-web.github.io/anchors/), [Meta WebXR Mixed Reality](https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/).

## Direkte Controller-Platzierung

Nach dem Erfassen oder Ausrichten des Raums stehen Moving Head, Scheinwerfer und LED-Bar direkt im Pult. Ein Trigger auf den Gerätetyp startet eine Vorschau des tatsächlichen Gerätekörpers; ein weiterer Trigger auf den Boden platziert die Leuchte. Bis dahin bleibt das Gerät ein Entwurf. Abbrechen hinterlässt kein zusätzliches Gerät.

Vorhandene Leuchten lassen sich mit dem rechten Controller direkt anvisieren. Eine grüne Umrandung zeigt das getroffene Gerät. Die seitliche Greiftaste halten, den Controller bewegen/anheben/drehen und loslassen: Die Leuchte folgt dem Zeiger in der beim Greifen gewählten Entfernung, ihre Höhe und Drehung folgen der Handbewegung. Während des Greifens bricht der Trigger die Änderung ab. Alternativ erlaubt ein Trigger auf die Leuchte und ein weiterer auf den Boden das Versetzen ohne gehaltene Greiftaste.

Die Vorschau und der Zeiger werden bei ungültigen Standorten rot. Ungültiges Loslassen, verlorenes Controllertracking, unterbrochene Sitzungen und abgebrochene Greifgesten ändern den gespeicherten Standort nicht. Der erfolgreiche Abschluss verwendet das WebXR-Ereignis `squeeze`; `squeezeend` allein gilt als Abbruch. Siehe [WebXR-Eingabeereignisse](https://www.w3.org/TR/webxr/#event-types).

„Rückgängig“ nimmt die letzte gespeicherte Platzierung oder Geräteänderung zurück. Zahlenwerte und schrittweise Korrekturen stehen unter „Weitere Einstellungen“. Die fertige Aufstellung wird weiterhin ausdrücklich über „Fertig / Senden → An Rechner senden“ an das laufende Deck übertragen.

Validiert mit Controller-Ereignistests für Auswahl, räumliche Bewegung, Drehung, Vorschau, Abschluss/Abbruch, Raumgrenzen, Trackingverlust und Rückgängig sowie den AR- und IWER-Browserchecks. Greifgefühl und Lesbarkeit müssen noch mit echten Controllern beurteilt werden.
