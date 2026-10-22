# Build-Umgebung für Linux, Windows und optional macOS

Einmal einrichten, danach bauen und veröffentlichen:

```sh
npm run init:apps
npm run deploy:apps
```

`init:apps` erzeugt die lokale Konfiguration automatisch. Eine fehlende
`builder/windows-vm.json` muss nicht mehr von Hand angelegt werden.
Die Windows-Installation benötigt eine Windows-11-x64-ISO in englischer Sprache
und deine Bestätigung der Lizenzbedingungen. Der Befehl sucht unter
`.build/vm/media/` und `~/Downloads`; ansonsten fragt er nach dem ISO-Pfad.
Die offizielle ISO gibt es bei [Microsoft](https://www.microsoft.com/en-us/software-download/windows11).
Es wird kein Windows-Lizenzschlüssel gekauft und Windows nicht aktiviert.

## Was init einrichtet

- Neue KVM-VM `anydj-win11`, 8 GiB RAM, 4 CPUs, 128 GiB Sparse-Disk, UEFI,
  Secure Boot, TPM 2.0, SATA und NAT über libvirt `default`.
- Windows 11 Pro über ein unbeaufsichtigtes Installationsmedium mit UDF und
  Boot ohne Tastendruck. Eine vorhandene VM mit fremder UUID wird nicht verändert.
- Lokalen Buildbenutzer ohne Administratorrechte, OpenSSH mit ausschließlich
  Schlüsselanmeldung, Node.js 22.22.1 und Python 3.14.4. Node wird anhand der
  offiziellen Prüfsummen und der Python-Installer anhand seiner Windows-Signatur
  geprüft. Windows-Firewall und NAT bleiben aktiv; SSH lauscht innerhalb der VM.
- Eigene SSH-Client- und Server-Schlüssel unter `.build/vm/ssh/`. Der Gast erhält
  den vorbereiteten Server-Schlüssel; `known_hosts` wird damit aus vertrauenswürdiger
  lokaler Quelle geschrieben. Unbekannte SSH-Schlüssel werden nicht akzeptiert.
- Drei native Python-Analyseumgebungen, PyInstaller und lokale Modellgewichte auf
  Windows sowie die Linux-Buildumgebung. Modell-Downloads erfolgen beim init;
  die normale App führt ihre Analyse ohne Downloads aus.
- Automatische Ermittlung der Gast-IP aus der libvirt-DHCP-Lease. Die Verbindung
  wird lokal in `builder/windows-vm.json` gespeichert; diese Datei ist in Git ausgeschlossen.

Windows lädt während der Einrichtung seine OpenSSH-Komponente und die
Build-Werkzeuge. Internetzugang ist dafür nötig. `init` wartet bis zu 60 Minuten
auf Installation und SSH; der Fortschritt ist in `virt-manager` sichtbar.
Danach werden die nativen Analysebibliotheken installiert und importiert.
Nur ein erfolgreicher Abschluss setzt den lokalen Bereitschaftsstatus.
Ein abgebrochener Lauf lässt sich mit demselben Befehl fortsetzen.

```sh
npm run init:apps -- --iso /pfad/Windows11-English.iso --iso-sha256 SHA256
npm run init:apps -- --check         # Host prüfen, keine Installation
npm run init:apps -- --prepare-only  # Nur Konfiguration und Schlüssel erzeugen
npm run init:apps -- --skip-linux    # Linux separat vorbereiten
```

`--accept-windows-license` dient unbeaufsichtigten Aufrufen, nachdem du die
Windows-Lizenzbedingungen bestätigt hast. Das Installationsmedium enthält ein
zufälliges Passwort für die einmalige automatische Anmeldung und den privaten
Gast-SSH-Schlüssel. `.build/vm/` hat deshalb eingeschränkte Zugriffsrechte und
gehört nicht in Git oder in eine öffentliche Ablage. Die Installation schreibt
`C:\AnyDjInit\bootstrap.log`, bei Fehlern zusätzlich `bootstrap-error.txt`.

## Host-Voraussetzungen

Ubuntu/Linux x64 mit KVM, Node.js 22+, libvirt, virt-install, 7-Zip,
genisoimage, OpenSSH und Python mit venv. Auf diesem Host waren KVM, VM-Werkzeuge
und das libvirt-Netz bereits vorhanden. Fehlende VM-Werkzeuge installiert `init` über Ubuntu-Pakete und `sudo`; dafür
kann eine Passworteingabe im eigenen Terminal nötig sein. Falls Gruppenrechte
noch fehlen, diese einmalig ergänzen. Die entsprechenden Befehle sind:

```sh
sudo apt-get install qemu-system-x86 libvirt-daemon-system libvirt-clients virtinst virt-manager ovmf swtpm swtpm-tools genisoimage 7zip openssh-client python3-venv
sudo usermod -aG libvirt,kvm "$(id -un)"
```

Nach einer Gruppenzuweisung vollständig ab- und wieder anmelden. Eine bereits
laufende IDE übernimmt die neuen Gruppen nicht automatisch. Für die vorläufige
Prüfung: `sg libvirt -c 'npm run init:apps -- --check'`.
Das libvirt-Netz `default` muss aktiv sein. Keine vorhandenen Hostdatenträger
werden formatiert; die Windows-Partitionierung betrifft ausschließlich den neuen
virtuellen Datenträger dieser VM. Hardware-DMX, WLAN und LAN-Broadcast-Erkennung
brauchen gesonderte Funktionstests; ein NAT-Buildgast belegt diese Funktionen nicht.

## Ein Befehl für Linux, Windows-VM und Upload

```sh
npm run deploy:apps
npm run deploy:apps -- --reuse-analysis
npm run deploy:apps -- --dry-run
```

1. Linux-App inklusive KI bauen und mit Website und Downloadseite über das
   vorhandene FTPS-Deployment veröffentlichen.
2. Windows-VM bei Bedarf starten, auf SSH warten und die ausgewählten App-Quellen
   in ein neues Gast-Arbeitsverzeichnis übertragen. Private Hostdaten, `.env`,
   `.aws`, Host-Modelle, Linux-venvs und `node_modules` werden nicht übertragen.
3. Native Build-Abhängigkeiten prüfen, `npm ci` und den vollständigen Windows-Build
   ausführen. Fehler erscheinen im Terminal und in `.build/deploy-apps-logs/`;
   sie führen zu Exitcode 1. Es gibt keinen Lite-Fallback.
4. Installer zurückholen und Manifest, Version, Größe und SHA-256 prüfen.
   Eine eigens gestartete VM auch bei Fehlern herunterfahren. Eine bereits
   laufende VM bleibt an. Bei verweigertem Herunterfahren erscheint ein Fehler;
   die VM wird nicht gewaltsam ausgeschaltet.
5. Optional den konfigurierten Mac-Build ausführen und prüfen, anschließend alle
   bereitgestellten Installer gemeinsam veröffentlichen.

`--dry-run` führt Builds und VM-Zugriffe aus, aber keinen FTPS-Upload.
`--reuse-analysis` benötigt passende KI-Pakete auf beiden Buildsystemen und darf
nach Änderungen an Analysecode, Bibliotheken oder Modellen nicht verwendet werden.
`--config /pfad/ftp.json` wählt die FTPS-Konfiguration;
`--vm-config /pfad/windows.json` einen alternativ eingerichteten Windows-Gast.
FTP-Zugangsdaten bleiben auf dem Linux-Host. Ein Windows- oder Mac-Fehler nimmt
bereits erfolgte Linux-Uploads nicht zurück.

Erfolgreiche Gast-Builds werden nach dem Zurückholen bereinigt; zuvor werden
die Junctions zu den gemeinsamen Umgebungen entfernt. Fehlgeschlagene
Arbeitsverzeichnisse unter `C:/AnyDjBuild/jobs` bleiben zur Fehleranalyse
liegen und müssen gelegentlich bereinigt werden. Dortige Junctions führen zu
geteilten Modellen und venvs: nur die Junctions entfernen, nicht ihre Ziele.
Eine Sperre `.build/deploy-apps.lock` verhindert parallele Deploy-Aufrufe.
Während des Ablaufs die App-Quellen nicht bearbeiten, damit die Builds passen.

## Optionaler Mac

macOS-Pakete werden nativ auf einem eigenen oder gemieteten Apple-Rechner gebaut.
Apples Lizenz erlaubt macOS-VMs für Entwicklung und Tests auf Apple-Hardware;
es wird hier keine macOS-VM auf dem Linux-PC eingerichtet.
[Apple-Lizenz](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf).

Wenn später ein Mac verfügbar ist: Node.js 22+, Python 3.14 samt venv und einen
SSH-Buildbenutzer bereitstellen, dessen Hostschlüssel nach Prüfung in
`known_hosts` aufnehmen. `builder/mac-build.example.json` nach `mac-build.json`
kopieren und den tatsächlichen Zugang eintragen. Anschließend:

```sh
npm run init:apps -- --mac-only
npm run deploy:apps
```

Der Mac wird über SSH angesprochen und bleibt eingeschaltet. `init --mac-only`
installiert die Python-Analyseumgebungen und Modelle auf diesem Mac. Der normale
Deploy erstellt und prüft eine DMG für die native Architektur (Intel x64 oder
Apple Silicon arm64). Beide Architekturen werden separat bereitgestellt und
können auf der Downloadseite nebeneinander erscheinen. Es entstehen keine
Universal-Binärdateien. Signing und Notarisierung sind noch nicht eingerichtet;
Mac-Builds ohne konfigurierten Signierschlüssel sind unsigniert.
Ohne `mac-build.json` baut `deploy:apps` ausschließlich Linux und Windows.
Ein echter Mac-Build und Mac-Laufzeittest stehen noch aus.

## Stilanalyse auf allen Plattformen

Die MusiCNN-Vorverarbeitung verwendet jetzt NumPy/SciPy anstelle der
Linux-Essentia-Python-Bindings. Das lokale Discogs-EffNet-Modell und die
Ergebnisstruktur bleiben gleich. Die portable Vorverarbeitung wurde lokal gegen
Essentia und Modellwerte auf synthetischen Signalen und einer Musikprobe geprüft;
auch ein eingefrorenes Analyseprogramm wurde ohne Python im Suchpfad gestartet.
Der Bericht liegt unter `reports/build-frontend-parity.json`.
Ein neuer KI-Build ist nach dieser Änderung nötig.

Quellen zur Einrichtung:
- [Microsoft: OpenSSH unter Windows](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)
- [Microsoft: unbeaufsichtigte Image-Auswahl](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-setup-imageinstall-osimage-installfrom-metadata)
- [Essentia: MusiCNN-Eingaben](https://essentia.upf.edu/reference/std_TensorflowInputMusiCNN.html)
