from PyInstaller.utils.hooks import collect_all
datas, binaries, hiddenimports = collect_all('librosa')
# Numba's disk cache requires a real source filename, not an entry in PYZ.
module_collection_mode = 'py'
