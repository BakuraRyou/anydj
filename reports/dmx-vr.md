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
