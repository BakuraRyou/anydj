# Vereinfachte DJ-Oberfläche

Die vorhandene Anordnung Deck A – Mixer – Deck B bleibt erhalten. Alle bestehenden
Funktionen bleiben erreichbar; die Standardansicht zeigt wesentlich weniger
Bedienelemente gleichzeitig.

Änderungen:
- Pro Deck nur Play und Cue als direkt sichtbare Transportbuttons.
- Tempo, Hotcues, Loops, EQ und Vorhören gemeinsam unter „Mix-Werkzeuge“.
- Farbmodus, Abschnittslicht und Lichtverlauf unter „Lichtgestaltung“.
- Zentraler Mixer in Lichtshow, Überblenden und Master gegliedert.
- Geräteeinrichtung/Aufnahme und Automatikoptionen gezielt aufklappbar.
- Aufnahme-, Loop-, Vorhör- und Tempozustände bleiben bei geschlossenen
  Gruppen sichtbar.
- Bibliothek mit Einreihen und beschriftetem Mehr-Menü statt Symbolleiste.
- Import-/Ordnerverwaltung und Listenverwaltung gruppiert.
- Ruhigere Flächen, weniger Umrandungen und klare Gewichtung der Hauptaktionen.

Verifikation:
- Layout-Browsertest bei 1440/1024/390 Pixeln: bündige Panels, kein horizontaler
  Überlauf, geschlossene Werkzeuggruppen, nur zwei sichtbare Transportbuttons,
  Werkzeuge öffnen, Escape/Fokus und Bühne einrichten.
- Performance-Browsertest: tatsächliche Audiowiedergabe, EQ, Tempo, Hotcues,
  Loops, Aufnahme und simuliertes getrenntes Vorhören erfolgreich.
- Listen-Browsertest: Vorbereitung während Wiedergabe, Speicherung, Reihenfolge,
  Wiederherstellung und Mehr-Menü auf Mobilgeräten erfolgreich.
- Web-Build und Syntaxprüfung erfolgreich.

[Desktopansicht](ux-layout-1440.png) · [Mobile Ansicht](ux-layout-390.png).
Es wurde keine Audio-, Show- oder Speicherlogik neu entworfen.
