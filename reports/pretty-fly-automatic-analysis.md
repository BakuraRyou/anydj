# Pretty Fly: Automatisch im Großclub

## Ergebnis

Die fehlende Dynamik ist in der aktuellen Planung nachvollziehbar. Das Hauptproblem ist die Zuordnung rhythmischer Passagen zu langsamen Schwenkbildern. Zusätzlich bleiben dieselben Gerätereihen für ganze Songabschnitte aktiv. Die letzte Reduktion gewöhnlicher Beatbewegungen betrifft nur einen Teil des Problems.

## Methode und Grenzen

- Lokale Datei: `The Offspring - Pretty Fly (For A White Guy) (Official Music Video).mp3`, Länge 192,702 Sekunden.
- Neue vollständige Analyse mit den installierten Beat-, Stil-, Struktur- und Instrumentenmodellen; 445 Beats, 9 Strukturabschnitte. Abschnittsnamen stammen vom Modell.
- Aktueller Show-Compiler, Profil Automatisch / Bewegungsstimmung balanced, Helligkeit Minimum 5 / Maximum 100. Keine gespeicherten Nutzereinstellungen übernommen.
- Großclub: 72 Moving Heads, 72 Spots, 48 Lichtleisten. Abtastung der vorbereiteten Bewegung und der Raumbelegung alle 0,25 Sekunden.
- 8 virtuelle Moving-Head-Quellen werden mit der vorhandenen Raumlogik erweitert. Statische Quellen teilen sich für diesen Vergleich den Songframe. Individuelle Gerätefarben, Deckmischung, Live-Einstellungen, zusätzliche Motorfilter, Raumhindernis-Routing und Transfer-Shutter sind nicht nachgebildet. Dies ist eine isolierte Rekonstruktion, keine Aufnahme der laufenden Nutzersitzung.
- Vier WebGL-Standbilder bei 16, 48, 80 und 128 Sekunden. Die zeitliche Auswertung beruht auf den berechneten Bewegungen, nicht auf diesen Standbildern.

## Passagen

| Zeit | Befund | Wirkung |
| --- | --- | --- |
| 0:00–0:09 | Ruhiges Bild, geringe analysierte Energie | Als Einleitung nachvollziehbar. |
| 0:09–0:31 | Groove und Aufbau; mehrere Formwechsel | Hier reagiert die Planung bereits deutlich. |
| 0:48–1:25 | Erster erkannter Refrain: alle sechs Phrasen haben `movement.driving = 1`, werden aber als `sweep` eingestuft | Rhythmischer Antrieb wird zu flächiger Schwenkbewegung. Nach dem Übergang bleiben 36 Moving Heads in denselben drei Reihen aktiv. |
| 1:25–1:41 | Zwei weitere Schwenkphrasen, danach Aufbau | Zwischen 1:28 und 1:36 ändert sich im vorbereiteten Bild nur Pan; die Tilt-Spannweite ist null. |
| 1:41–2:06 | Zweiter erkannter Refrain ebenfalls durchgehend `sweep` | Wieder wenig Unterschied in der Art der Bewegung; dieselben drei Reihen bleiben bis zum nächsten Abschnitt zuständig. |
| 2:06–2:15 | Reduzierte Energie, `sculpture` | Der Rückzug wird grundsätzlich erkannt. Die Rekonstruktion zeigt weiter flächiges statisches Grundlicht. |
| 2:35–2:48 | Zwei `impact`-Phrasen, im stabilen Abschnitt 60 Moving Heads | Mehr Besetzung, aber keine entsprechend differenzierte Aufgabe der Reihen. |

## Ursachen im Code

1. **Rhythmischer Antrieb und Schlagzeuganteil werden gleichgesetzt.**
   `lightingScenes()` in `public/dmx-light-scenes.js` verwendet die gemittelte `drama.percussion` als `drive`, sobald diese Daten vorhanden sind. Der unabhängige Phrasenwert `movement.driving` ist dann nur ein ungenutzter Fallback. Im ersten Refrain liegt percussion etwa zwischen 0,34 und 0,40, unter der Groove-Schwelle 0,45, obwohl die Phrasen rhythmisch mit driving 1 eingestuft sind.
2. **Die falsche Zuordnung sperrt musikalische Bewegungsakzente aus.**
   `lightingGestures()` lässt nur groove/impact mit drive mindestens 0,45 durch. Insgesamt entstehen nur 34 solche Gesten und darunter zwei markante Akzentgesten. Die Show besitzt trotzdem 108 Bewegungscues: Viele sind Schwenk- oder Aufbauziele. Wenige Gesten bedeutet also nicht völligen Stillstand.
3. **Rund 109 Sekunden, etwa 57 % des Songs, landen in `sweep`.**
   Das umfasst große Teile beider ersten Refrains. Die Einstufung verliert gerade dort den musikalischen Unterschied, den die Show sichtbar machen sollte.
4. **Die Reihenauswahl hängt am groben Songabschnitt.**
   In `public/dmx-activity.js` stammt `rowSelection` aus `sectionIndex`. Im ersten Refrain bleiben so etwa 37 Sekunden dieselben drei Reihen ausgewählt, trotz sechs erkannter Phrasen. Die Reihen erhalten gemeinsam besetzte Figuren, aber keine eigenständigen Antworten auf Riff, Gesang oder Schlagzeug.
5. **Breites Grundlicht überdeckt Unterschiede.**
   Die 120 statischen Quellen werden vervielfacht und heruntergedimmt, erhalten aber durch das neue Budget noch keine musikalisch getrennten Aufgaben. In den isolierten Standbildern bleibt deshalb ein ähnliches breites Bodenbild bestehen. Die gemeinsame statische Testfarbe verstärkt diesen Eindruck; eine Aussage über die Farben der Nutzersitzung lässt sich daraus nicht ableiten.

## Empfohlene nächste Änderung

- Rhythmischen Antrieb aus mehreren Messungen bestimmen: Phrasenbewegung, reale Angriffe und Instrumentenentwicklung. Niedriger relativer Schlagzeuganteil darf einen klar rhythmischen Gitarrenabschnitt nicht automatisch zum atmosphärischen Schwenkbild machen. Kein pauschales Absenken der Groove-Schwelle für alle Lieder.
- Phrasen innerhalb eines Abschnitts eigene Gruppenaufgaben geben: eine Reihe trägt das Riff, eine andere antwortet auf einen gemessenen Akzent; die restlichen Reihen halten oder pausieren. Übergaben an musikalische Veränderungen koppeln, ohne festen Effektwechsel nach einer Taktzahl.
- Statisches Grundlicht als Begleitung planen, damit bewegte Figuren lesbar bleiben. Helligkeitsbudget und Farben beibehalten.
- Größere Bewegung an tatsächlichen musikalischen Änderungen erlauben; kleine normale Beatbewegung erhalten. Keine allgemeine Erhöhung von Geschwindigkeit, Strobe oder Helligkeit.

## Dateien

- [Messwerte und vollständige Zeitleiste](pretty-fly-automatic-analysis.json)
- Standbilder: [0:16](pretty-fly-16.png), [0:48](pretty-fly-48.png), [1:20](pretty-fly-80.png), [2:08](pretty-fly-128.png)
- Auswertung wiederholen: `node scripts/review-automatic-room.mjs /tmp/pretty-fly-plan.json`. Der vorbereitete Plan liegt lokal unter `/tmp`; die Auswertung benötigt diesen oder einen entsprechend vorbereiteten Plan.

Die Anwendungslogik wurde für diese Untersuchung nicht verändert.
