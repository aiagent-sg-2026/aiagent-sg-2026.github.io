import { spawn } from 'node:child_process';
import fs from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile='/srv/agent-workstation/workspaces/bloom-pdf-pages/chrome-pwa005-live2';
fs.rmSync(profile,{recursive:true,force:true});
const chrome=spawn('/usr/bin/google-chrome-stable',[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-debugging-port=9226',`--user-data-dir=${profile}`,'about:blank'
],{stdio:'ignore'});
const cleanup=async()=>{try{chrome.kill('SIGTERM')}catch{};await sleep(250);fs.rmSync(profile,{recursive:true,force:true})};
try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:9226/json/version')).ok)break}catch{}await sleep(200)}
  const page=await (await fetch('http://127.0.0.1:9226/json/new?https://aiagent-sg-2026.github.io/debug/?smoke=2',{method:'PUT'})).json();
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0;const events=[];
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)} else if(m.method==='Runtime.exceptionThrown'||m.method==='Log.entryAdded'||m.method==='Network.loadingFailed') events.push(m)};
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
  const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value};
  await Promise.all([call('Runtime.enable'),call('Log.enable'),call('Network.enable')]);
  let hydrated=false;
  for(let i=0;i<80;i++){
    hydrated=await ev(`(()=>{const x=document.querySelector('input[type=file]'); return !!x && Object.keys(x).some(k=>k.startsWith('__reactProps$')||k.startsWith('__reactFiber$'))})()`);
    if(hydrated)break;
    await sleep(200);
  }
  console.log('hydrated='+hydrated);
  console.log('pre='+JSON.stringify(await ev('({ready:document.readyState,text:document.body.innerText.slice(0,300)})')));
  await ev(`(()=>{window.__w={created:[],messages:[],errors:[]};const N=Worker;window.Worker=class extends N{constructor(u,o){super(u,o);window.__w.created.push(String(u));this.addEventListener('message',e=>window.__w.messages.push(e.data?.type??typeof e.data));this.addEventListener('error',e=>window.__w.errors.push(e.message||'error'))}};return true})()`);
  const pdf=`%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 0 >>
stream

endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000219 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
268
%%EOF
`;
  const dispatch=await ev(`(()=>{const b=new TextEncoder().encode(${JSON.stringify(pdf)}),i=document.querySelector('input[type=file]'),d=new DataTransfer();d.items.add(new File([b],'live-smoke.pdf',{type:'application/pdf'}));i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));return {props:Object.keys(i).filter(k=>k.startsWith('__react')).slice(0,5),files:i.files.length}})()`);
  console.log('dispatch='+JSON.stringify(dispatch));
  let state;
  for(let i=0;i<120;i++){state=await ev(`({parsed:document.body.innerText.includes('Parsed live-smoke.pdf'),text:document.body.innerText.slice(0,500),worker:window.__w})`);if(state.parsed&&state.worker.messages.includes('RESULT')||state.worker.errors.length)break;await sleep(150)}
  console.log(JSON.stringify(state,null,2));
  console.log('events='+JSON.stringify(events.slice(-10),null,2));
  if(!hydrated)throw Error('React did not hydrate');
  if(!state.parsed)throw Error('live PDF parse failed');
  if(state.worker.created.length!==1)throw Error('expected one PDF Worker');
  if(!state.worker.created[0].startsWith('https://aiagent-sg-2026.github.io/_next/static/chunks/'))throw Error('unexpected live worker URL '+state.worker.created[0]);
  if(!state.worker.created[0].endsWith('.js'))throw Error('live worker is not JS');
  if(!state.worker.messages.includes('RESULT'))throw Error('live worker did not return RESULT');
  if(state.worker.errors.length)throw Error(state.worker.errors.join(';'));
  console.log('LIVE_PUBLIC_BROWSER_WORKER_OK');
  ws.close();
}finally{await cleanup()}
