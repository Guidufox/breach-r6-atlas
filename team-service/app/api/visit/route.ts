import { env } from 'cloudflare:workers';
const origin='https://guidufox.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store','Vary':'Origin'};
export async function OPTIONS(){return new Response(null,{status:204,headers});}
export async function POST(request:Request){
 if(request.headers.get('Origin')!==origin)return new Response(null,{status:403,headers});
 const raw=await request.text();if(raw.length>300)return new Response(null,{status:413,headers});
 try{const input=JSON.parse(raw);if(!/^\/breach-r6-atlas\/(?:mapas\/(?:[a-z]+\/)?|legal\.html)?$/.test(input.path)||!['es','en','pt-br'].includes(input.language))return new Response(null,{status:400,headers});
 const db=env.DB;if(!db)return new Response(null,{status:503,headers});
 const day=new Date().toISOString().slice(0,10),key=day+'|'+input.path+'|'+input.language;
 await db.prepare('INSERT INTO visits (key,day,path,language,count) VALUES (?,?,?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key,day,input.path,input.language).run();
 return new Response(null,{status:204,headers});}catch{return new Response(null,{status:400,headers});}
}

export async function GET(){
 const db=env.DB;if(!db)return Response.json({rows:[]},{status:503,headers});
 const cutoff=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
 const rows=await db.prepare('SELECT day,path,language,count FROM visits WHERE day>=? ORDER BY day DESC,path LIMIT 300').bind(cutoff).all();
 return Response.json({rows:rows.results},{headers});
}
