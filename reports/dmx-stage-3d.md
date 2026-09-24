# Optionale 3D-Bühne

## Arbeitsfenster für die Showvorbereitung

Die große Ansicht ist jetzt ein festes Arbeitsfenster: oben die Werkzeuge,
in der Mitte die automatisch eingepasste 3D-Vorschau und unten die dauerhaft
sichtbare Musikleiste. Nur die Werkzeugspalte scrollt. Auf kleinen Displays
liegt sie über der Vorschau; die Musikleiste bleibt weiterhin sichtbar.

- **Raum:** Club/Bühne wählen, Raummaße und Lichtbereich einstellen.
- **Geräte:** vorhandenen Geräteplan direkt bearbeiten, einschließlich
  Ziehen, Tastaturnavigation, Montagehöhe und symmetrischem Aufbau.
- **Licht:** Song-Lichtmanager direkt neben der 3D-Vorschau, mit Abschnittstimeline,
  Farben, Bewegung, Teilen/Zusammenführen, Undo/Redo und Speichern. Unter
  „Live-Look & Geräte“ bleiben Feinschliff, Ausstattung und Verbindung erreichbar.
- **Standort:** Augenhöhe und Position auf der Tanzfläche; die Ansicht wird
  über „Auf die Tanzfläche“ aktiviert.
- **Song laden:** Bibliothek des DJ-Pults nutzen oder Audiodateien hinzufügen.
  Ein laufendes Deck muss zum Songwechsel pausiert werden.
- **Song-Licht:** nutzt die Audioinstanz des ausgewählten Decks. Positionsbalken
  und Editor steuern dieselbe Wiedergabe; Änderungen erscheinen direkt in 3D.
  Speichern lässt den Manager geöffnet. Ungespeicherte Entwürfe bleiben bei
  Werkzeug-/Deckwechsel und Schließen der 3D-Ansicht für die Sitzung erhalten
  (nicht nach einem Neuladen der Seite). Die untere Vorschau besteht nur aus
  einem Positionsbalken ohne zusätzliche Wellenform oder Zeitinformationen.

`dmx-stage-workspace.js` enthält ausschließlich die neue UI-Anordnung.
`dmx-layout.js` und `dmx-stage.js` stellen kleine Mount-/Restore-Schnittstellen
für die bestehenden Editoren bereit. Die Renderer- und Ausgabesteuerung
bleiben getrennt. Zum Entfernen des optionalen 3D-Arbeitsplatzes auch das
Workspace-Modul, seine Route und seine Mount-Callbacks entfernen.

Geprüft: kompletter Browserablauf mit echter Audiodatei (Song wechseln,
Geräte positionieren, Live-Look ändern, Song-Licht öffnen/schließen), Musik-
Shortcuts, Kamera, Raum, Vollbild, mobile Fenstergrenzen und dauerhaft
sichtbare Musikleiste; zusätzlich ursprünglicher Geräteplan und neun
Geometrie-/Layouttests. Screenshots: `dmx-stage-transport.png` und
`dmx-stage-workspace-mobile.png`.


Bedienung: Lichtbühne aktivieren → neben Moving Heads „3D-Bühne einschalten“.
Die Moving-Head-Darstellung und die 3D-Ansicht lassen sich unabhängig schalten.
Die 3D-Ansicht verwendet denselben Bühnenaufbau, dieselben Lichtfarben und
berechneten Bewegungsziele. „Große Ansicht“ öffnet eine separate Ansicht;
Escape schließt sie. Kamera per Ziehen/Pfeiltasten, Zoom per +/−; feste
Publikumsansicht, Draufsicht und Zurücksetzen sind verfügbar.

## Grenzen

Geometrische Perspektivprojektion auf Canvas, generische Geräte, vereinfachte
transparente Lichtkegel und Bodenflecken. Keine photometrische Simulation,
Schatten, Gobos oder gerätespezifische Optik. Statische Scheinwerfer richten sich
wie im bisherigen Bühnenplan zur Vorderkante. Moving Heads bleiben virtuelle
Vorschaugeräte. Die Ansicht erzeugt selbst keine Hardware-Ausgabe.

Der Renderer wird erst beim Einschalten importiert. Zeichnen wird bei
abgeschalteter/unsichtbarer Ansicht und verstecktem Browser-Tab ausgesetzt.
Live-Bilder folgen dem vorhandenen Bühnen-Takt; kein eigener Dauertimer.
Die Pixeldichte ist auf 1,5 begrenzt. Leistung auf echter Mobilhardware wurde
noch nicht gemessen.

## Isolierung und Entfernen

Eigene Dateien:
- `public/dmx-stage-3d.js`: UI, Kamera, Lebenszyklus und Datenadapter.
- `public/dmx-stage-3d-renderer.js`: unabhängiger Renderer ohne DOM/DMX.
- `public/dmx-stage-3d.css`: ausschließlich eigene Klassen.

Zum Entfernen den Import, die Initialisierung und die Update-/Destroy-Aufrufe
für `stage3d` in `public/dmx-stage.js` entfernen; `onPreview` wieder direkt an
`layout.update` anbinden und `movingPreview` sowie `previewControls` entfernen.
Die Option `getPreviewEnabled` dort entfernen. In `dmx-moving-heads.js` ist
sie optional und standardmäßig inaktiv; sie und `refresh` können anschließend
auch entfernt werden. Drei explizite Asset-Routen in `server.mjs` sowie die
obigen Dateien und `scripts/check-dmx-stage-3d.mjs` entfernen. Keine neuen
Paketabhängigkeiten, keine Änderungen am gespeicherten Bühnenformat.

## Prüfung

- `node scripts/check-dmx-stage-3d.mjs`: verzögertes Laden, unabhängige Schalter,
  Live-Licht, Blackout, Kamera/Reset/Tastatur, Bühnenbreite, große Ansicht/Escape,
  mobile Grenzen bei 390 px, Abschalten, Cleanup und keine Hardware-Session.
- `node scripts/check-dmx-moving-heads.mjs`: bestehende Vorschau inklusive
  Vorbereitung, Blackout, Persistenz und reduzierter Bewegung erfolgreich.
- 13 bestehende Tests für Layout, Moving Heads und Bewegungspläne erfolgreich.

Screenshots: `dmx-stage-3d-desktop.png`, `dmx-stage-3d-mobile.png`.

## Auf der Tanzfläche

„Auf die Tanzfläche“ wechselt zur Ich-Perspektive (standardmäßig 1,70 m).
Der kleine Plan zeigt die Bühne oben und den Standort darunter. Per Klick
oder Standortreglern einen Platz wählen. Die Tanzfläche hat die Bühnenbreite
und mindestens vier Meter Tiefe (sonst dieselbe Tiefe wie die Bühne).
Maus/Finger ziehen dreht den Blick. Bei fokussierter Ansicht bewegen Alt + WASD
und Alt + Pfeiltasten relativ zur Blickrichtung; Bildschirmtasten funktionieren
auch per Touch. Der Standort bleibt innerhalb der Tanzfläche. Augenhöhen
von 1,20 bis 1,90 m sind wählbar. „Kamera zurücksetzen“ richtet den Blick
wieder zur Bühne; „Zur Bühnenübersicht“ stellt die vorige Übersicht wieder her.

Optional richtet „Moving Heads auf die Tanzfläche richten“ die Lichtziele
nur in dieser 3D-Vorschau in den Publikumsbereich. Diese alternative
Zielverteilung verändert weder die Originalchoreografie noch DMX-Ausgaben.
Ohne diese Option sieht man die ursprünglichen Lichtziele vom gewählten
Standort. Transparente Kegel vermitteln räumliches Licht, simulieren jedoch
keine physikalisch genaue Nebelstreuung oder Blendwirkung.

Die Projektion schneidet Geometrie an der vorderen Kameraebene ab, damit
Boden und Lichtkegel beim Durchqueren der Blickebene nicht komplett verschwinden.
Drei zusätzliche Tests in `test/dmx-stage-3d.test.mjs` prüfen Augenhöhe,
Blickrichtung und diesen Zuschnitt. Der Browser-Test prüft außerdem
Tanzflächenmodus, Gehen, Randbegrenzung, Standortwahl, Augenhöhe, Zieloption,
Rückkehr und mobile Bedienelemente. Screenshot: `dmx-stage-3d-dancer.png`.
Alle Änderungen für den Tanzflächenmodus liegen in den separaten 3D-Dateien.

## Full

„Full“ in der 3D-Kopfzeile zeigt die laufende Show im gesamten Browserfenster.
Kamera, Tanzflächenstandort und Lichtvorschau bleiben erhalten. Die Einstellfelder
werden ausgeblendet; Umsehen und Tastaturbewegung funktionieren weiterhin.
„Full schließen“ oder Escape kehrt zur vorherigen Ansicht zurück (große Ansicht
oder Mixer). Der Modus verändert die Browser-Symbolleisten nicht.
Der Browser-Test prüft exakte Canvas-Fenstermaße auf Desktop und Mobilgeräten,
Live-Updates, erhaltenen Tanzflächenmodus, Escape und Fokus nach der Rückkehr.
Screenshot: `dmx-stage-3d-full.png`.

## Songsteuerung in der großen Ansicht

Unter der Vorschau: Deck A/B wählen, Positionsregler
verschieben, Play/Pause und Tempo (−16 bis +16 Prozent, wie im Deck) bedienen.
Änderungen gehen über die bestehenden Deck-Aktionen an die tatsächliche
Wiedergabe; Musik und Licht behalten dieselbe Songzeit. Manuelle Tempoänderungen
beenden wie im Deck eine aktive Übergangsautomatik. Leere/nicht bereite Decks
sind deaktiviert. Spotify bietet keine Tempoänderung und Positionssprünge nur
bei aktiver Verbindung. Im Full-Modus bleiben die Songregler ausgeblendet.

`dmx-stage-transport.js` enthält die optionale UI. `dj.js` übergibt über
`lightStage.setTransport` die Deck-Daten und Aktionen; die 3D-Module kennen keine
Audio- oder Queue-Interna. Zum Entfernen der 3D-Erweiterung zusätzlich diese
Anbindung, das Transport-Modul und dessen Asset-Route entfernen.
`dj-waveform.js` zeichnet die Wellenformen der Decks und
muss für die normalen Decks erhalten bleiben.

Die Deck-Wellenform und ihr Positionsregler werden im selben Takt aktualisiert.
Die Reglergeometrie berücksichtigt die Knopfbreite. Die Berechnungsinformation
sitzt in einem festen, bei Bedarf scrollbareren Bereich am Deck-Ende.
`node scripts/check-dmx-stage-transport.mjs` prüft mit echter Testaudiodatei
Tempo, Sprünge, integrierten Lichtmanager, gemeinsame Wiedergabe, Speichern,
Entwurfserhalt, Play/Pause, leeres Deck, pixelgenaue Ausrichtung
bei 10/50/90 Prozent und stabilen Statusbereich auf Desktop und Mobilgerät.

## Gemeinsamer Club-Raum

Unter „Raum & Lichtfläche“ den gemeinsamen Club-Raum aktivieren. Breite und
Länge sind von 2 bis 60 m, die Höhe von 2 bis 15 m einstellbar. Es gibt eine
durchgehende begehbare Fläche statt getrennter Bühne und Tanzfläche. Die
Lichtzielgrenze lässt sich per Regler oder Ziehen im Raumplan verschieben.
„Licht reicht“ misst von der hinteren Raumwand nach vorne; die gesamte
Raumlänge erlaubt Ziele im ganzen Raum. Die helle Linie in der 3D-Ansicht
zeigt die Grenze. Moving Heads, Scheinwerfer und Lichtleisten teilen diesen
Zielbereich; Bodenflecken werden auf ihn begrenzt. Lichtkegel bleiben eine
vereinfachte Darstellung, keine physikalisch exakte Abschattung.

Der Geräteaufbau wird proportional auf Breite und Länge abgebildet;
Montagehöhen werden bei Bedarf unterhalb der Raumdecke begrenzt. Die
Quelldaten und echte Lichtausgaben ändern sich dabei nicht. Die ältere
Option für Moving Heads auf der separaten Tanzfläche entfällt im Club-Modus.
Die Einstellungen werden unabhängig unter `anydj-3d-room-v1` gespeichert;
Deaktivieren stellt die bisherige Bühnenansicht wieder her.

`public/dmx-room.js` kapselt Einstellungen, Validierung und geometrische
Abbildung. Zum Entfernen der 3D-Funktion auch dieses Modul und seine Route
entfernen. Tests: `test/dmx-room.test.mjs` (Grenzen, Skalierung, unveränderte
Quelldaten), `scripts/check-dmx-stage-3d.mjs` (Maße, gespeicherte Werte,
Standortregler, Ziehen der Grenze), bestehender Songsteuerungs-Browsertest.
Screenshot: `dmx-club-room.png`.

## Musik-Shortcuts in der Bühnenansicht

Die große Ansicht und Full verwenden dieselbe Musiksteuerung wie die Decks:
Leertaste/K für Play/Pause, Links/Rechts für 5 Sekunden (Shift: 1 Sekunde),
Oben/Unten für Master ±5 %, Q/W und 1–4 für Deck A, O/P und 7–0 für Deck B.
Die allgemeinen Tasten beziehen sich auf das in der Songsteuerung gewählte
Deck. Eingabefelder behalten ihre normale Bedienung. Leertaste löst auch bei
fokussiertem Full-Button die Musiksteuerung aus; Enter aktiviert den Button.
In der großen Ansicht erfordern Tastaturbewegung und Kameradrehung Alt,
um die Musikbelegung freizuhalten. Escape schließt weiterhin die Ansicht.
Der Browser-Test prüft insbesondere Leertaste auf Full, K/Q, Sprünge,
Masterlautstärke, Cue, Eingabefelder und Musiksteuerung im Full-Modus.

## Easter Egg: Tanzende Gäste

Den Titel „Lichtshow“ dreimal zügig anklicken oder antippen (auch per Tastatur
mit Enter möglich). Das aktiviert acht Strichmännchen und enthüllt
„Tanzende Gäste“ zum Ein-/Ausschalten sowie „Gäste platzieren“.
Letzteres öffnet den Standortplan in der Ich-Perspektive: Freie Stelle antippen
fügt einen Gast hinzu, Gast antippen entfernt ihn. Maximal zwölf Gäste;
„Alle Gäste entfernen“ leert die Fläche. „Platzieren beenden“ stellt die
normale Standortwahl wieder her. Positionen passen sich an Raummaße und
Bühnen-/Club-Modus an und gelten nur für die aktuelle Sitzung.

Die Figuren verwenden die vorhandene Projektion und Tiefensortierung mit
Lichtkegeln, ohne Schatten oder Kollisionen. Animation im bestehenden 50-ms-Takt,
keine zusätzlichen Timer oder Abhängigkeiten. Bewegungen sind zeitbasiert,
nicht mit dem Songbeat synchronisiert. Bei reduzierter Bewegung bleiben die
Figuren still; ausgeblendete Ansichten zeichnen weiterhin nicht.
Geometrietest und Browserprüfung decken Aktivierung, Animation, reduzierte
Bewegung, Platzieren/Entfernen, Mengenlimit und Abschalten ab.
Screenshot: `dmx-stage-3d-crowd.png`.

Der eigenständige Abschnittseditor bleibt außerhalb der 3D-Ansicht verfügbar.
`node scripts/check-section-lighting.mjs` prüft dessen Bearbeitung, Speicherung,
Wiederöffnung, mobile Bedienung und Rückgabe der Bühnenvorschau.
Screenshot des integrierten Managers: `dmx-stage-light-manager.png`.

Im Licht-Tab liegen Farb-/Helligkeitsverlauf und bearbeitbare Abschnitte jetzt
in einer gemeinsamen Zeitleiste. Der vorhandene Verlauf-Canvas wird in die
Timeline eingebettet und teilt Zoom, Scrollposition und Abspielstrich. Die
separate Verlaufskarte entfällt nur im 3D-Arbeitsfenster. Der Browsercheck
prüft zusätzlich die deckungsgleichen Zeitachsen bei dreifachem Zoom.
