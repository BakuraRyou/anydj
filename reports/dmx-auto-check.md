# Automatische Lichtshow mit adaptiver Farbanzahl

Im rechten Bereich der Lichtbühne gibt es jetzt drei Modi: gemeinsamer
Lichtmix (bisherige Voreinstellung), automatische Lichtshow und manuelle
Gerätegestaltung. Die Automatik benötigt nur eine Farbobergrenze von 1–4.
Modus, Obergrenze und davon unabhängige manuelle Einstellungen bleiben lokal
 gespeichert. Alte gespeicherte `enabled`-Einstellungen werden übernommen.

Die bereits vorbereiteten Songabschnitte steuern die Gestaltung: ruhige
Passagen eine Farbe, fließende bis zu zwei, Aufbauten schrittweise mehr,
kräftige bis zum gewählten Maximum. Die Ausgangsfarbe stammt aus dem
Deck-Lichtbild. Ergänzende harmonische Farben sowie eine räumliche
Helligkeitsverteilung bilden die Mehrgeräteshow. Das ist eine explizite
Gestaltungsheuristik auf Basis der vorhandenen Analyse, keine zusätzliche KI
oder nachgewiesen optimale musikalische Choreografie. Ohne Abschnitte gilt der
fließende Ersatzmodus, ohne Beat-Raster entfallen rhythmische Bewegungen.

Die Ausgabe ist deterministisch aus Wiedergabeposition und vorbereiteter Show.
Crossfades mischen Farbplätze vor der Geräteverteilung; dadurch bleibt die
Obergrenze auch bei zwei Decks erhalten. Eine Farbgruppe kann auf mehreren
Geräten erscheinen. Helligkeitsabstufungen sind keine zusätzlichen Farbgruppen.

Prüfung:
- `npm test`: 227 Tests bestanden.
- `node scripts/check-dmx-auto.mjs`: Browserprüfung erfolgreich, einschließlich
  einfarbiger Ruhepassage bei maximal vier Farben, mehrfarbiger kräftiger
  Passage, Anzahlwechsel, Speicherung/Neuladen, bisherigem/manuellem Modus,
  mobilen Fenstergrenzen und Tastaturbedienung.
- `node scripts/build-web.mjs`: erfolgreich.
- `git diff --check`: ohne Befund.

Screenshots: `dmx-auto-desktop.png`, `dmx-auto-mobile.png`.
Die neue Browserprüfung verwendet kontrollierte Showdaten; echte DMX-Hardware
wird weiterhin nicht angesprochen.
