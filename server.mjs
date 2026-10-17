import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readSnapshot,readStatus,refreshSchedule} from './crawler.mjs';
import {readPublicHistory,readHistoryStatus,syncPublicHistory} from './history-sync.mjs';
import {evaluationsView} from './history.mjs';
import {modelHealth} from './health.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT||4196);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
const publicFiles=new Set(['/','/index.html','/app.mjs','/data.mjs','/model.mjs','/schedule.mjs','/history-ui.mjs','/health-ui.mjs','/freshness.mjs','/journal.mjs','/journal-ui.mjs','/journal-draft.mjs','/mystic.mjs','/mystic-data.mjs','/mystic-ui.mjs','/styles.css','/tokens.css','/favicon.svg','/assets/worlds-hero.webp']);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
const server=http.createServer(async(req,res)=>{
  const send=(status,type,body)=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);};
  if(!['GET','HEAD'].includes(req.method))return send(405,'text/plain','Method not allowed');
  try {
    const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
    if(url.search)return send(404,'text/plain','Not found');
    if(pathname==='/api/schedule')return send(200,'application/json; charset=utf-8',JSON.stringify(await readSnapshot()));
    if(pathname==='/api/status')return send(200,'application/json; charset=utf-8',JSON.stringify(await readStatus()));
    if(pathname==='/api/predictions') {const h=await readPublicHistory();return send(200,'application/json; charset=utf-8',JSON.stringify({schemaVersion:1,updatedAt:h.updatedAt,baselines:h.baselines}));}
    if(pathname==='/api/evaluations') {const [h,s,status]=await Promise.all([readPublicHistory(),readSnapshot(),readHistoryStatus()]);return send(200,'application/json; charset=utf-8',JSON.stringify({...evaluationsView(h,s),syncStatus:status}));}
    if(pathname==='/api/model-health') {const [h,s]=await Promise.all([readPublicHistory(),readSnapshot()]);return send(200,'application/json; charset=utf-8',JSON.stringify(modelHealth(h,s)));}
    if(!publicFiles.has(pathname))return send(404,'text/plain','Not found');
    const file=pathname==='/'?'index.html':pathname.slice(1);
    send(200,mime[path.extname(file)],await readFile(path.join(root,file)));
  } catch {send(404,'text/plain','Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`NEXUS ready: http://127.0.0.1:${server.address().port}/`));
if(process.env.NEXUS_DISABLE_CRAWLER!=='1') {
  const update=()=>refreshSchedule().then(r=>{if(!r.skipped)console.log(r.ok?`Schedule refreshed: ${r.count} matches`:'Schedule refresh failed; last good snapshot retained.');}).catch(()=>console.log('Schedule refresh unavailable; last good snapshot retained.'));
  update();const timer=setInterval(update,60000);timer.unref();server.on('close',()=>clearInterval(timer));
  const sync=()=>syncPublicHistory().catch(()=>{});sync();const historyTimer=setInterval(sync,3600000);historyTimer.unref();server.on('close',()=>clearInterval(historyTimer));
}
