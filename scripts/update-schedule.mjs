import {refreshSchedule} from '../crawler.mjs';
const result=await refreshSchedule({force:process.argv.includes('--force')});
console.log(JSON.stringify(result));
if(!result.ok)process.exitCode=1;
