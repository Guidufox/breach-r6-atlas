import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
export default async function Stats(){
 const rows=env.DB?await env.DB.prepare('SELECT day,path,language,count FROM visits ORDER BY day DESC,path LIMIT 200').all<{day:string;path:string;language:string;count:number}>():{results:[]};
 return <main style={{padding:32,fontFamily:'sans-serif'}}><h1>Flamingo/Strat · visitas agregadas</h1><p>Visitas a páginas, no personas únicas. Sin cookies, identificadores de visitante, IP ni notas guardadas en esta tabla. Se respetan Do Not Track y Global Privacy Control.</p><table><thead><tr><th>Fecha UTC</th><th>Página</th><th>Idioma</th><th>Visitas</th></tr></thead><tbody>{rows.results.map(r=><tr key={r.day+r.path+r.language}><td>{r.day}</td><td>{r.path}</td><td>{r.language}</td><td>{r.count}</td></tr>)}</tbody></table><p><a href="https://guidufox.github.io/breach-r6-atlas/">Volver al atlas</a></p></main>;
}
