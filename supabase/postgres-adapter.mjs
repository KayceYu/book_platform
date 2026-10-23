export function translateQuery(sql) {
  return sql.replace(/\bjson_group_array\(([^)]+)\)/g,"COALESCE(jsonb_agg($1),'[]'::jsonb)")
    .replace(/\b(json_extract|json_array_length|json_each|json_insert|json_set|json)\s*\(/g,(_,fn)=>`cg_${fn}(`)
    .replace(/\bas eventId\b/g,'as "eventId"').replace(/\bas memberId\b/g,'as "memberId"');
}
export function postgresDatabase(client) {
  const call=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw new Error(error.message);return data;};
  const prepare=(query,args=[])=>({query:translateQuery(query),args,bind(...next){return prepare(query,next);},async first(){return (await call('cg_sql',{query:this.query,args:this.args})).results[0]||null;},async all(){return call('cg_sql',{query:this.query,args:this.args});},async run(){return call('cg_sql',{query:this.query,args:this.args});}});
  return {prepare,async batch(list){return call('cg_batch',{statements:list.map(s=>({query:s.query,args:s.args}))});}};
}
