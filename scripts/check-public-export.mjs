import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowed=new Set(JSON.parse(fs.readFileSync(path.join(root,'public-manifest.json'),'utf8')).files);
const files=[];const problems=[];
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.name==='.git'||entry.name==='node_modules')continue;
  const target=path.join(dir,entry.name);const rel=path.relative(root,target).replaceAll('\\','/');
  if(entry.isSymbolicLink()){problems.push(`${rel}: symbolic link is not permitted`);continue;}
  if(entry.isDirectory())walk(target);else files.push(rel);
 }
}
walk(root);
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['provider-token',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{12,}|AIza[A-Za-z0-9_-]{30,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{25,})\b/],
 ['service-account',/"type"\s*:\s*"service_account"/],
 ['account-identifier',/\b(?:U|C|T)[A-Z0-9]{8,12}\b/],
 ['credential-url',/https?:\/\/[^\s/@:]+:[^\s/@]+@/],
];
for(const rel of files){
 if(!allowed.has(rel))problems.push(`${rel}: outside public manifest`);
 const data=fs.readFileSync(path.join(root,rel));
 if(data.includes(0)){problems.push(`${rel}: binary file`);continue;}
 const text=data.toString('utf8');
 for(const [rule,pattern] of patterns)if(pattern.test(text))problems.push(`${rel}: ${rule}`);
 for(const address of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)||[])
  if(!/@(?:example\.(?:com|org|net)|[^@]*\.invalid)$/.test(address))problems.push(`${rel}: non-example email`);
}
for(const rel of allowed)if(!files.includes(rel))problems.push(`${rel}: missing manifest file`);
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log(`Public manifest and content checks passed (${files.length} text files).`);
