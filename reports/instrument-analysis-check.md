# Instrumente und Spannungsverlauf

Die bestehende All-In-One/Demucs-Ausführung liefert zusätzlich vier RMS-Verläufe
in 100-ms-Schritten. Keine zweite Modellinferenz. Temporäre Spuren werden beim
Abschluss oder Abbruch mit dem bestehenden Arbeitsverzeichnis entfernt.

Die Show verwendet den gesamten Song als Intensitätsreferenz, erkennt
Schlagzeuganstiege getrennt vom Gesang, wählt die Abschnittsdynamik nach diesen
Messwerten und nimmt vor deutlich stärkeren Einsätzen etwas Grundhelligkeit
zurück. Die Zeitpunkte bleiben auf dem vorhandenen Beat-Raster. Manuelle
Abschnittseinstellungen werden anschließend angewandt.

## Messung auf diesem Rechner

Vollständige Dateien, CPU, keine warmen Ergebnis-Caches. Gemessen wurden Dekodierung,
Beat This!, Discogs-EffNet, die Basis-Show im selben Worker-Code wie im Browser,
All-In-One einschließlich Demucs und die verfeinerte Show. Dekodierung für diesen
Test mit FFmpeg, nicht Browser-WebAudio; deshalb keine exakte Browser-Wartezeit.

| Datei | Songdauer | Basisanalyse¹ | Zusatzanalyse² | Gesamt |
|---|---:|---:|---:|---:|
| RobbieWilliamsBoddies.mp3 | 263,70 s | 5,69 s | 97,40 s | 103,48 s |
| scatman_neu.mp3 | 217,52 s | 5,75 s | 83,88 s | 89,99 s |

¹ Beat, Stil und Basis-Show. ² Instrumente, Struktur und erneute Showberechnung.
Gesamt einschließlich Dekodierung. Zusammen rund 40,2 % der Songdauer.
Das sind zwei Stichproben, keine Garantie für beliebige Hardware oder Musik.

Bei Bodies wird 184,73–200,09 s zurückhaltend gestaltet (mittlere relative
Intensität 0,17), der anschließende Refrain stärker (0,70). Die Zahl ausgewählter
Akzente sinkt von 512 auf 471; bei Scatman von 427 auf 306. Weniger Akzente allein
belegen keine bessere Show. All-In-One bezeichnet bei Scatman viele Abschnitte
als Intro: diese semantischen Modellfehler werden nicht als korrekte Labels
behauptet, und die Dynamik richtet sich zusätzlich nach den Instrumentenwerten.
Die subjektive Wirkung an einer echten Lampe wurde nicht geprüft.

## Laufzeit und Abbruch

Seit 2026-09-21 gibt es für Beat-, Stil- und Songaufbauanalyse kein automatisches
Laufzeitlimit mehr. Browser und Server setzen keine Zeitbudgets. Manuelle
Abbrüche, Verbindungsabbrüche und Server-Shutdown beenden die Berechnung weiterhin.
21 Analyseregressionstests bestanden, einschließlich simulierter 24 Stunden Laufzeit
für jeden der drei Dienste ohne automatische Beendigung.

## Prüfungen

- 195 Node-Tests bestanden: Instrumentendatenvalidierung, Stille, gesangsbetonte
  Ruhe gegenüber Schlagzeug-Einsatz, Zeitbudgetübertragung und Server-Abbruch
  einschließlich Aufräumen.
- Browser: Instrumentendaten und Spannungsverlauf im Show-Cache, Abschnittseditor,
  Speicherung, Motivübertragung, Beat-Teilung, Abbrechen und mobile Darstellung.
- DJ-Regression: Cache-Versionierung, automatische Überblendungen, Reihenfolge,
  Entfernen, Neuladen und drei Layoutgrößen; keine Browserfehler.

Wiederholung: `node scripts/check-instrument-analysis.mjs /pfad/lied1.mp3 /pfad/lied2.mp3`.
Rohmesswerte: [instrument-analysis-benchmark.json](instrument-analysis-benchmark.json).
