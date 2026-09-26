# Pretty Fly: Verbesserung der automatischen Gruppenarbeit

Vergleich mit demselben vorbereiteten Audioplan und demselben Großclub wie in [der Ausgangsanalyse](pretty-fly-automatic-analysis.md). Die dort genannten Grenzen gelten weiterhin; die gespeicherte Nutzersitzung wurde nicht nachgestellt.

| Messwert | Vorher | Nachher |
| --- | ---: | ---: |
| Als Schwenkbild eingestufte Dauer | 108,96 s | 62,04 s |
| Rhythmische Bewegungsgesten | 34 | 67 |
| Markante Akzentgesten darunter | 2 | 6 |
| Rhythmisch eingestufte Phrasen im ersten Refrain | 0 von 6 | 3 von 6 |

## Änderungen

- Gemessener rhythmischer Phrasenantrieb wird zusätzlich zum Schlagzeuganteil berücksichtigt. Die Ergänzung benötigt echte Audio-Onsets, mindestens zwei pro Passage und ausreichende Dichte, sowie eine Mindestenergie und einen messbaren Schlagzeuganteil. Ein Beat-Raster oder ein Genre-/Abschnittsname allein aktiviert sie nicht.
- Die lokale Gestenplanung erhält diese Rhythmusbewertung ebenfalls. Sie verwirft sie nicht wieder zugunsten des relativen Schlagzeuganteils.
- Gerätereihen wechseln bei gemessenen Änderungen von Energie, Klangfarbe, Gesangsanteil, Antrieb oder Abschnittsart. Identische aufeinanderfolgende Phrasen behalten ihre Gruppen. Die bestehenden Überblendungen bleiben erhalten.
- Große automatische Anlagen verteilen statisches Grundlicht auf räumliche Begleitgruppen. Das vorhandene Helligkeitsbudget bleibt die Obergrenze; aktive Gruppen erhalten Begleitung, die übrigen Flächen treten zurück. Farben, kleine Anlagen und manuelle Rhythmusvorgaben bleiben erhalten.
- Die vorbereitete Bewegungsplan-Version ist erhöht.

Der erste Refrain bleibt bewusst teilweise ein Schwenkbild: Die konservative Prüfung findet in drei Phrasen noch nicht genug gemeinsame Evidenz. Dies ist eine erste gezielte Verbesserung, keine Behauptung einer vollständigen musikalischen Interpretation.

## Prüfung

22 gezielte Tests bestehen, darunter rhythmische Erholung bei kleinem Schlagzeuganteil, Schutz atmosphärischer Passagen, unveränderte identische Phrasen, kontinuierliche Gruppenübergaben, Blackouts, manuelle Vorgaben und Show-Modus. Der Gesamttest vor Hinzufügen der drei neuen Regressionstests hat 784 bestandene Tests und die drei bereits bekannten Fehler in Rhythmus-Erholung bzw. Stage-Motion.

[Messwerte nachher](pretty-fly-automatic-after.json), [Messwerte vorher](pretty-fly-automatic-analysis.json).

WebGL-Standbilder nachher: [0:16](pretty-fly-after-16.png), [0:48](pretty-fly-after-48.png), [1:20](pretty-fly-after-80.png), [2:08](pretty-fly-after-128.png). Diese zeigen einzelne Zustände; der Dynamikvergleich beruht auf der zeitlichen Auswertung.
