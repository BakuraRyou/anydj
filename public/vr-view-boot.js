// Keep startup errors visible even if a transitive module fails to load.
(() => {
  const status=document.querySelector('#connection'),retry=document.querySelector('#recheck');
  retry.onclick=()=>location.reload();
  import('./vr-view.js').catch(error=>{
    status.textContent='Die VR-Vorschau konnte nicht geladen werden. Bitte den AnyDj-Server aktualisieren bzw. neu starten und „Erneut laden“ wählen. Details: '+(error.message||String(error));
    retry.textContent='Erneut laden';
    retry.onclick=()=>location.reload();
  });
})();
