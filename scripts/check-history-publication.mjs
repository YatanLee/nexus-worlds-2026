import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {assertFreshPublication, emptyHistory, validateHistory} from '../history.mjs';

const exec=promisify(execFile);
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const path=resolve(root,'data/prediction-history.json');
async function baseHistory(sha) {
  try { const {stdout}=await exec('git',['show',`${sha}:data/prediction-history.json`],{cwd:root,maxBuffer:9*1024*1024}); return JSON.parse(stdout); }
  catch (error) { if (String(error.stderr||'').includes('exists on disk, but not in')) return null; throw error; }
}
export async function main(now=new Date(), env=process.env) {
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')) throw new Error('Missing or invalid GITHUB_SHA');
  const candidate=JSON.parse(await readFile(path,'utf8')); validateHistory(candidate);
  const previous=await baseHistory(env.GITHUB_SHA) || emptyHistory();
  assertFreshPublication(previous,candidate,now);
  return true;
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
