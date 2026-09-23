# Musikabhängiger Helligkeitsausdruck

Bisher bedeuteten ausgewählte Musikereignisse fast immer kurze Helligkeitsimpulse.
Jetzt bestimmt die vorhandene Phrasenanalyse, wie diese Ereignisse erscheinen:

- Atmosphärisch: dem langsameren Grundlicht folgen, gewöhnliche Impulse auslassen.
- Fließend oder deutlich gesangsgeführt: kleine Wellen mit 200 ms weichem Anstieg.
- Rhythmischer Aufbau: stärkere Wellen statt durchgehender kurzer Blitze.
- Begleitender rhythmischer Abschnitt: reduzierte Impulse mit längerem Ausklang.
- Rhythmischer Höhepunkt: klare Impulse behalten.
- Akustisch herausragende Schläge: auch in ruhigen Passagen erhalten.

Weiche Wellen lösen keine abrupten Wechsel der aktiven Scheinwerfergruppe aus.
Ausklänge überlappen, sodass ein unterdrücktes Ereignis einen vorherigen Akzent
nicht abschneidet. Die Auswertung bleibt deterministisch und seekbar; Profile
werden pro Arrangement zwischengespeichert. Bestehende analysierte Arrangements
werden beim Abspielen mit der neuen Helligkeitsform gerendert. Alte Pläne ohne
Phraseninformationen behalten ihre bisherigen Hüllkurven.

## Prüfung

412 Node-Tests und Browsercheck für Moving Heads bestanden.

Vorhandene Analyse von `RobbieWilliamsBoddies.mp3`, in 20-ms-Schritten:
Gezählt wurden Änderungen größer als 0,08 auf der normalisierten Helligkeitsskala.
Dies misst schnelle Helligkeitssprünge, nicht die subjektive Wirkung realer Lampen.

| Abschnitt | Vorher | Nachher |
| --- | ---: | ---: |
| 10–50 s | 129 | 51 |
| 69,53–84,89 s | 44 | 44 |
| 184,73–200,09 s | 7 | 5 |

Der markante Akzent bei 190,26 s bleibt bei 0,6134 unverändert.
Von 511 ausgewählten Ereignissen erhalten 5 gehaltenes Licht, 45 Wellen,
178 weichere Groove-Impulse und 283 klare Impulse. Es gibt keine song- oder
zeitpunktspezifischen Regeln in der Implementierung.
