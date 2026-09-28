# Vice City: stockende Show-Bewegungen

Untersucht: `GTA Vice City - Introduction Theme [REMASTERED & EXTENDED].mp3`, 316,37 s, frische lokale Basisanalyse mit Beat- und Stilanalyse. Die gespeicherte Browseranalyse und GPU-Frametimes wurden nicht gemessen.

## Befund

Der Show-Pfad erzeugte 90 Zielposen, davon 81 mit Rolle `groove`, aber keine als kontinuierliche Bewegung. Zwischen den ersten Zielen lag beispielsweise eine Haltezeit von 3,04 s, gefolgt von 1,1 s Fahrt; danach mehrfach 2,9 s Stillstand plus 1,1 s Fahrt. Die Interpolation bremste an jedem Ziel auf null ab. Das ist ein nachvollziehbarer Ursprung für einen stockenden Eindruck unabhängig von der Renderleistung.

## Änderung

Zusammenhängende Groove-, Flow- und Build-Bewegungen nutzen das verfügbare musikalische Intervall. Die vorhandene kontinuierliche Interpolation führt Geschwindigkeit an gewöhnlichen Zwischenzielen weiter. Gehaltene Posen, manuelle Bewegungspausen und hervorgehobene Einsätze behalten ihre eigene Behandlung. Fokuswerte werden auch auf kontinuierlichen Bahnen interpoliert.

Die gleichen 90 Ziele bleiben bestehen; 83 Fahrten sind nun kontinuierlich. Die genannten künstlichen Wartezeiten entfallen. Lichtstärke und Gruppenbelegung werden nicht verändert.

Regressionstest prüft volle Fahrintervalle, Geschwindigkeit vor/nach einem Zwischenziel, Fokus sowie erhaltene manuelle Pausen und akzentuierte Einsätze. Sichtprüfung der laufenden Browserdarstellung bleibt erforderlich; eine allgemeine Performance-Ursache ist damit nicht ausgeschlossen.

## Vollständige Analyse

Auch mit der abgeschlossenen Struktur- und Instrumentenanalyse geprüft: 17 Sektionen, 93 Zielposen, davon 86 kontinuierliche Fahrten nach der Korrektur. Alle 922 Tests der Gesamtsuite bestanden. Die Zahlen der Basisanalyse oben beschreiben einen separaten Analysestand, nicht die gespeicherte Show des Nutzers.
