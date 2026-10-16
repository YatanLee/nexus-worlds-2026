import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const files=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/))];
const patterns=[
  ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['provider-key',/sk-(?:proj-|live_)[A-Za-z0-9_-]{20,}/],
  ['aws-key',/AKIA[A-Z0-9]{16}/],
  ['credential-url',/https?:\/\/[^\s/]+:[^\s/@]+@/]
];
const findings=[];let scanned=0;
for(const file of files) {
  if(/(^|\/)(?:\.cache|\.codex|node_modules)(\/|$)|(^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$|\.log$/i.test(file) && !file.endsWith('.env.example')) {findings.push({file,kind:'private-path'});continue;}
  if(!/\.(?:mjs|json|ya?ml|html|md|css|example)$/.test(file) && !file.endsWith('.gitignore'))continue;
  let data;try {data=await readFile(path.join(root,file),'utf8');} catch(error) {if(error.code==='ENOENT')continue;throw error;}
  scanned++;
  for(const [kind,pattern] of patterns)if(pattern.test(data))findings.push({file,kind});
}
// Never print matched values; this is a bounded pre-publication check, not a guarantee.
console.log(JSON.stringify({scanned,findings}));
if(findings.length)process.exitCode=1;
