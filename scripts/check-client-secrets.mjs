import {readFileSync,readdirSync,existsSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const envFile=join(root,"Backend/.env");
const env=existsSync(envFile)?readFileSync(envFile,"utf8"):"";
const keys=["GEMINI_API_KEY","OPENAI_API_KEY","ALGOLIA_ADMIN_API_KEY","ALGOLIA_SEARCH_API_KEY"];
const secrets=keys.flatMap(key=>{
 const match=env.match(new RegExp("^"+key+"=(.*)$","m"));
 const value=match?.[1]?.trim().replace(/^["']|["']$/g,"");
 return value&&value.length>6?[value]:[];
});
const credential=join(root,"Backend/firebase-service-account.json");
if(existsSync(credential)){
 const account=JSON.parse(readFileSync(credential,"utf8").replace(/^\uFEFF/,""));
 if(account.private_key)secrets.push(account.private_key,account.private_key.split("\n").filter(line=>line&&!line.startsWith("-"))[0]);
}
const files=[];
function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){const target=join(path,entry.name);if(entry.isDirectory())walk(target);else files.push(target);}}
walk(join(root,"Frontend/dist"));
const leaks=files.filter(path=>{const text=readFileSync(path,"utf8");return secrets.some(secret=>secret&&text.includes(secret))||/GEMINI_API_KEY|OPENAI_API_KEY|ALGOLIA_ADMIN_API_KEY|BEGIN PRIVATE KEY/.test(text);}).map(path=>path.replace(root,""));
const example=readFileSync(join(root,"Backend/.env.example"),"utf8");
const nonemptyExamples=keys.filter(key=>new RegExp("^"+key+"=[ \\t]*[^ \\t\\r\\n]+","m").test(example));
console.log(JSON.stringify({checkedFiles:files.length,configuredSecretValues:secrets.length,leaks,nonemptyExamples}));
if(leaks.length||nonemptyExamples.length)process.exitCode=1;
