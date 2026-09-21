# Gemischte dynamische Lichtbühne

Scheinwerfer und mehrere Lichtleisten lassen sich gemeinsam hinzufügen und
entfernen. Leisten haben eigene Segmentzahlen. Der Patch wird lückenlos aus
der Geräteliste berechnet; gemeinsamer Modus, manuelle Gestaltung und Automatik
verwenden denselben dynamischen Patch. Grenzen von vier Spots/acht Segmenten
entfallen. Aktueller Ausgabepuffer: ein 512-Kanal-Universum; Überschreitungen
werden vor Übernahme einer Änderung angezeigt. Keine Hardware-Ausgabe.

Geräte besitzen gespeicherte IDs. Entfernen aktualisiert die Zuordnung von
Gruppen, Geräte- und Abschnittseinstellungen gemeinsam mit der Geräteliste.
Bisherige Leisten-Einstellungen vom früheren Index 4 werden korrekt migriert.
Ein leerer Patch bleibt leer und dunkel, auch nach Neuladen.

Verifiziert:
- `npm test`: 239 Tests bestanden.
- `node scripts/check-dmx-mixed.mjs`: sechs Spots und zwei Leisten, unterschiedliche
  Segmentzahlen, stabile Einstellungen nach Entfernung, Speicherung/Neuladen,
  Kapazitätsfehler ohne Teiländerung, leere Bühne, Altformat-Migration und mobile
  Darstellung erfolgreich; keine Browserfehler.
- Modelltests: Kanalbereiche, Nullwerte außerhalb des Patches, dynamische Auto-
  und manuelle Frames, leere Konfiguration, Eingabevalidierung und unabhängige
  Lauflichter pro Leiste.
- Screenshots: `dmx-mixed-desktop.png`, `dmx-mixed-mobile.png`.
