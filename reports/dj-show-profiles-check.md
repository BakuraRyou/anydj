# DJ-Lichtshow: Automatisch, Party, Disco

20.09.2026. Drei direkt wählbare Interpretationen einer analysierten Show.
Die Originalplanung bleibt pro Track erhalten. Profile verändern Kontrast,
Abklingen und Farbe ausschließlich nach bereits ausgewählten rhythmischen
Ereignissen; sie verändern keine Beat-/Downbeat-Zeitpunkte. Mindest- und
Maximalhelligkeit gelten weiterhin. Ruhige gehaltene Stellen und stille
Passagen erhalten keine künstlichen Farbsprünge. Ein Profilwechsel während
Wiedergabe verwendet den bestehenden Zwei-Sekunden-Übergang.

155 Node-Tests bestanden. Profiltests prüfen unveränderte Zeitpunkte,
Helligkeitslimits, stärkeren Kontrast, keine Mutation der Originalshow sowie
keine erfundenen Farbwechsel bei Stille oder konstanten Flächen.

Browsertest mit simulierten Analyseantworten und echten Audioelementen:
Profilwechsel während Wiedergabe ohne zusätzlichen Analyseaufruf/Unterbrechung;
anschließend zwei automatische Übergänge über drei Queue-Einträge. Beide Listen
sichtbar, Desktop ohne Seitenscrollen, keine Browser-Ausnahmen.

Separater Test mit tatsächlicher Beispiel-MP3 und lokalen Modellen:
- 263,697 Sekunden Audio; 129 Stilfenster.
- 14,885 Sekunden bis zur spielbereiten Basis-Show (einschließlich Browser-
  Decodierung, Beat This!, Stilerkennung und Lichtplanung).
- Profilanwendung auf vorhandene Show: Party 4,1 ms, Disco 2,8 ms.
- Alle Profile behielten dieselben 501 ausgewählten Akzentzeitpunkte.
- Zusätzliche All-In-One-Struktur nicht erneut ausgeführt; vorheriger Messwert
  102,683 Sekunden. Basis-Show kann bereits während dieser Berechnung spielen.

Keine echten Lampen angesteuert. Die Tests belegen Ablauf, Timing und Laufzeit,
nicht die subjektive Qualität oder einen optimalen Lichtablauf für jedes Lied.
Messdaten: `dj-profile-browser-check.json`, `dj-profile-timing-check.json`.
