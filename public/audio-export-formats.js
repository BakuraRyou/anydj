export const AUDIO_EXPORT_FORMATS=Object.freeze([
 {id:'mp3',label:'MP3',extension:'mp3',mime:'audio/mpeg',description:'Kleine Datei · 192 oder 320 kbit/s'},
 {id:'wav',label:'WAV',extension:'wav',mime:'audio/wav',description:'Unkomprimiert · 16 Bit / 44,1 kHz'},
 {id:'flac',label:'FLAC',extension:'flac',mime:'audio/flac',description:'Verlustfrei komprimiert · 16 Bit / 44,1 kHz'},
]);
export function audioExportFormat(id='mp3'){
 const format=AUDIO_EXPORT_FORMATS.find(f=>f.id===id);
 if(!format)throw Error('Unbekanntes Audioformat.');return format;
}
