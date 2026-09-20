# DJ-Pult und lokale Songstruktur

Stand: 20.09.2026. Einstieg: `/dj`, verlinkt auf Start- und Musikseite.

Zwei Decks mit unabhängiger Wiedergabe, Cue-Punkten, Seek, Lautstärke,
Drag & Drop und einer umsortierbaren Trackliste. Der lineare Crossfader
überblendet Audio ohne zusätzliche Verstärkung in der Mitte. Lichtbilder werden
mit den aktuellen Deck-Lautstärken gewichtet; pausierte Decks tragen nicht bei.
Beide Decks teilen eine einzige serverseitige Show-Sitzung. Sobald beide pausieren,
wird ihr vorheriger Lampenzustand wiederhergestellt. „Nur Audio“ benötigt keine Lampe.

Metadaten und native Dateiverweise liegen in IndexedDB. Keine Audiodateien werden
von der Bibliotheksfunktion kopiert. Ohne native Handles bleibt die Liste erhalten,
Dateien müssen nach Neuladen erneut ausgewählt werden. Name, Größe und Änderungszeit
verhindern das unbeabsichtigte Wiederverwenden einer Analyse für geänderte Dateien.
Die Analysepläne selbst werden nicht dauerhaft gespeichert.

Beat This! und die vorhandene Klanganalyse liefern zunächst die automatische Show.
All-In-One verfeinert den Songaufbau im Hintergrund. Fertige Ergebnisse ersetzen
nur den Lichtplan; die Deck-Zeit und Audioquelle bleiben unverändert. Zwei Sekunden
Lichtüberblendung verbinden die Pläne an der aktuellen Wiedergabeposition.
Die Struktur steuert Farbgestaltung, nicht die Beat-Zeitpunkte oder Beat-Helligkeit.
Die Musikseite verwendet dieselbe Funktion über ihren neuen Hintergrund-Button;
manuelle Gestaltung hat weiterhin Vorrang.

Geladene Deck-Tracks werden bei der nächsten freien Analyse bevorzugt. Basis- und
Strukturanalysen laufen jeweils seriell; laufende Aufträge werden nicht verdrängt.
Strukturanalyse lässt sich abschalten, während Basis-Show und Audio weiterlaufen.
Serverzugriff bleibt authentifiziert und gegen fremde Web-Ursprünge geschützt.
Temporäres Struktur-Audio wird nach Erfolg, Fehler oder Abbruch entfernt.

## Messungen und Prüfung

- Direkter CPU-Modelltest: rund 263,7 Sekunden Musik, 102,683 Sekunden Inferenz,
  16 Songabschnitte. Separate Python-Umgebung und offline vorhandene Gewichte.
- Echter Chrome-DJ-Test mit zwei Audiodateien und Demo-Lampen: Basis-Show gestartet,
  beide Decks parallel gespielt, Crossfader 50/50, ein Deck pausiert und wieder
  gestartet. Genau eine Lichtsitzung; kein Stop während laufender Musik.
- Das echte All-In-One-Ergebnis wurde im erfolgreichen Lauf bei Deck-Zeit
  114,485 Sekunden übernommen: Audio weiterhin aktiv, 16 geschätzte Abschnitte,
  weiterhin dieselbe Sitzung. Modelllauf etwa 115 Sekunden bei paralleler
  Browser-/Testlast. Das sind Einzelmessungen, keine zugesicherte Laufzeit.
- Anschließend beide Decks gestoppt, Trackliste nach Neuladen wiederhergestellt,
  Dateien erneut verknüpft und ohne doppelte Einträge erneut analysiert.
  Keine Browser-Ausnahmen. Ein vorheriger Wiedergabetest wurde vom Nutzer manuell
  pausiert; der erfolgreiche Durchlauf verwendete stummgeschalteten Testbrowser.
- Musikseite mit verzögerter simulierter Strukturantwort: Abbruch bei laufendem
  Audio, erneuter Auftrag, Austausch des Plans mit aktiver Überblendung, unverändert
  25 Beats und derselben Sitzung. Manuelle Gestaltung und Seek danach geprüft.
- `npm test`: 119 Tests erfolgreich. Enthält Strukturvalidierung, Mischwerte,
  unveränderte Beat-Helligkeit, manuelle Gestaltung, API-Authentifizierung,
  temporäre Dateien, Cache, parallele Anfragen und Abbruch.

- Native Dateiverweise zusätzlich im isolierten Browser geprüft: echten
  `FileSystemFileHandle` in IndexedDB gespeichert, Seite neu geladen, Datei über
  diesen Verweis analysiert und abgespielt. Entfernen blieb nach erneutem Neuladen
  erhalten. Hierfür wurde eine Testdatei im privaten Browser-Dateisystem verwendet;
  der Betriebssystem-Dateiauswahldialog und seine erneute Zugriffsfreigabe wurden
  nicht automatisiert.

Details: `dj-browser-check.json`, `structure-ui-browser-check.json` und
`dj-file-handles-browser-check.json`.

## Grenzen

Keine automatische Beat-Synchronisation, kein separater Kopfhörerausgang und kein
Auto-DJ. Die Trackliste startet das nächste Lied nicht selbst. Abschnittslabels
und musikalische Qualität wurden nicht gegen manuell annotierte Referenzen
bewertet. Dateizugriff nach Browserneustart kann eine erneute Browserfreigabe
benötigen; native Handles setzen passende Browserunterstützung voraus.
All-In-One Inferenzcode: MIT; Harmonix-Gewichte: CC-BY-NC-SA-4.0
(siehe verlinkte Checkpoint-Konfiguration im README).
