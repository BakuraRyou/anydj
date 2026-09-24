# VR-Lichtvorschau

Im 3D-Fenster gibt es **VR starten**. Vorher den gewünschten Startpunkt in der Ego-Perspektive wählen und die Show starten. Der Browser fragt beim Einstieg die VR-Berechtigung ab. Beide Augen erhalten die eigene Projektions- und Ansichts-Matrix des Headsets. Physisches Umsehen und Schritte werden über die laufenden WebXR-Posen übernommen. Beenden direkt über **VR beenden** auf dem VR-Pult, alternativ über das Headset-Menü.

Die vorhandene Geometrie für Raum, Boden, Geräte, Strahlen, Ruhezonen und optionale Gäste wird von Desktop- und VR-Renderer gemeinsam verwendet. VR rendert mit WebGL und einem eigenen WebXR-Framezyklus; die Desktop-Darstellung pausiert währenddessen. Die aktuelle Lichtshow bleibt Datenquelle. Transparente Lichtkegel werden in VR additiv dargestellt. Geometrie wird pro Frame einmal aufgebaut/hochgeladen und für beide Augen wiederverwendet.

## Voraussetzungen

- Ein Headset samt Browser/Runtime, das `immersive-vr` über WebXR unterstützt. Die Oberfläche prüft die Verfügbarkeit, ohne automatisch eine Sitzung zu starten.
- Ein sicherer Browserkontext. Für ein eigenständiges Headset im LAN muss die App über HTTPS mit einem vom Headset vertrauten Zertifikat erreichbar sein. `http://<PC-IP>` reicht nicht. `localhost` bezeichnet im Headset das Headset selbst.
- Der bestehende Server unterstützt `--https --lan` mit `SSL_CERT_FILE` und `SSL_KEY_FILE`; Zertifikat und Erreichbarkeit müssen zur LAN-Adresse passen. Der vorhandene `dev:https`-Helfer ist auf localhost ausgelegt und richtet keine Headset-Vertrauensstellung ein. Hier wurden keine Zertifikate installiert oder Netzwerkfreigaben geändert.

WebXR-Grundlage: [W3C WebXR Device API](https://www.w3.org/TR/webxr/), insbesondere immersive Sessions, Referenzräume, Viewer-Posen und XRWebGLLayer. Die Sitzung bevorzugt `local-floor`; bei `local` wird die eingestellte Augenhöhe als Bodenversatz verwendet.

## Umfang und Grenzen

Immersive Show-Vorschau mit Kopf-/Positionstracking und einem kompakten Pult über dem linken Controller. Der rechte Controller zeigt auf Schaltflächen; der Trigger wählt sie aus. Deck A/B, Play/Pause und ±10 Sekunden steuern den vorhandenen Musiktransport. Ohne linken Controller erscheint das Pult vor dem Betrachter. Der linke Stick bewegt mit 1,4 m/s relativ zur Blickrichtung, der rechte dreht in 30°-Schritten. Keine Teleportation. Startort/Blickrichtung werden beim Eintritt übernommen. Physische Bewegung wird unverfälscht getrackt, ohne virtuelle Wandkollision oder künstliche Kopfbegrenzung. Musikbefehle wirken auf das echte Deck und damit auch auf die daran gekoppelte Lichtshow. Virtuelle Fortbewegung bleibt innerhalb des Raums; physisches Tracking wird nicht begrenzt.

Ohne Headset testbar sind der deaktivierte Einstieg mit Erklärung, der WebGL-Renderer und der Sitzungsablauf mit simulierten XR-Schnittstellen. Ein reales Headset war für die Entwicklung nicht verfügbar; Komfort, Headset-Bildrate und konkrete Browser/Runtime-Kompatibilität bleiben am Gerät zu prüfen.

## Validierung

- 123 DMX-Tests bestanden, darunter sechs VR-Tests: Koordinaten, gemeinsame Geometrie, Sitzungsende, Berechtigungsfehler/Wiederholung, Bodenfallback und verspätete Ressourcen nach Abbruch.
- `scripts/check-dmx-vr.mjs`: echtes WebGL im Headless-Browser mit simuliertem XR-Framebuffer, Shader-Kompilierung, zwei Eye-Viewports, unterschiedliche Pixel durch Stereo-Parallaxe, keine GL-Fehler.
- Bestehender 3D-Browsertest bestanden: Lazy Loading, Ego/WASD, Raumgrenzen, Vollbild, Mobilansicht und keine Hardware-Sitzung.
- Transport-Browsertest für Musik und integrierten Lichtmanager bestanden.

## Einrichtung ohne Kenntnis der Anschlussart

„VR einrichten“ ergänzt die Werkzeugleiste. Es wird weder ein Modell noch eine Verkabelung abgefragt. Der Verfügbarkeitscheck unterscheidet sicheren Kontext, WebXR-Schnittstelle, angebotenes immersive-vr und Fehler. Ein negatives Runtime-Ergebnis wird ausdrücklich nicht als Beweis für ein physisch fehlendes Headset dargestellt. Die Verbindung kann manuell, bei WebXR-devicechange und beim Zurückkehren zum Fenster erneut geprüft werden.

Bei Bedarf enthält die Hilfe beide Wege (PC-VR und Browser im Headset), sowie kopierbare Diagnoseinformationen ohne URLs, Zugangsdaten oder Songs. Die Hilfe installiert keine Treiber und verändert keine Runtime-/Sicherheitseinstellungen.

Die Show-Kopplung ist inzwischen als lokale Vorschau-Übertragung implementiert: siehe `reports/vr-preview.md`. Der Link überträgt den sichtbaren Showzustand, nicht LocalStorage oder Audio. Vertrauenswürdiges HTTPS wird für immersives VR weiterhin benötigt.

## Controller-Pult: zusätzliche Validierung

- `test/dmx-vr-console.test.mjs`: Zeiger/Flächentreffer, Fehlklicks, Deadzone, Raumgrenzen, Drehung um den tatsächlich getrackten Kopf, Deck/Play/Seek und Exit bei Verbindungsverlust.
- WebGL-Browsertest rendert zusätzlich Pulttextur und Zeiger über mehrere Frames und beide Augen ohne GL-Fehler.
- Die Bedienung folgt den standardisierten XR-Eingaben: [WebXR Gamepads](https://www.w3.org/TR/webxr-gamepads-module-1/). Hardware-Komfort und reale Controller wurden hier nicht geprüft.

## Kompakteres Pult und flüssigere Wiedergabe

Das Controller-Pult ist jetzt 29 × 19 cm statt 58 × 38 cm groß (halbe Breite/Höhe); der controllerlose Ersatz bleibt größer. Der VR-Renderer verwendet wiederverwendbare typisierte Vertex-Puffer und vergrößert GPU-Speicher nur bei Bedarf. Koordinatentransformationen berechnen Sinus/Cosinus einmal pro Bild statt pro Vertex. Der WebGL-Browsertest prüft auch die Wiederverwendung des GPU-Puffers.

Die gekoppelte Vorschau puffert 120 ms und interpoliert Lichtziele, Helligkeit und Gästeanimation zwischen empfangenen Zuständen. Das glättet Paketabstände, fügt der Lichtvorschau aber diese Verzögerung hinzu. Kopf-/Controllertracking und Musikbefehle werden nicht gepuffert. Nach längeren Aussetzern wird neu angesetzt; es werden keine Lichtwege über den letzten empfangenen Zustand hinaus vorausberechnet. Die Tests prüfen unregelmäßige Paketabstände, Geräteidentität, aktuelle Transportdaten und Unterbrechungen. Eine tatsächliche Verbesserung der Headset-Bildrate muss auf dem Gerät geprüft werden.

## VR-Einstieg und Quelle der Lichtshow

VR verwendet die empfangene Show einschließlich des darin übergebenen Raumplans. Ein unabhängig auf der Brille gespeicherter AR-Plan überschreibt diesen Zustand nicht mehr; die AR-Sitzung verwendet weiterhin ihre Planungssteuerung. Beim ersten getrackten VR-Bild wird der tatsächliche Kopfstandort samt Blickrichtung auf den Vorschau-Startpunkt abgebildet. Liegt dieser außerhalb des Raums, wird ein Punkt innerhalb der Raumfläche gewählt (bei polygonalen Räumen ein Dreiecksschwerpunkt). Das verhindert einen Einstieg außerhalb geschlossener Raumwände durch einen versetzten WebXR-Tracking-Ursprung. Anschließende physische Bewegung bleibt erhalten; AR-Verankerung wird nicht verändert.

Validierung: DMX-/VR-Testgruppe mit 190 Tests bestanden, danach zusätzlicher Integrationstest für den ersten getrackten Frame bestanden. Beide Browserchecks für WebGL und gekoppelte Vorschau bestanden. Keine Prüfung mit realer Brille.

## Farbiges indirektes Raumlicht

`dmx-surface-light.js` ergänzt die gemeinsame Geometrie um eine begrenzte diffuse Reflexionsnäherung: Die stärksten 32 aktiven Lichtquellen erzeugen farbige, mit Entfernung abnehmende Beleuchtung um ihre Boden-Zielpunkte. Die Materialfarbe bestimmt die Reflexion; Geräteflächen, Wände und Böden werden aufgehellt. Ausgeschaltete Quellen tragen nichts bei, Umgebungslicht und tatsächliche Lichtausgabe bleiben unabhängig. Emissive Strahlen und Linsen bleiben unverändert.

Materialwände sind in wiederverwendbare Flächen bis etwa 2 m unterteilt, damit die Reflexionshelligkeit räumlich variiert. Bei einer Innenansicht wird für stilisierte Räume zusätzlich die beleuchtete Decke dargestellt; in der Außenübersicht bleibt der Raum offen. VR liefert dafür die tatsächliche Kopfposition in Weltkoordinaten.

Dies ist keine kalibrierte Lichtplanung: Es fehlen gemessene Leuchtendaten, Mehrfachreflexionen und Schatten-/Verdeckungsberechnung; farbiges Streulicht kann deshalb auch Flächen erreichen, die in einem realen komplexen Raum verdeckt wären. Die Begrenzung und gecachten Wandflächen halten die zusätzliche Arbeit überschaubar. 195 automatisierte Tests sowie WebGL- und Kopplungs-Browsercheck bestanden; reale Headset-Bildrate und Lichtwirkung nicht gemessen.

## Korrektur der sichtbaren Flächenunterteilungen

Die diffuse Aufhellung wurde zunächst am Schwerpunkt jedes einzelnen Polygons berechnet. Das erzeugte eine diagonale Helligkeitskante zwischen Bodendreiecken und rechteckige Stufen auf unterteilten Wänden. Die Näherung verwendet nun pro gemeinsamer Ebene einen Referenzpunkt (Projektion der Raummitte), sodass Triangulierung, Windungsrichtung und Kachelgröße keinen Einfluss auf deren diffuse Beleuchtung haben. Materialfarben und gerichtete Lichtflecken bleiben erhalten. Dies ist eine gleichmäßige diffuse Aufhellung je Ebene, kein räumlich aufgelöster GI-Verlauf. Die zusätzlichen Wandunterteilungen wurden entfernt und die diffuse Stärke reduziert. Canvas füllt außerdem schmale Antialiasing-Nähte zwischen deckenden Flächen.

196 Tests und der WebGL-Browsercheck bestanden. Reproduktionsbild `reports/dmx-surface-light-fix.png` mit Hallenmaterial und magenta/grünen Scheinwerfern visuell geprüft: keine diagonale Helligkeitskante oder rechteckigen Beleuchtungsblöcke.

## Material- und Gerätedetails

Der Hallenboden verwendet versetzte schmale Dielen mit deterministischer Farbvariation, feinen Fugen und sparsamen Maserungslinien. Betonmaterialien bekommen ebenfalls schmalere Fugen und subtile Farbunterschiede. Wandmaterialien erhalten zurückhaltende Fugen und einen Deckenabschluss. Die vorhandenen Leuchtenmodelle bekommen eine Linseneinfassung und kleine Befestigungsdetails; Gerätepositionen, Abmessungen, Show und Strahlensteuerung bleiben gleich.

Die Materialgeometrie ist zwischengespeichert; bei großen Raumflächen wird die Detaildichte reduziert. Maserung liegt geringfügig über der Dielenfläche, um Z-Fighting in VR zu vermeiden. Keine externen Texturen, Modelle oder neuen Abhängigkeiten. Die Testansicht `reports/dmx-surface-light-fix.png` zeigt den aktuellen Stand. 196 Tests, anschließende fokussierte Materialtests und WebGL-Browsercheck bestanden. Dies ergänzt Oberflächenstruktur, ersetzt aber keine physikalisch basierten Materialien oder Schattenberechnung.
