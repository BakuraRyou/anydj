# Dynamische Moving Heads in intensiven Passagen

23. September 2026 · Bewegungsspur-Version 6.

Die zuletzt eingeführte Auswahl einzelner räumlicher Gesten war in kräftigen,
gleichbleibenden Grooves zu streng: Die meisten ausgewählten Musikakzente lagen
unter der Schwelle eines außergewöhnlichen Einzelakzents. Feste Bewegungsabstände
verstärkten den Eindruck vereinzelter, zeitgesteuerter Schwenker.

In der automatischen und energiegeladenen Gestaltung erhalten intensive,
rhythmisch belegte Passagen deshalb einen eigenen Bewegungsverlauf. Er benötigt
hohe gemessene Energie, rhythmische Aktivität und einen hinreichend starken
bereits ausgewählten Lichtakzent. Ein Abschnittslabel allein genügt nicht.

- Bewegungsziele liegen auf den ausgewählten musikalischen Akzenten. Das
  tatsächliche Beat-Raster bestimmt die Phase, keine Sekunden-Uhr.
- Akzentstärke und Energie bestimmen die Weite; Instrumentenverhältnisse gewichten
  äußere und innere Köpfe. Die Köpfe bleiben paarweise koordiniert.
- In dichten Grooves nutzen Fahrten das verfügbare Intervall zwischen den Zielen.
  Die bisherigen mehrsekündigen Abstandsregeln greifen dort nicht. Längere
  Lücken werden weiterhin gehalten; maximaler Vorlauf bleibt begrenzt.
- Wegstrecken werden bei zu kurzen Intervallen verkleinert, sodass die bestehenden
  Geschwindigkeits- und Positionsgrenzen gelten.
- Ruhige bzw. atmosphärische Profile und Breaks behalten die sparsame Auswahl.
  Explizite Bewegungsmodi bleiben erhalten. Farben und Dimmerkurven werden durch
  diese Änderung nicht neu berechnet.

Vergleich mit der bereits vorhandenen vollständigen Analyse von
RobbieWilliamsBoddies.mp3, Profil „Ausgewogen“:

| Abschnitt | Ziele vorher | Ziele nachher | Anteil bewegter Samples vorher / nachher |
| --- | ---: | ---: | ---: |
| 31,13–46,49 s | 1 | 34 | 4 % / 87 % |
| 69,53–84,89 s | 1 | 34 | 4 % / 100 % |
| 184,73–200,09 s, ruhig | 2 | 2 | 2 % / 21 % |

Die Ruhepassage erhält keine Groove-Bewegungen. Ihre Fahrtdauer verändert sich,
weil die Köpfe aus einer anderen Position der vorausgehenden Passage kommen.
Die Messung verwendet vorbereitete Spuren und 20-ms-Abtastung, keine echten
Motoren. Die sichtbare Wirkung an physischen Geräten bleibt vor Ort zu beurteilen.
Details: [Messwerte](intense-moving-groove.json).

`npm test`: 402 Tests erfolgreich. Neue Regressionen prüfen dichte Grooves,
unregelmäßige tatsächliche Akzentzeiten, Einfluss der Schlagstärke, Rückkehr zu
Haltephasen, ruhige Profile und Geschwindigkeitsgrenzen. Manuelle Stile sowie
reproduzierbare Vor-/Rücksprünge bleiben abgesichert.

Moving-Head-Browserprüfung bestanden: Aktivierung, Animation, Licht, Blackout,
Pause, Speicherung, reduzierte Bewegung und responsive Darstellung. Die Prüfung
steuert keine echten DMX-Geräte. Ihr Reload-Warten toleriert jetzt den erwarteten
kurzen Wechsel des Browser-Ausführungskontexts.

Zum Ausprobieren die DJ-Seite neu laden. Bewegungsspuren werden für die aktuelle
Sitzung neu vorbereitet; eine neue Songanalyse ist für aktuelle Shows nicht nötig.
