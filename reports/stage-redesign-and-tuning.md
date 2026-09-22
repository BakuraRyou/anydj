# Lichtbühne und globale Feinjustierung

22. September 2026. Das Einstellungsfenster wurde in vier Aufgaben gegliedert:
Live-Look, Feinschliff, Geräte und Verbindung. Direkt wählbare Lichtstile mit
kurzen Beschreibungen ersetzen das sichtbare Modus-Dropdown. Bestehende
Bedienelemente und Handler wurden übernommen; Geräte-, Gruppen- und
Abschnittsregeln bleiben erhalten. Kopfzeile und Navigation bleiben sichtbar,
nur der Inhalt scrollt. Das Fenster bleibt nichtmodal, das DJ-Pult bedienbar.

Feinschliff bietet Helligkeit 0–100 %, Farbsättigung 0–150 %, gemeinsame
Farbtonverschiebung ±180° und Helligkeitskontrast („Lichtimpulse“) 0–150 %.
Die Standardwerte verändern die vorbereitete Show nicht. Kontrast 0 gleicht
aktive Helligkeiten auf 50 % vor der globalen Dimmung an; echte Nullwerte und
abgeschaltete Frames bleiben dunkel. Ein Reset setzt alle vier Regler zurück.
Die Einstellungen liegen geräteweit in localStorage; die Audioanalyse wird
nicht erneut berechnet. Ein zusätzlicher Einstieg im Mixer öffnet direkt
Feinschliff, auch wenn die virtuelle Bühne nicht aktiviert ist.

Die Transformation erfolgt nach der Palettenerzeugung und Mischung für WiZ,
DMX und Full. DMX-Hardware und Bühnenvorschau verwenden denselben korrigierten
Ausgabeframe. WiZ erhält bei Helligkeit 0 `state:false`, da sein Dimmer keine 0
akzeptiert. Full passt die vier Farben nach ihrer Erzeugung an. Farben der
Bühnenpalette zeigen ebenfalls Sättigung und Farbton der Feinjustierung.

Geprüft:

- `npm test`: 334 Tests erfolgreich, inklusive neuer neutraler Einstellungen,
  Nullhelligkeit, Sättigung, Hue, Kontrast und Grenzwerte.
- `node scripts/check-light-tuning.mjs`: Live-Stile, vier Bereiche, Graustufen,
  Abdunkeln, individuelle Gestaltung, Geräte, Speicherung, Reset; 1280/390 Pixel.
- `node scripts/check-dmx-mixed.mjs`: gemischte Ausstattung, Löschen, Kapazität,
  Migration und Mobile erfolgreich.
- `node scripts/check-dmx-design.mjs`: individuelle Farben, Abschnitte,
  Speicherung, Demo, Blackout, Liveframe, Escape und Fokus erfolgreich. Der Test
  legt die benötigte Lichtleiste jetzt ausdrücklich an und wartet beim Reload
  auf das neue Dokument.
- `node scripts/check-dj-full.mjs`: Full mit echter Audiowiedergabe, globaler
  Entsättigung und Helligkeit 0 sowie Rücksetzen und Pause.
- Visuelle Kontrolle: `/tmp/anydj-stage-redesign-1280-1.png` und mobile Ansichten.

Keine Ausgabe an echte Hardware aktiviert; Ausgabe wurde anhand von
Transformationslogik und Browser-DMX-Vorschau geprüft. Kein Deploy oder neuer
Installerbuild ausgeführt.
