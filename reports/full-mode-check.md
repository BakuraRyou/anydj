# Full-Modus: vier Farbflächen

22. September 2026. Bisher wurde eine einzige gemischte Farbe auf zwei Ebenen
gezeichnet. Außerdem wurde der modale Dialog vor dem Vollbild-Host in die oberste
Darstellungsebene aufgenommen; dadurch konnte der Host den Dialog verdecken.

Full zeigt jetzt vier weich bewegte Farbflächen. Die vorhandene automatische
Palettenfunktion leitet vier Farben aus jedem hörbaren Deck ab. Beim Crossfade
werden die Farben pro Platz anhand von Crossfader und Kanalpegel gemischt.
Die Helligkeit folgt dem gemeinsamen Lichtmix; bei Pause/Stop wird es dunkel.
Die Bildschirmanzeige benötigt keine konfigurierte oder verbundene Lampe.

Der Dialog öffnet nach dem Vollbildversuch und füllt bei abgelehntem Vollbild
stattdessen das Browserfenster. Escape und Schließen stellen den Fokus nach dem
Vollbildende wieder her. Scrollleisten und der Tutorial-Launcher bleiben während
Full verborgen. Die letzte Lichtprobe steht sofort beim Öffnen zur Verfügung.

Validierung:

- `node scripts/check-dj-full.mjs`: echtes Browser-Vollbild, vier unterschiedliche
  Farben, sichtbarer Dialog, Farbwechsel/Crossfade, inaktive Bedienung, Escape,
  Fokus, Pause, Fallback bei abgelehntem Vollbild, 390/1280 Pixel und Cleanup.
  Zusätzlich tatsächliche Audiowiedergabe mit synthetischer WAV-Datei im DJ-Pult:
  Original-Full-Button öffnet eine beleuchtete Ansicht; Pause dunkelt sie ab.
- 41 Tests aus app.test.mjs, dj.test.mjs und dmx-auto.test.mjs erfolgreich.
- Screenshot: `/tmp/anydj-full-four-colors.png`.

Nur Quellcode geändert; Website und Desktop-Installer wurden für diesen Fix
noch nicht neu gebaut oder veröffentlicht.
