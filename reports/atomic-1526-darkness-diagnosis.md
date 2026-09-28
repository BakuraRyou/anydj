# Dunkelphase im Video 15.26

Stand: 27.09.2026. Die bisherigen Änderungen beheben die vom Nutzer weiterhin beobachtete Dunkelphase nicht nachweislich.

## Zuordnung

Die Tonspur von `__mock/anydj_preview_epic-2026-09-27_15.26.mp4` wurde mit der lokalen MP3 `Timecode - lightshow - Atomic Damage -MA3D.mp3` korreliert (Mono, 2 kHz). Offset: 72,0765 Sekunden, normierte Korrelation 0,994885. Video 19 s entspricht etwa Song 91,08 s. Das belegt die Audiozuordnung, nicht die genaue Latenz des Renderings.

Die RMS-Pegel der heruntergerechneten Videotonspur liegen in 250-ms-Fenstern bei Video 18,5 / 19 / 19,5 s bei −26,08 / −25,88 / −25,18 dBFS. Kein entsprechender Einbruch der Tonenergie.

## Neuberechnung

Vollständige lokale Beat-, Stil- und Instrumentenanalyse, Songdauer 111,943 s. Keine gemessenen kurzen Blackouts. Instrumentenpausen bei 20–21, 58,3–59,3 und ab 110,1 s; keine bei 91 s.

Offline-Trace mit dem aktuellen Showprofil und dem Club-Bühnenraum, 48 Moving Heads, 30 Hz, 89–94 s:

- Grundanalyse: bei Song 91 s 18 aktive Heads, maximale Leistung 0,435.
- Verfeinerte Analyse: bei Song 91 s 12 aktive Heads, maximale Leistung 0,302.
- Beide Varianten erzeugen dort keinen vollständigen Blackout.

Temporäre Daten: `/tmp/atomic-base.json`, `/tmp/atomic-refined.json`, `/tmp/atomic-base-visibility.json`, `/tmp/atomic-visibility.json`.

## Grenze und nächster Schritt

Die Neuberechnung entspricht nicht nachweislich dem gespeicherten Plan und Raum des Videos. Der Trace enthält keine tatsächliche GPU-Ausgabe und keine Browser-Laufzeitmessung. Deshalb keine weitere vermutete Korrektur und kein Anspruch, die konkrete Dunkelphase behoben zu haben.

Für die Reproduktion benötigt: `Analyse exportieren` aus `Lichtshow bearbeiten → Lichtshow mit einem Video auswerten`, idealerweise bei Songsekunde 91, sowie `anydj-raum.json` aus dem aktuellen Raumplaner. Damit lassen sich der gespeicherte Szenenwechsel, manuelle Abschnittsvorgaben und räumliche Abschattung getrennt prüfen.

## Abgleich mit dem Export des Nutzers

`__mock/anydj-light-review (1).json` enthält den Showplan Version 52. Die Exportposition 4,02 s ist unkritisch, da der vollständige Plan enthalten ist.

Anders als die frische Instrumentenanalyse enthält der Export bei 84,04–92,04 s ein `flow`-Bild (`wings`) mit `supportGain: 0`, halber Reihenbelegung und halber Paarbelegung. Bei 90,04 s liegt eine `answer`-Aktion mit 1 s Dauer. Im Replay sinkt die sichtbare Belegung zeitweise auf sechs Moving Heads (90,77 s); es gibt keinen expliziten vollständigen Blackout. Die Quellenhelligkeit beträgt dort 23 %. Dies belegt eine starke gemeinsame Lichtreduktion; GPU-Bild und subjektive Wahrnehmung sind damit noch nicht reproduziert.

Korrektur: Fließende Showbilder behalten 45 % ihres musikalisch gesteuerten Unterstützungslichts. Das gilt auch für zuvor exportierte Flow-Bilder mit `supportGain: 0`. Gemessene Dunkelphasen und gezielte rhythmische Beam-only-Bilder bleiben dunkel. Keine Erhöhung der Moving-Head-Quellenhelligkeit.

Am tatsächlichen Export geprüft: statischer Testscheinwerfer bei 90,77 s nun 8,80 % statt 0; bei 91,08 s 12,62 % statt 0. Die Moving-Head-Quelle bleibt bei 23 bzw. 33 %. 904 Unit-Tests bestanden. Visuelle Bestätigung der konkreten Videopassage steht aus.

Das Replay-Skript verarbeitet jetzt den Review-Export direkt, vermeidet die doppelte Anwendung des Showprofils, übernimmt den Abschnittskontext und normalisiert die Strahlfarbe unabhängig von ihrer Leistung.

## Fortsetzung: vollständiger Dunkelmoment weiterhin gemeldet

Der Nutzer stellt klar, dass alle Lampen gleichzeitig dunkel werden und dass auch die Flow-Unterstützung den Fehler nicht löst. Sie ist daher keine bestätigte Lösung. Eine versuchte Änderung der Gruppen-Antworten wurde vor Abschluss zurückgenommen.

Gezieltes, ausschließlich lesendes Auslesen der AnyDj-Local-Storage-Datensätze für `localhost:3030` ergab: Helligkeit 100, Lichtimpulse 100, Sättigung 100, Farbton 0; Bühnenmodus auto, vier Farben, vier statische Quellen und fünf Moving-Head-Quellen. Aktiver Raum ist die genannte Club-Bühne mit ihren drei Ruhezonen. Keine Browserdaten wurden verändert.

Auch ein Offline-Replay mit diesem gespeicherten Raum, der Quellenbelegung und vier Farben erzeugt bei 91 s keinen vollständigen Blackout (68 aktive virtuelle Lichtquellen, davon 12 Moving Heads, mit dem derzeitigen Flow-Unterstützungslicht). Damit ist die globale Abdunklung weiterhin nicht reproduziert. Insbesondere sind echte Browser-Zwischenzustände und GPU-Pixel damit nicht geprüft.

Der Export enthält nun optional `runtime`: globale Lichtregler, Bühnenmodus, Ausstattung sowie bis zu 45 Sekunden begrenzte Ausgabehistorie bei 10 Hz. Pro Sample: Songzeit/Quellenhelligkeit und Lampenleistung nach Typ vor der Raumberechnung sowie am Eingang des Renderers. Die Historie bleibt im Arbeitsspeicher; kein Netzwerk, keine automatische Speicherung. Sie zeigt keine GPU-Pixel.

Validierung: 905 Unit-Tests bestanden; vorhandener Browsercheck `check-section-lighting.mjs` bestanden, keine Browserfehler. Der neue Modulpfad wird vom Entwicklungsserver ausgeliefert.

## Rücknahme zusätzlicher Show-Dimmer

Nach der Rückmeldung zur insgesamt dunkleren Show wurden die neu eingeführten zusätzlichen Dimmer entfernt: keine pauschale Grundlichtabschaltung nach Rollen/Formen, kein 45-%-Flow-Sockel und keine zusätzliche kontinuierliche Wellenabsenkung auf bereits ausgewählten Moving Heads. Alte `supportGain`-/`wavePhase`-Metadaten werden nicht mehr als zusätzliche Dimmer ausgewertet. Musikalische Aktivität, bestehende Gruppenaktionen, Paarbelegung und Blackouts bleiben zuständig; symmetrische Bewegungen und Gruppenüberblendungen bleiben erhalten.

Abgleich mit dem Nutzerexport und seiner gespeicherten Ausstattung: Die vier statischen Quellen erreichen bei 90,77 s wieder 19,55 % statt 8,80 % und bei 91,08 s 28,05 % statt 12,62 %. Moving-Head-Quellen bleiben unverändert bei 23 bzw. 33 %. Das ist eine gezielte Rücknahme der Helligkeitsregression, keine bestätigte Behebung des ursprünglich gemeldeten globalen Dunkelmoments. 903 Tests bestanden; zwei Tests für die entfernten Dimmfunktionen wurden entfernt, die Regressionstests prüfen auch gespeicherte alte Metadaten.
