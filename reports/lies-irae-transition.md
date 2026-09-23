# Lies Irae: Übergang um 1:00–1:10

Die lokale Datei wurde am 23.09.2026 frisch mit dem aktuellen Analysepfad
untersucht: FFmpeg, Beat This, Stilanalyse, All-In-One und Demucs, anschließend
Kompilierung der automatischen Lichtshow. Gesamtdauer der Prüfung ca. 107 s.
Die Aussagen beruhen auf Signal-, Instrumenten- und Planwerten, nicht auf einem
subjektiven Hörvergleich oder realen Lampen.

## Befund

- Abschnittsgrenze bei 60,00 s erkannt. Der folgende Abschnitt 60,00–85,95 s
  erhält die Gestaltung „Aufbau“.
- Phrase 60,00–70,40 s wird als atmosphärisch eingestuft; erst danach rhythmisch.
- Der durchschnittliche RMS-Pegel steigt von 0,115 bei 62–64 s auf 0,286 bei
  68–70 s. Auch der Klangfarbenwert steigt von 0,452 auf 0,642.
- Gleichzeitig bleibt die normalisierte Instrumentenintensität bei den
  Stichproben 60, 62, 64, 66 und 68 s genau null. Die globale Normalisierung
  begrenzt den Bereich unterhalb ihrer Referenzschwelle auf null.
- Die Aktivitätsplanung gibt bei 62, 64 und 66 s jeweils [1,0,0,0] aus.
  Bei 68 s erst [1,0.03,0,0]. Das sind Aktivitätsfaktoren, keine absoluten
  Lampenhelligkeiten.
- Ein Klangwechsel und eine Bewegungsankunft werden bei 69,90 s erkannt;
  anschließend beginnen Groove-Fahrten. Die Analyse ist also nicht insgesamt
  blind für den Übergang, sondern verliert den Verlauf innerhalb der Ruhephase.

## Empfohlene Weiterentwicklung

Globale Intensität und lokale Spannung getrennt behandeln. Die globale
Intensität bestimmt, wie groß/hell eine Szene ist. Eine zusätzliche Verlaufsspur
soll innerhalb leiser Phasen RMS-Anstieg, Klangaufhellung, Rauschanteil und
Instrumenteneinsätze bewerten, auch wenn keine Schlagzeugimpulse vorhanden sind.
Lokale Normalisierung darf dabei eine leise Passage nicht automatisch zum Peak
machen.

Den erkannten Verlauf als zusammenhängende Rücknahme → Aufbau → Wiedereinstieg
planen. Für diese Referenz: um 60 s räumlich reduzieren; ab etwa 64 s zunehmend
öffnen und Scheinwerfer hinzunehmen; um den gemessenen Einstieg 69,9–70,4 s einen
klaren gemeinsamen Kontrast setzen. Den musikalischen Eintritt aus mehreren
Merkmalen präzisieren, nicht pauschal auf eine ganze Taktgrenze verschieben.

## Umgesetzte Korrektur

Die Aktivitätsplanung rekonstruiert jetzt eine geglättete Verlaufsspur aus den
bereits gespeicherten rohen Instrumentenpegeln. Anders als die globale Intensität
zieht sie keinen Grundpegel ab, der leise Aufbauten auf null begrenzt. Diese
zusätzliche Spur wird nur für überwiegend niedrig eingestufte Passagen genutzt.
Ein Verlauf muss weiterhin die Dauer-, Änderungs- und Kohärenzprüfungen bestehen;
Stille und konstante Pads lösen keinen künstlichen Aufbau aus. Bei einer
Rücknahme mit anschließendem Aufbau dient der Tiefpunkt als Ausgangspunkt.

An der unveränderten vorhandenen Analyse des Referenztracks wurde die Ausgabe
bis nach DMX-Kodierung/-Dekodierung geprüft. Maximaler RGB-Kanal je Spot (0–255):

| Zeitpunkt | Spot 1 | Spot 2 | Spot 3 | Spot 4 |
| --- | ---: | ---: | ---: | ---: |
| 64,0 s | 28 | 0 | 0 | 0 |
| 64,5 s | 29 | 9 | 0 | 0 |
| 65,0 s | 31 | 31 | 0 | 0 |
| 66,0 s | 35 | 35 | 35 | 0 |
| 68,0 s | 39 | 39 | 39 | 1 |
| 69,9 s | 55 | 55 | 55 | 55 |

Das sind berechnete Ausgangswerte, keine Messung realer Hardware. Es gibt keine
Dateinamen- oder Zeit-Sonderregel. Die früheren Diagnosedaten bleiben in
`lies-irae-transition.json` dokumentiert. Vollständig analysierte gespeicherte
Pläne mit Instrumentenpegeln benötigen keine erneute Audioanalyse; ohne diese
Daten bleibt das bestehende Verhalten erhalten.
