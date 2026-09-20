# Bewegung und Abschnittsdynamik wiederherstellen

20.09.2026. Die vorige automatische Gestaltung war zu zurückhaltend: 3,5 Sekunden
Mindestabstand zwischen Akzenten, geringe Farbauslenkung und 1,2–3 Sekunden
Farbglättung ließen selbst rhythmische Musik überwiegend wie Ambient-Licht wirken.

Planversion 8 / Arrangementversion 2:
- Anstiege von Pegel und Bass sowie relative spektrale Änderungen liefern
  Anschlag-Evidenz. Das Modellraster allein reicht nicht für einen Akzent.
- Ruhige Passagen, Strophe, Aufbau und intensive Passage verwenden unterschiedliche
  Schwellen, Akzentstärken und Abklingzeiten. Strophen setzen beim gleichen
  Rhythmus weniger Akzente als Refrains.
- Kräftige Passagen reagieren wieder deutlich in Farbe und Helligkeit, mit
  Grundlicht zwischen den Akzenten. Keine globale Akzentsperre von 3,5 Sekunden.
- Farbkontur und Anschläge bewegen zwischen verwandten Palettenankern. Aktive
  Passagen reagieren schneller; ruhige Stellen bleiben langsamer.
- KI-Labels werden mit Abschnittsenergie kombiniert: ein kräftiges Intro wird
  nicht allein wegen seiner Bezeichnung zum ruhigen Lichtbild.
- Konstante Töne ohne Attacken erzeugen keine erfundenen Impulse. Für den
  Liedanfang wird keine fehlende Audio-Vorgeschichte als Lautstärkesprung gewertet.

Prüfung:
- 134 Node-Tests erfolgreich. Zusätzliche Regressionen fordern deutliche Farb-
  und Helligkeitsreaktion auf rhythmisches Audio, Ruhe bei konstanten Tönen,
  Unterschiede zwischen Strophe/Refrain und bewegliche energiegeladene Intros.
- Browservergleich mit der vorhandenen MP3 und echten Beat-This!-Daten:
  544 Beats, 396 ausgewählte Akzente ohne zusätzliche Struktur, 350 mit den
  früher lokal erkannten KI-Abschnitten. Keine neue All-In-One-Inferenz.
- 149 beziehungsweise 100 Bildsprünge über 20 Helligkeitspunkte, verglichen mit
  888 beim durchgängigen Pulsrenderer. Rund 0,6 % der Bilder nahe Minimum;
  der Pulsvergleich lag bei rund 35 %. Damit sind die Varianten beweglicher,
  fallen aber nicht ständig auf die Mindesthelligkeit zurück.
- Auto-Crossfade, manuelle Übernahme und Layout im stummen Demo-Browser bestanden.
  Keine Browser-Ausnahmen, keine realen Lampen gesteuert.

Messwerte: `dynamic-show-browser-check.json`. Diese Kennzahlen messen Bewegung
und Kontrast, nicht die subjektive Qualität. Der sichtbare musikalische Eindruck
an einer realen Lampe ist weiterhin nicht verifiziert.
