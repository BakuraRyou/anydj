# Mehrere gespeicherte Warteschlangen

Umgesetzt: benannte Listen anlegen, umbenennen, speichern, auswählen und löschen;
aktuelle Warteschlange als Vorlage sichern; parallele Vorbereitung während
laufender Wiedergabe. Start übernimmt eine unabhängige Kopie, sodass gespeicherte
Listen nicht durch die Wiedergabe geleert werden. Die bisherige Warteschlange
bleibt erhalten. Speicherung lokal in IndexedDB, ohne Audiodateien oder Cloud.

Erfolgreich geprüft:
- 252 automatisierte Tests.
- Neuer Browser-Test mit Audio: bestehende Queue speichern, zweite Liste
  vorbereiten, hinzufügen/entfernen/umsortieren ohne Änderung der Live-Queue,
  automatischer Crossfade trotz geöffnetem Vorbereitungsbereich, intakte
  gespeicherte Vorlage, Neuladen ohne Autostart, Löschen und mobile Breite.
- Bestehender Queue-Test: drei Titel, zwei automatische Crossfades, Abschluss,
  Umsortieren, Entfernen und Wiederherstellung.
- Web-Build, JavaScript-Syntax und Diff-Prüfung erfolgreich.
- [Ansicht während laufender Wiedergabe](dj-queue-lists.png).

Der ältere Layouttest wurde an die bereits eingeführte vertikal scrollbar
gewordene DJ-Oberfläche und die untereinander angeordneten mobilen Listen
angepasst. Horizontale Überläufe und nutzbare Listenhöhen werden weiterhin geprüft.
