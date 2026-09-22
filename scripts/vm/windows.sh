#!/usr/bin/env bash
# Creates a new local build VM only when --create is explicitly supplied.
set -euo pipefail
usage() {
  cat <<'HELP'
AnyDj Windows-11-Build-VM (Ubuntu/KVM)
  bash scripts/vm/windows.sh --check
  bash scripts/vm/windows.sh --dry-run /absolute/path/Windows11.iso
  bash scripts/vm/windows.sh --create /absolute/path/Windows11.iso

--check prüft nur die lokalen Voraussetzungen.
--dry-run zeigt den Erstellungsbefehl; keine VM und keine Datenträger werden angelegt.
--create erstellt eine neue VM anydj-win11 (8 GiB RAM, 4 CPUs, 128 GiB Sparse-Disk).
Eine vorhandene VM wird niemals ersetzt. Windows wird anschließend in virt-manager installiert.
HELP
}
mode=${1:---help}
case "$mode" in
  --help) usage; exit 0 ;;
  --check) [[ $# -eq 1 ]] || { usage; exit 2; } ;;
  --dry-run|--create) [[ $# -eq 2 ]] || { usage; exit 2; } ;;
  *) usage; exit 2 ;;
esac
if [[ "$mode" != --check ]]; then
  iso=$(realpath -- "$2")
  [[ -f "$iso" && -r "$iso" && "$iso" == *.iso ]] || { echo 'Lesbare Windows-11-x64-ISO-Datei erforderlich.' >&2; exit 1; }
  command=(virt-install --connect qemu:///system --name anydj-win11
    --memory 8192 --vcpus 4 --cpu host-passthrough --virt-type kvm --machine q35
    --osinfo win11
    --boot 'uefi,firmware.feature0.name=secure-boot,firmware.feature0.enabled=yes,firmware.feature1.name=enrolled-keys,firmware.feature1.enabled=yes'
    --tpm backend.type=emulator,backend.version=2.0,model=tpm-crb
    --disk size=128,format=qcow2,bus=sata
    --cdrom "$iso" --network network=default,model=e1000e
    --graphics spice,listen=127.0.0.1 --video vga --noautoconsole)
  if [[ "$mode" == --dry-run ]]; then printf '%q ' "${command[@]}"; printf '\n'; exit 0; fi
fi
missing=0
for executable in virsh virt-install qemu-system-x86_64 swtpm virt-manager; do
  if ! command -v "$executable" >/dev/null; then echo "Fehlt: $executable" >&2; missing=1; fi
done
if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then echo '/dev/kvm fehlt oder ist für diesen Benutzer nicht les-/schreibbar.' >&2; missing=1; fi
if ((missing)); then
  echo 'Einrichtung siehe desktop/windows-vm.md. Dieses Skript installiert keine Systempakete.' >&2
  exit 1
fi
# Do not confuse lack of access to libvirt with a VM that does not exist.
if ! names=$(virsh --connect qemu:///system list --all --name); then
  cat >&2 <<'HINT'
Kein Zugriff auf libvirt (qemu:///system).
Bei „Keine Berechtigung“: id -nG zeigt die Gruppen der laufenden Sitzung.
Nach der Gruppenzuweisung vollständig vom Desktop ab- und wieder anmelden;
ein neues Terminal in derselben IDE übernimmt häufig noch die alten Gruppen.
Für eine Prüfung ohne Abmelden im Projektverzeichnis:
  sg libvirt -c 'bash scripts/vm/windows.sh --check'
Weitere Einrichtungshinweise: desktop/windows-vm.md
HINT
  exit 1
fi
if [[ "$mode" == --check ]]; then echo 'KVM und VM-Werkzeuge erreichbar. Noch kein Windows- oder KI-Funktionstest.'; exit 0; fi
if [[ $'\n'"$names"$'\n' == *$'\nanydj-win11\n'* ]]; then
  echo 'anydj-win11 existiert bereits. In virt-manager öffnen; keine Änderungen vorgenommen.' >&2
  exit 1
fi
networks=$(virsh --connect qemu:///system net-list --name)
if [[ $'\n'"$networks"$'\n' != *$'\ndefault\n'* ]]; then
  echo 'Das libvirt-Netz default ist nicht aktiv. Siehe desktop/windows-vm.md.' >&2
  exit 1
fi
"${command[@]}"
echo 'VM angelegt. In virt-manager Windows installieren. Noch kein vollständiger AnyDj-Windows-Build.'
