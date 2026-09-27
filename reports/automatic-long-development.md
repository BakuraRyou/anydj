# Automatik: Entwicklung bei gleichförmiger Musik

## Verhalten

Aktive, bislang zusammengefasste Passagen über 36 Sekunden bekommen bei der
Analyse mehrere Entwicklungsabschnitte. Geeignete Phrasengrenzen und
Arrangement-Ereignisse werden bevorzugt. Ohne passende Ereignisse entstehen
langsamer überblendete Abschnitte; ihre Dauer hängt von Energie, Antrieb und
Position innerhalb des Verlaufs ab. Es gibt keinen festen Vier-Takt-Zähler.

Die Formauswahl berücksichtigt die bisher geplante Einsatzdauer innerhalb der
letzten 72 Songsekunden. Unmittelbare Wiederholung und lange Dominanz erhalten
weniger Gewicht. Wiederkehrende Motive bleiben erkennbar, haben aber keinen
unbegrenzten Vorrang mehr. Diese Historie ist eine Analyse der geplanten Show,
keine Messung tatsächlich gerenderter Sichtbarkeit oder der Nutzungsdauer.

Innerhalb der Entwicklungsabschnitte übergeben Reihen langsam den größeren
Bewegungsumfang aneinander. Die Paare behalten ihre gemeinsame Phase; die
Übergabe verändert keine Dimmerwerte. Verschiedene Formationen können weiterhin
unterschiedliche Belegungsmuster besitzen. Neue Entwicklungsabschnitte verwenden
regulär drei Sekunden Überblendung, begrenzt durch die Länge ihrer Nachbarn.

Stille und gehaltene Passagen erhalten keine zusätzliche Entwicklung. Manuelle
Bewegungshalte frieren auch über Entwicklungsgrenzen hinweg denselben Zustand
 ein. Die bestehenden Raum- und Zonenregeln bleiben wirksam.

## Prüfung

857 Tests erfolgreich. Neue Regressionen prüfen:

- mehrere Formen trotz gleichbleibender musikalischer Merkmale;
- bevorzugte Phrasengrenzen und unterschiedliche Verweildauern;
- deterministische Ergebnisse nach Speichern und Springen im Lied;
- kontinuierliche Übergänge und gespiegelte Paare;
- Gruppenübergaben ohne zusätzliche Helligkeitsänderung;
- keine Unterteilung echter Ruhepassagen.

Ein synthetischer Zwei-Minuten-Abschnitt entwickelt sich beispielsweise über
Paarfigur → wandernde Gruppe → Paarfigur → Frage/Antwort → Paarfigur → wandernde
Gruppe. Die Grenzen liegen bei 13, 31, 46, 68 und 91 Sekunden und folgen den
vorgegebenen Phrasen. Das ist ein Verhaltenstest, keine musikalische oder
visuelle Abnahme eines echten Songs.

Die vorhandenen vollständigen Analysen von „This Feeling“ und „Shades“ haben
keine zusammenhängenden aktiven Passagen über 36 Sekunden. Bei diesen beiden
Songs entstehen daher keine zusätzlichen Unterteilungen; die neue Gewichtung
wiederkehrender Formen gilt trotzdem.

Bewegungsplan-Version 7, Show-Cache-Version 42. Die Geometrie wird im bestehenden
Renderer ausgewertet; es kommen keine zusätzlichen Lichtquellen oder Shader hinzu.
