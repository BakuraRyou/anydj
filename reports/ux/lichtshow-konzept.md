# UX-Vorschlag: Musik auswählen, Lichtshow starten

Grundlage: bereitgestellter Screenshot sowie `public/dj.html`,
`public/dmx-stage.js` und `public/dmx-editor.js`. Dies ist eine fachliche
Entwurfsbewertung, kein Ergebnis eines Nutzertests. Die Anwendung wurde nicht
umgebaut. [Interaktiver Entwurf](lichtshow-entwurf.html) mit Beispieldaten.

## Beobachtungen

- Leere Decks nehmen im Screenshot den größten oberen Bereich ein. Der erste
  sinnvolle Schritt, Musik auswählen oder Warteschlange starten, liegt darunter.
- Farbmodus im Deck, Lichtshow im Mixer und Lichtmodus im Bühnendialog verwenden
  ähnliche Begriffe für unterschiedliche Ebenen. Ihre Wechselwirkung ist kaum
  erkennbar.
- Das Bühnenfenster mischt Demo, Ausstattung, Showgestaltung, Verbindung,
  Hilfetexte und technische Kanalwerte. Einstellungen für die einmalige
  Einrichtung konkurrieren mit laufender Bedienung.
- „Nur Audio“ in der WiZ-Auswahl beschreibt nicht zuverlässig die separat
  aktivierbare DMX-Ausgabe. Ebenso kann „Vorschau · ohne echte Lampen“ im
  Bühnenfenster bei aktiver DMX-Ausgabe missverstanden werden.
- In jeder Bibliothekszeile stehen zahlreiche kleine Symbolaktionen. Ihre
  Bedeutung muss erlernt werden. „Ordner wechseln“ fällt stärker auf als die
  für die Wiedergabe relevante Titelwahl.
- Die Vorschau hat im Screenshot bereits bei vier Geräten eine horizontale
  Scrollleiste. Der tatsächliche Lichtzustand ist dadurch schlechter erfassbar.

## Empfohlener Aufbau

Standardansicht auf automatische Wiedergabe ausrichten: oben aktueller Titel,
Start/Pause und nächster Titel; darunter Warteschlange und Musikbibliothek.
Rechts bleibt die Lichtvorschau mit den während der Wiedergabe relevanten
Einstellungen. „Manuell mixen“ öffnet die vorhandenen Decks einschließlich
Crossfader und Cue. Zuletzt gewählte Ansicht speichern, damit manuelle Nutzer
direkt weiterarbeiten können. Decks und bisheriger gemeinsamer Farbmodus bleiben.

Neben der Vorschau höchstens drei Entscheidungen:

| Bedienung | Auswahl | Verhalten |
| --- | --- | --- |
| Verteilung | Automatisch zur Musik / Alle gleich / Selbst gestalten | Entspricht den bisherigen drei Bühnenmodi |
| Stil | Automatisch / Party / Disco | Vorhandene Showprofile; bei Detailgestaltung passend ausblenden |
| Farben gleichzeitig | 1 / bis zu 2 / bis zu 3 / bis zu 4 | Nur im automatischen Bühnenmodus anzeigen |

Farbenzahl ausdrücklich als Obergrenze erklären. Gleiche Farben auf allen
Lampen bleiben ein musikalisch sinnvolles Ergebnis. Deckbezogene Farbpaletten
werden als individuelle Anpassungen erreichbar, ohne eine vierte globale
Moduswahl zu erzeugen. Bestehende Einstellungen beim Umbau übernehmen.

## Stark vereinfachte Einstellungen

Ein gemeinsamer seitlicher Einstellungsbereich mit zwei Bereichen:

**Lichtshow:** Erklärung der Automatik, Übergangseinstellungen und bewusst
geöffnete Detailgestaltung. Auto-Crossfade und Beat-Synchronisation bleiben
standardmäßig aktiv und separat abschaltbar. Farbe und Bewegung zuerst zeigen;
Gruppen, Abschnittsregeln und Zeitversatz erst unter „Weitere Optionen“.

**Geräte:** Ausstattung und Verbindung. Scheinwerfer einfach über Anzahl
verwalten; Lichtleisten einzeln mit Segmentanzahl hinzufügen. Individuelle
Gerätezuordnungen beim Reduzieren der Anzahl beachten. Nur die konfigurierte
Ausstattung darstellen. USB/LAN-Hilfe kontextbezogen einblenden. Benötigte
Kanalbelegung vor der ersten echten Ausgabe zugänglich machen; Rohwerte und
Diagnose zuklappen. WiZ und DMX gemeinsam sichtbar machen, ohne bereits
unterstützten parallelen Betrieb durch eine exklusive Auswahl einzuschränken.

Status direkt bei der Vorschau: „Nur Vorschau“, „USB-Interface erkannt“,
„DMX-Ausgabe aktiv“ oder „Verbindung unterbrochen“. Gerätezahl bezeichnet die
konfigurierte Ausstattung, nicht automatisch erkannte DMX-Scheinwerfer.
LAN-Ausgang und Empfangsbestätigung weiterhin unterscheiden. Aktive WiZ- und
DMX-Ausgaben jeweils separat benennen. Die gemeinsame Stop-Aktion muss mit der
tatsächlichen Wirkung abgestimmt werden: WiZ stellt derzeit den vorherigen
Zustand wieder her, DMX versucht ein Schwarzbild zu senden.

## Bibliothek und Darstellung

- Pro Titel eine beschriftete Hauptaktion „Einreihen“, weitere Aktionen im
  Menü „Weitere Aktionen“. Deck A/B nur in der manuellen Ansicht hervorheben.
- „Musik hinzufügen“ bündelt Dateien und Ordner. Ordnerverwaltung nachrangig.
- Status „Lichtshow bereit“ statt „Vollständig berechnet“. Analysefehler mit
  einer konkreten nächsten Aktion anzeigen.
- Bühne an die verfügbare Breite anpassen; viele Geräte auf mehrere Reihen
  verteilen. Keine dauerhaft sichtbare Scrollleiste bei vier Scheinwerfern.
- Gut lesbare Sekundärtexte, sichtbarer Tastaturfokus, beschriftete Aktionen
  und ausreichende Klickflächen. Verbindungszustände zusätzlich als Text.
- Mobil: Wiedergabe zuerst, danach Bühne und Titelliste; Einstellungen als
  vollflächiger Dialog. Tastaturfokus beim Schließen an den Auslöser zurückgeben.

## Demo und nächster Umsetzungsschritt

„Demo sollte unter Produktion“ ist noch nicht eindeutig. Die Platzierung
bleibt offen, bis geklärt ist, ob ein Bereich „Produktion“, Verfügbarkeit im
normalen Betrieb oder eine geringere Sichtbarkeit gemeint ist. Keine neue
Navigationsstruktur allein aufgrund dieser unklaren Formulierung einführen.
App-Demomodus und virtuelle Bühnen-Demo begrifflich trennen. Eine visuelle Demo
darf nicht versehentlich physische Ausgabe einschalten.

Zuerst die Einstellungsstruktur, Begriffe und Statusanzeigen vereinfachen;
danach die automatisch ausgerichtete Hauptansicht ergänzen. Der HTML-Entwurf
zeigt diese Richtung, implementiert aber weder Audio noch Geräteverwaltung.
Vor Freigabe mit typischen Aufgaben prüfen: ersten Titel starten, Farbenzahl
ändern, gemeinsamen Modus wählen, Gerät hinzufügen und Verbindungsausfall
verstehen. Erfolgskriterium: Aufgaben ohne Erklärung oder technische Begriffe
bewältigen; bestehende manuelle Funktionen bleiben auffindbar.
