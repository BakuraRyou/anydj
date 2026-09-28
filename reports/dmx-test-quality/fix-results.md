# Gemeinsame Show-Regie und ruhige Entwicklung

Die ersten beiden Maßnahmen aus der Ablaufprüfung sind implementiert.

- Bei einer aktiven Show-Figur bestimmt die Show-Regie die Gruppenbelegung. Die zusätzliche allgemeine Abbau-Steuerung darf die Figur nicht mehr durch `finishDark` löschen. Gemessene musikalische Dunkelpausen behalten ihre bisherigen Ausblendungen; explizite leere Show-Bilder bleiben möglich.
- Bereits geplante ruhige Entwicklungen werden als Flow statt als Standbild behandelt. Ihre Gruppenbewegung bekommt 35 % Auslenkung, wenig zusätzliche Artikulation und keine zusätzliche Wandfahrt. Echte Standbilder bleiben erhalten.
- Show-Planversion 56 und Scoreversion 12 sorgen für die Neuberechnung alter Pläne.

## Vergleich mit derselben vollständigen Analyse

Raum und Messmethode wie in der [ursprünglichen Prüfung](review.md), 15 Hz, 48 Moving Heads. Keine neue Audioanalyse für den Vergleich, keine geänderten Raumparameter.

| Passage | Vorher | Nachher |
| --- | --- | --- |
| 25,69–40,01 s | bewusst gehalten | bleibt gehalten |
| 40,01–47,18 s | 5,33 s nahezu still | keine solche Stillstandsphase, ca. 1,97°/s mittlere Bewegung |
| 132,4–134,96 s | Moving Heads 2,6 s dunkel | durchgehend 12 Moving Heads sichtbar |
| 142,10–155,98 s | 6,47 s nahezu still | 1,27 s nahezu still, ca. 1,05°/s mittlere Bewegung |
| 170,75–185,08 s | im Mittel 35,97 aktive Heads, 4,26°/s | gleiche mittlere Anzahl, 4,22°/s |
| 203,2–216 s | Moving Heads dunkel | weiterhin dunkel |

Nahezu still bedeutet unter 0,1°/s mittlere Strahlbewegung bei mindestens vier sichtbaren Heads; sichtbar bedeutet Leistung über 1 %. Symmetrie bleibt bis auf numerische Rundung erhalten.

Ein erster Entwurf bewegte die ruhige Passage 142–156 s zu stark und erzeugte einen kurzen zusätzlichen Ausfall. Die abschließende Begrenzung der ruhigen Auslenkung beseitigt diesen Ausfall im Replay.

933 Tests bestanden, einschließlich Regressionen für konkurrierende Abbau-Steuerung, erkannte Dunkelpausen und erhaltene ruhige Gruppenbewegung. Die audiovisuelle Abnahme bleibt offen. Die Weiterentwicklung wiederkehrender Höhepunkte ist ein separater nächster Schritt.

[Messwerte vorher/nachher](before-after.json)
