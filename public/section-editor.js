import {createLightEditor} from './light-editor.js';

// DJ adapter: the reusable editor has no dependency on tracks, decks or storage.
export function openSectionEditor({track,plan,position=()=>0,onSave}) {
  const dialog=document.createElement('dialog');dialog.className='section-editor';
  dialog.setAttribute('aria-label','Lichtshow bearbeiten');document.body.append(dialog);
  const opener=document.activeElement;
  const audioSrc=track.file?URL.createObjectURL(track.file):null;
  const editor=createLightEditor(dialog,{title:track.name,plan,edits:track.sectionEdits??undefined,position,audioSrc,
    onClose:()=>dialog.close(),onSave:async edits=>{await onSave(edits);dialog.close();}});
  dialog.addEventListener('close',()=>{editor.destroy();if(audioSrc)URL.revokeObjectURL(audioSrc);dialog.remove();opener?.focus();},{once:true});
  dialog.showModal();return editor;
}
