# Abgleich mit den tatsächlich erfolgreichen Einrichtungsabläufen

Am 20.09.2026 wurden die gespeicherten Werkzeugaufrufe und Ergebnisse des
Projektverlaufs vom 19.09.2026 ausgewertet, nicht nur dessen Zusammenfassungen.
Zugangsdaten sind in diesem Bericht nicht enthalten.

## Erfolgreicher Ablauf um 17:04 UTC

Der direkte Einrichtungsversuch verwendete `hid=0`, las die Pairing-Antwort
vollständig und prüfte sowohl `192.168.56.1/device` als auch die bereits bekannte
Heimnetz-IP `192.168.178.53/device`. Nach Status 5 folgten zwei Sekunden Wartezeit
und `/complete` ausdrücklich an der Heimnetz-IP. Auch diese Antwort wurde
vollständig gelesen. Anschließend wurde UDP bestätigt.

Schlüsselableitung, `hid=0` und vollständiges Lesen der Antworten waren bereits
im Code übernommen. Folgende Unterschiede bestanden weiterhin:

- Die Automatik kannte die gespeicherte Heimnetz-IP nicht, solange die aktuelle
  AP-Statusabfrage sie nicht erneut mit Status 5 geliefert hatte.
- Solange der AP antwortete, bevorzugte der Einrichtungsabschluss weiterhin ihn.
- Ohne UDP-Antwort und ohne sichtbaren AP prüfte der Server nicht, ob die
  HTTP-Einrichtung bereits auf der bekannten Heimnetz-IP fortgesetzt werden konnte.

## Erfolgreicher Ablauf um 23:32 UTC

Nach einem erfolglosen automatischen Versuch wurden die Heim-WLAN-Daten separat
mit einem temporären NetworkManager-Profil bestätigt. Danach wurde eine neue
AP-Verbindung angelegt und ein frischer SetupClient verwendet. Der Werkzeuglauf
meldete HTTP 200, eine leere vollständig gelesene Pairing-Antwort, Status 1,
Status 5 und den Abschluss unter `192.168.178.53`. Der nächste App-Aufruf meldete
`ready`. Der automatische Wiederholungsversuch nutzte dagegen bislang die
bestehende AP-Verbindung weiter.

## Übernommene Korrekturen

- Gespeicherte Heimnetz-IP als Kandidat für Statusabfragen weitergeben.
- Nach bestätigtem Beitritt bevorzugt Heimnetz-IP für Identitätsprüfung und
  Abschluss verwenden; AP bleibt als Ausweichadresse verfügbar.
- Zwei Sekunden zwischen bestätigtem Beitritt und Abschluss warten.
- Bereits im Heimnetz erreichbare Einrichtung bei fehlendem UDP automatisch
  abschließen. Keine erneute Zugangsdatenübertragung oder WLAN-Umschaltung dafür.
- Vor einem begründeten Pairing-Wiederholungsversuch AP-Verbindung neu aufbauen
  und Identität sowie Status erneut prüfen. Ein fremdes Gerät erhält keinen Auftrag.
- Pro neuem Durchlauf den kurzlebigen Clientzustand zurücksetzen; das persistente
  Journal bleibt für unklare frühere Übertragungen maßgeblich.

## Prüfung und verbleibende Grenze

`npm test`: 180 Tests bestanden. Neue Regressionen prüfen den Verlust der
AP-Antwort vor Status 5, Abschluss bei weiter erreichbarem AP, frische Verbindung
mit erneuter MAC-Prüfung sowie Fortsetzung über HTTP ohne AP und ohne UDP.

Der laufende Entwicklungsserver hat die Änderungen geladen. Die echte Lampe
war beim aktuellen WLAN-Scan nicht sichtbar. Ein erneuter erfolgreicher
physischer Einrichtungs- oder Stromzyklus ist daher weiterhin nicht belegt.
Die gefundenen Abweichungen sind konkrete Fehlerpfade; welcher davon den letzten
Ausfall ausgelöst hat, ist ohne erneuten Hardwarelauf nicht eindeutig bewiesen.

## Weitere Prüfung der aktuellen Nichterreichbarkeit

Ein direkter Verbindungsversuch zum bekannten SSID wurde anschließend vom
automatischen App-Versuch übernommen. Dieser scheiterte laut NetworkManager am
20.09.2026 um 12:46:26 Ortszeit beim WLAN-Verbindungsaufbau mit `ssid-not-found`,
also vor der Übertragung von Zugangsdaten. Der WLAN-Adapter war eingeschaltet
und weder per Software noch Hardware gesperrt. Die Ursache der fehlenden
Erreichbarkeit der Lampe ist damit noch nicht bestimmt.

Die App unterscheidet nun einen fehlgeschlagenen WLAN-Scan von einem erfolgreichen
Scan ohne Lampen-WLAN. Fehler der Wiederherstellung enthalten die fehlgeschlagene
Phase und den Zeitpunkt des nächsten Versuchs. Der WLAN-Scan verwendet die
konfigurierte Schnittstelle. Vollständige Testsuite vor der letzten Ergänzung:
183 Tests bestanden; danach alle 18 betroffenen Diagnose-/Recoverytests bestanden.
