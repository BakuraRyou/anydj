# Lokale Windows-Buildumgebung

Ziel: vollständige Windows-11-x64- und Linux-x64-Pakete mit gleichem
Funktionsumfang. macOS wird erst mit verfügbarem Mac zum Build-/Testziel.
Ein erstellter Installer allein belegt keine Funktionsgleichheit.

## Einmalig auf dem Ubuntu-Host

KVM ist auf dem untersuchten Host verfügbar, in der Codex-Sandbox jedoch nicht
sichtbar. Falls die VM-Werkzeuge noch fehlen, braucht die folgende Installation lokale
Administratorrechte; das Passwort ausschließlich im eigenen Terminal eingeben:

```sh
sudo apt-get install qemu-system-x86 libvirt-daemon-system libvirt-clients virtinst virt-manager ovmf swtpm swtpm-tools &&
sudo usermod -aG libvirt,kvm "$(id -un)"
```

Unter Ubuntu 26.04 ist `qemu-kvm` ein virtuelles Paket mit mehreren Anbietern;
deshalb wird `qemu-system-x86` ausdrücklich gewählt. Die Verknüpfung mit `&&`
führt die Gruppenzuweisung erst nach erfolgreicher Installation aus.

Danach vollständig vom Desktop ab- und wieder anmelden, damit die Gruppenrechte
wirksam werden. Nur ein neues Terminal in einer bereits laufenden IDE zu öffnen
reicht häufig nicht. `id -nG` zeigt die aktiven Gruppen, `id -nG "$(id -un)"`
dagegen die gespeicherte Zuordnung. Fehlen nur in der ersten Ausgabe `libvirt`
und `kvm`, ist keine erneute Installation oder Gruppenzuweisung nötig.

Für eine vorläufige Prüfung ohne Abmelden im Projektverzeichnis:

```sh
sg libvirt -c 'bash scripts/vm/windows.sh --check'
```

Das aktualisiert nicht die Gruppen der bereits laufenden IDE. Für den weiteren
Ablauf die Desktop-Sitzung neu anmelden. Die Socket-Rechte bleiben unverändert.
Falls das Standardnetz nicht aktiv ist (`virsh -c qemu:///system net-list`):

```sh
sudo virsh -c qemu:///system net-start default
sudo virsh -c qemu:///system net-autostart default
```

Die Windows-11-x64-ISO von [Microsoft](https://www.microsoft.com/software-download/windows11)
herunterladen. Für den ISO-Pfad muss auch libvirt Lesezugriff besitzen; bei
Zugriffsproblemen das Installationsmedium über virt-manager in einem
libvirt-Speicherpool bereitstellen, nicht die Rechte des Home-Verzeichnisses öffnen.

Im Projektverzeichnis:

```sh
bash scripts/vm/windows.sh --check
bash scripts/vm/windows.sh --dry-run /absoluter/pfad/Windows11.iso
bash scripts/vm/windows.sh --create /absoluter/pfad/Windows11.iso
virt-manager --connect qemu:///system
```

Das Skript erstellt ausschließlich eine neue VM `anydj-win11`: 8 GiB RAM,
4 virtuelle CPUs, 128 GiB virtuelle Sparse-Disk, UEFI mit Secure Boot und
Schlüsseln, TPM 2.0, SATA-Disk und emulierte Netzwerkkarte. Der reale
Speicherverbrauch wächst mit den geschriebenen Daten. Die Konsole lauscht nur
auf Loopback. Es werden keine vorhandenen VMs ersetzt oder Projektdateien geteilt.

Windows in der Konsole installieren. Das anfängliche NAT-Netz eignet sich für
Builds und Downloads. Es belegt keine Lampen-Erkennung oder Broadcast-Funktion
im LAN; dafür später die Netzwerkanbindung gezielt testen. USB-DMX und
WLAN-Konfiguration benötigen Zugriff auf passende Hardware, gegebenenfalls
USB-Durchreichung. Eine virtuelle Ethernet-Karte ersetzt keinen WLAN-Adapter.

## Automatisierung nach der Installation

Für automatischen Zugriff einen dedizierten Windows-Buildbenutzer und einen
SSH-Zugang mit Schlüssel einrichten. Keine Passwörter ins Repository kopieren.
Die Gast-IP und den Benutzernamen bereitstellen. Die Projektübertragung soll
nur benötigte Quelldateien enthalten: keine `.env`, FTP-Zugänge, privaten
Audiodateien, vorhandenen Linux-venvs oder `node_modules`. Modelle gezielt
übertragen oder mit den Prüfsummen der Installationsskripte beziehen.

Der bestehende Windows-Build ist noch nicht vollständig einsatzbereit:

| Bereich | Stand / erforderliche Arbeit |
| --- | --- |
| Electron / UI | Gemeinsamer Code, Windows-Paketkonfiguration vorhanden |
| KI-Stilanalyse | `music-style.py` nutzt Essentia-Python; Windows-Anbindung ersetzen und Ergebnisgleichheit prüfen |
| Beat / Struktur | Native Windows-Abhängigkeiten, Modellcache und eingefrorene Programme prüfen |
| Rechner-Audio | `lib/music.mjs` nutzt Linux-`parec`; Windows-Ausgabeerfassung ergänzen |
| WLAN | `lib/connection.mjs` und `lib/recovery.mjs` nutzen `nmcli`; Windows-Anbindung ergänzen |
| DMX | `lib/dmx.mjs` nutzt OLA; native plattformübergreifende Netzwerk-Ausgänge ergänzen |
| Release | Erst mit erfolgreichen KI-, Installations- und Funktionstests als vollständig bereitstellen |

Für „Lichtanlagen allgemein“ sind Art-Net und sACN als gemeinsame
Netzwerk-Protokolle vorgesehen, ergänzend zur vorhandenen WiZ-Anbindung.
USB-DMX bleibt vom jeweiligen Interface und Treiber abhängig. Universelle
Unterstützung beliebiger Lampen oder proprietärer Funkprotokolle wird nicht
behauptet. Direkte Art-Net-/sACN-Ausgabe ist aktuell noch nicht implementiert.

## Prüfstand

Skriptsyntax, Hilfe, Argumentprüfung und trockener Erstellungsbefehl sind lokal
prüfbar. Eine tatsächliche VM-Erstellung, Windows-Installation und Windows-Builds
sind noch nicht erfolgt. Der automatische GitHub-Workflow erzeugt weiterhin
nur Basis-Pakete ohne KI und ist nicht der gewählte lokale VM-Ablauf.

Quellen:
- [Ubuntu: libvirt](https://ubuntu.com/server/docs/how-to/virtualisation/libvirt/)
- [Microsoft: Windows-11-Voraussetzungen](https://learn.microsoft.com/en-us/windows/whats-new/windows-11-requirements)
- [Essentia: Windows-Python-Bindings nicht unterstützt](https://essentia.upf.edu/installing.html)
- [OLA: keine Windows-Portierung](https://www.openlighting.org/ola/getting-started/downloads/)
