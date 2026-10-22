import {transitionOptimizationSearch} from './transition-optimizer.js';
self.onmessage=({data})=>{
 try{
  const search=transitionOptimizationSearch(data);let step,last=0;
  do{step=search.next();if(!step.done&&performance.now()-last>80){last=performance.now();self.postMessage({progress:step.value});}}while(!step.done);
  self.postMessage({plan:step.value});
 }catch(error){self.postMessage({error:error.message});}
};
