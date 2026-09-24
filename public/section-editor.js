import {createLightEditor} from './light-editor.js';

// DJ adapter: the reusable editor has no dependency on tracks, decks or storage.
export function openSectionEditor({track,plan,position=()=>0,onSave,onPreview=()=>{},onBeforePlay=async()=>{},mountPreview=null,onDispose=()=>{},host=null,externalAudio=null,edits=track.sectionEdits}) {
  const dialog=document.createElement(host?'div':'dialog');dialog.className=host?'section-editor-embedded':'section-editor';
  dialog.setAttribute('aria-label','Lichtshow bearbeiten');(host||document.body).append(dialog);
  const opener=document.activeElement;
  const audioSrc=!externalAudio&&track.file?URL.createObjectURL(track.file):null;
  const editor=createLightEditor(dialog,{title:track.name,plan,edits:edits??undefined,position,audioSrc,externalAudio,onPreview,onBeforePlay,
    onClose:()=>{if(!host)dialog.close();cleanup();},onSave:async edits=>{await onSave(edits);if(!host){dialog.close();cleanup();}}});
  const stage=mountPreview?.(editor.previewHost);if(stage)editor.previewHost.hidden=false;
  let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;window.removeEventListener('pagehide',cleanup);const draft=editor.getEdits();editor.destroy();stage?.destroy();onDispose(draft);if(audioSrc)URL.revokeObjectURL(audioSrc);dialog.remove();opener?.focus();};
  dialog.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});
  if(host){for(const button of dialog.querySelectorAll('[data-close]'))button.textContent='Bearbeitung beenden';return {...editor,destroy:cleanup};}
  dialog.showModal();return editor;
}
