import {createLightEditor} from './light-editor.js';

// DJ adapter: the reusable editor has no dependency on tracks, decks or storage.
export function openSectionEditor({track,plan,position=()=>0,onSave,onPreview=()=>{},onBeforePlay=async()=>{},mountPreview=null,onDispose=()=>{}}) {
  const dialog=document.createElement('dialog');dialog.className='section-editor';
  dialog.setAttribute('aria-label','Lichtshow bearbeiten');document.body.append(dialog);
  const opener=document.activeElement;
  const audioSrc=track.file?URL.createObjectURL(track.file):null;
  const editor=createLightEditor(dialog,{title:track.name,plan,edits:track.sectionEdits??undefined,position,audioSrc,onPreview,onBeforePlay,
    onClose:()=>dialog.close(),onSave:async edits=>{await onSave(edits);dialog.close();}});
  const stage=mountPreview?.(editor.previewHost);if(stage)editor.previewHost.hidden=false;
  let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;window.removeEventListener('pagehide',cleanup);editor.destroy();stage?.destroy();onDispose();if(audioSrc)URL.revokeObjectURL(audioSrc);dialog.remove();opener?.focus();};
  dialog.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});
  dialog.showModal();return editor;
}
