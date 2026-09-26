# Prismen und Gobos: Vorschau-Prototyp

## Ergebnis

- [Referenzaufbau vorher/nachher](../__mock/prism-gobo-comparison.jpg)
- [Bodenprojektion: links Dreiloch-Gobo, rechts Dreifachprisma](../__mock/prism-gobo-floor.png)

Die Referenzszene verwendet jetzt drei blaue Prismenstrahlen pro oberem blauen Kopf und ein Dreiloch-Gobo in den acht oberen magentafarbenen Köpfen: **54 Strahlen aus 22 Köpfen**. Die Muster sind eine visuelle Hypothese, keine Identifizierung der tatsächlichen Geräte im Referenzvideo.

Die Rekonstruktion erhält damit die zuvor fehlenden Teilstrahlen. Sie erreicht noch nicht die räumliche Nebelwirkung oder die Belichtung des Videos. Das Gobo ist eine geometrische Näherung mit drei runden Öffnungen, kein universeller Texturprojektor für beliebige Gobobilder.

## Funktionsweise

`previewOpticalRays()` in `dmx-light-geometry.js` erzeugt die optischen Teilstrahlen separat von Gehäuse, Linse und mechanischer Zielrichtung. Beide Darstellungswege – Luftstrahl und Lichtfläche – verwenden dieselben Teilstrahlen. Jeder trifft mit `roomBeamHit()` auf die erste Raumfläche. An Raumkanten bleibt die bestehende Kegel-/Flächenberechnung zuständig.

Unterstützte Eigenschaften eines Vorschau-Lichts:

```js
{
  type: 'moving',
  prism: 3,             // drei linear angeordnete Facetten
  prismSpread: 18,      // ungefährer Winkel zwischen den äußeren Achsen, Grad
  gobo: 'triad',        // optional: drei runde Öffnungen
  opticsRotation: 25   // expliziter Drehwinkel in Grad
}
```

Prisma und Gobo können kombiniert werden, maximal neun Teilstrahlen pro Kopf. Das Prisma verteilt 90 % der Eingangsleistung auf seine Kopien; das Gobo verwendet 72 % Transmission. Dies sind angenommene Vorschauwerte, keine gemessenen Gerätekennlinien. Bei Kombination gilt derzeit die Gobo-Transmission als gesamter Transmissionsfaktor. Die Summe der Teilstrahlleistungen überschreitet die Eingangsleistung nicht. Die vorhandene Belichtungskurve wird danach auf die Vorschau angewandt; Displayhelligkeit ist kein linearer photometrischer Messwert.

Die Felder sind **Szenenparameter**, noch keine neuen UI-Bedienelemente oder DMX-Kanäle. Die normale Show aktiviert sie nicht automatisch. Für einen Einsatz dort sind Gerätefähigkeiten und die Übernahme der Optikparameter in die Show-/Raumplandaten erforderlich. Die Raumplanung berücksichtigt bislang nicht den vollständigen aufgefächerten Schutzbereich eines Prismas; dieser Prototyp darf deshalb nicht als neue Hardware-Routingfunktion interpretiert werden.

## Begrenzter Aufwand

Pro Teilstrahl wird weiterhin ein GPU-Quad gezeichnet; die vorhandenen Batches werden genutzt. Es gibt keinen zusätzlichen Renderdurchlauf und keine weitere Textur. Gehäuse und Linse werden einmal pro Kopf gezeichnet. Teilstrahl-Lichtflächen verwenden acht statt 24 Schichten. Canvas und der Polygonfallback nutzen dieselbe Geometrie; die charakteristischen Muster sind auch ohne GPU sichtbar.

Die Unterteilung ist pro Kopf begrenzt, nicht durch ein globales Szenenbudget. Sehr große Anlagen mit vielen kombinierten Optiken brauchen eine weitere Qualitätsbegrenzung.

## Messung

Identische Referenzkameraposition, 640×360, 22 Köpfe, zehn Aufwärmframes und 30 Messframes. GPU-Abschluss pro Frame abgewartet. Software-Vulkan, keine Aussage über die reale Grafikkarte oder Full-HD-FPS.

| Backend | Einzelkegel: Median / p95 | Prismen + Gobos: Median / p95 |
|---|---:|---:|
| WebGPU | 27,1 / 35,4 ms | 25,9 / 28,3 ms |
| WebGL | 7,0 / 10,4 ms | 7,1 / 10,2 ms |
| Canvas | 10,0 / 17,2 ms | 10,3 / 18,1 ms |

Der Versuch zeigt keinen großen Mehrbedarf in dieser Szene. Die niedrigere WebGPU-Zeit ist kein belastbarer Geschwindigkeitsgewinn: weniger Oberflächenschichten, kleinere Strahlen und Laufstreuung beeinflussen den Vergleich. Die Optiken ändern absichtlich das Bild und die Geometrie.

## Prüfung und Reproduktion

63 gezielte Tests bestanden: Opt-in-Verhalten, Obergrenze, Eingangsleistung, unveränderte Quelldaten, Drehung, Wandtreffer, getrennte Goboöffnungen, enge Aperturen, Blackout, ein Gehäuse/eine Linse und bestehende Raum-/Bewegungsphysik.

Gesamtsuite: 738 Tests, 735 bestanden. Die drei bereits dokumentierten Fehler bleiben in `rhythm-recovery.test.mjs` und `stage-motion.test.mjs` bestehen. Browserprüfungen bestanden für WebGPU, WebGL und Canvas einschließlich Bildvergleich, Kontextverlust und Freigabe.

```sh
GPU_SYNC=1 STAGE_SCENE_FILE=scripts/fixtures/light-reference-24.json \
SNAPSHOT_PREFIX=/tmp/prism \
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
xvfb-run -a node scripts/check-dmx-stage-gpu.mjs
```

Für die Bodenprojektion `STAGE_SCENE_FILE=scripts/fixtures/light-optics-study.json` verwenden.
