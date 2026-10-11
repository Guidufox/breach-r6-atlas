export function loadConfig(env=process.env){
  const token=(env.DISCORD_TOKEN||'').trim(),applicationId=(env.DISCORD_APPLICATION_ID||'').trim(),guildId=(env.DISCORD_GUILD_ID||'').trim();
  if(!token||token==='PEGAR_TOKEN_AQUI'||/\s/.test(token))throw new Error('Configurá el token en .env con Configurar-Bot.bat.');
  if(!/^\d{17,20}$/.test(applicationId))throw new Error('Falta un Application ID válido en .env.');
  if(!/^\d{17,20}$/.test(guildId))throw new Error('Falta el ID de tu servidor de Discord en .env.');
  let website='';if(env.ATLAS_URL?.trim()){const u=new URL(env.ATLAS_URL.trim());if(u.protocol!=='https:'||u.username||u.password)throw new Error('ATLAS_URL debe ser una URL HTTPS pública.');website=u.href;}
  return {token,applicationId,guildId,website,defaultLanguage:['es','en','pt-br'].includes(env.DEFAULT_LANGUAGE)?env.DEFAULT_LANGUAGE:'es'};
}
export function safeError(error){const code=error?.code??error?.status;return typeof code==='number'?'Código '+code:'Error de conexión o configuración';}
