// Limit rapid brightness accents without changing slow development or motion.
export const flickerLimit=value=>Number.isFinite(value)?Math.max(0,Math.min(100,value)):100;
export function createFlickerControl(host,onChange){
 const key='anydj-light-flicker';
 let value=100;try{const saved=localStorage.getItem(key);if(saved!==null)value=flickerLimit(Number(saved));}catch{}
 const root=document.createElement('div');root.className='dj-flicker-control';
 root.innerHTML='<label for="djMaxFlicker">Maximales Beat-Flackern <output for="djMaxFlicker"></output></label><input id="djMaxFlicker" class="range" type="range" min="0" max="100" step="1" aria-describedby="djFlickerHelp"><p id="djFlickerHelp" class="small muted">Setzt die Obergrenze für Helligkeitsimpulse im Beat. Schwächere Impulse behalten ihre Abstufungen. 0 %: aus · 100 %: volle Intensität. Aufbauten und gezielte Dunkelphasen bleiben erhalten.</p>';
 const input=root.querySelector('input'),output=root.querySelector('output');
 const draw=()=>{input.value=value;output.textContent=`${value} %`;};
 input.oninput=()=>{value=flickerLimit(Number(input.value));draw();try{localStorage.setItem(key,String(value));}catch{}onChange();};
 draw();host.append(root);
 return {root,get value(){return value;}};
}
