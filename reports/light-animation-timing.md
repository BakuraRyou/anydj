# Reproduktion rhythmischer Animationspausen

24.09.2026, lokaler Headless-Chrome-Test, 1280 × 720, acht Sekunden. Die laufende Demo bleibt sichtbar. Zusätzlich werden der produktive Show-Timer und `automaticStage` mit einem synthetischen, als rollend eingestuften 120-BPM-Motiv gemessen. Exakte Zeitsamples ohne Timer trennen geplante Stillstände von Scheduling-Verzögerungen. Reproduktion: `node scripts/check-light-animation-timing.mjs` (JSON standardmäßig unter `/tmp/anydj-animation-lag.json`).

| Messung | Median | 95. Perzentil | Maximum |
| --- | ---: | ---: | ---: |
| Browser-Bildabstand | 16,7 ms | 16,8 ms | 16,8 ms |
| Vorschau-Timerabstand | 16,4 ms | 17,1 ms | 27,3 ms |
| Automatische Bühnenberechnung | 0,1 ms | 0,2 ms | 1,0 ms |

Es gab im Test keine Browser-Bildabstände über 25 ms. Der beatbezogene Vorschau-Timer hatte sechs Abstände über 25 ms, keinen über 50 ms. Das erklärt höchstens kleine zusätzliche Ungleichmäßigkeiten, nicht die langen Stillstände.

Die rollende Farbanimation liefert dagegen auch bei idealen Zeitsamples wiederkehrend 0,58 Sekunden identische RGB-Werte: ab 1,44, 2,44, 3,44, 4,44 und 5,44 Sekunden. In der laufenden Messung blieben die Werte maximal 33 Updates hintereinander gleich.

Ursache: `spatialColors` bildet aus zwei ausgewählten Attacken einen Schritt. Bei 120 BPM beginnt ein neuer Schritt jede Sekunde; die Interpolation endet schon nach höchstens 0,45 Sekunden. RGB-Rundung verlängert den beobachtbaren Stillstand etwas. So entsteht ein rhythmisches Stoppen und Weiterlaufen, obwohl die Berechnung schnell und die Bildschirmrate stabil ist.

Dies reproduziert das beschriebene Verhalten für rollende Farben. Es ist kein Nachweis, dass sämtliche Animationen oder das konkrete Nutzergerät dieselbe Ursache haben. Die vollständige Musikwiedergabe und reale Hardware-Ausgabe wurden in dieser Messung nicht profiliert. An der produktiven Animation wurde in diesem Untersuchungsschritt nichts geändert.

Gezielter nächster Schritt: Bei kontinuierlich rollenden Motiven die Interpolation über den tatsächlichen Abstand der ausgewählten Schritte laufen lassen; echte musikalische Pausen und ausdrücklich gehaltene Motive separat erhalten. Den Vorschau-Timer unabhängig vom Beat-Lampen-Sendetakt auf Bildschirmbilder synchronisieren, falls weitere Messungen dessen kleinere Aussetzer bestätigen.


## Korrektur und erneute Messung

Die Farbübergänge laufen jetzt über das vollständige gemessene Intervall bis zum nächsten Zwei-Attacken-Schritt. Beginn und Ende benachbarter Schritte passen zusammen; auch der erste Schritt bewegt sich. Ein starres Zeitlimit von 0,45 Sekunden entfällt. Die Erkennung echter Motivlücken bleibt erhalten.

Gleicher Acht-Sekunden-Browsertest nach Korrektur: keine Farbpausen über 150 ms bei idealen Zeitsamples, maximal zwei identische Vorschau-Updates statt zuvor 33. Browser-Bildabstand weiterhin maximal 16,8 ms, Berechnung maximal 1,0 ms. Die kleineren Unregelmäßigkeiten des beatbezogenen Timers bleiben unverändert (maximal 25,3 ms im neuen Lauf); sie sind nicht die behobene Stop-and-go-Ursache.

Ein Regressionstest prüft die späte Bewegung innerhalb jedes Schritts bei 100, 120 und 200 BPM, stetige Schrittgrenzen, unregelmäßige Attacken und echte musikalische Lücken. Das Browser-Messscript prüft nun zusätzlich, dass keine langen geplanten Farbpausen auftreten. Neuladen der Anwendung genügt; keine neue Songanalyse erforderlich.
