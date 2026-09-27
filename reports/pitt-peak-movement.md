# Pitt Henrich – Es wird viel passiern: 50–70 Sekunden

Frische vollständige lokale Audioanalyse mit Beat-, Stil-, Struktur- und Instrumentenmodell. Der mittlere Liedcharakter ist `flowing` (Energie 0,515, Antrieb 0,402). Der Bereich 50,55–61,40 s wird trotzdem korrekt als `impact` erkannt (Energie 0,797, Antrieb 0,478); 61,40–72,26 s ebenfalls (Energie 0,809, Antrieb 0,75).

## Ursache

Die bevorzugten Formfamilien wurden ausschließlich aus dem gesamten Lied abgeleitet. Auch die beiden Höhepunktpassagen bevorzugten deshalb Rahmen, Sammelfigur, Lichtvorhang und atmenden Bogen. Die erste Passage wählte `curtain`. Ihre niedrige Tiefenauslenkung lässt ein weitgehend gleichbleibendes Bild entstehen. Die folgende Passage verwendete bereits `crossed-banks`: Der Plan stand also nicht tatsächlich 20 Sekunden auf derselben Formation. Der genaue gespeicherte Browserzustand wurde nicht reproduziert.

## Änderung

Erkannte `impact`-Passagen bevorzugen aktive räumliche Figuren unabhängig vom ruhigeren Durchschnittscharakter. Statische beziehungsweise sehr zurückhaltende Rahmen-/Vorhangfamilien sind dort ausgeschlossen. Akzentdichte, Bewegungstempo, Helligkeit und Oberflächenregeln werden nicht erhöht oder verändert.

Im neu berechneten konkreten Plan:

- 50,55–61,40 s: `crossed-banks` (gegeneinander bewegte Bänder).
- 61,40–72,26 s: `parallel-sweep` (gemeinsamer räumlicher Schwenk).

Die Figuren gehen über die vorhandene kontinuierliche Überblendung ineinander über. Die Regel ist unabhängig von Dateiname und Gerätemenge und gilt im gemeinsamen Bewegungsplan für Automatisch und Show. Cacheversion 48, Bewegungsplan 13.

## Prüfung

884 Tests bestanden. Neue Regression: lokaler Höhepunkt in einem sonst zurückhaltenden Lied erhält aktive Formen, ohne seinen Bewegungsantrieb zu erhöhen; Übergänge bleiben positionskontinuierlich. Offline-Raumtrace der Passage mit dem Club-Preset und 48 Moving Heads, einschließlich Zonen und Motoren, ausgeführt. Keine visuelle Live-Abnahme oder GPU-Messung.
