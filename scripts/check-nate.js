const fs=require('fs');const path=require('path')
const envText=fs.readFileSync(path.join(__dirname,'..','.env.local'),'utf8')
for(const line of envText.split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
const{createClient}=require('@supabase/supabase-js')
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}})
;(async()=>{
 // Existing contact?
 const{data:c}=await sb.from('contacts').select('id,first_name,last_name,email,phone').ilike('email','nateroeder4@gmail.com')
 console.log('CONTACT match:',JSON.stringify(c))
 const{data:c2}=await sb.from('contacts').select('id,first_name,last_name,email').ilike('last_name','roeder')
 console.log('ROEDER contacts:',JSON.stringify(c2))
 // Existing auth user? scan admin list
 let page=1,found=null,total=0
 while(page<=20){
   const{data,error}=await sb.auth.admin.listUsers({page,perPage:200})
   if(error){console.log('auth err:',error.message);break}
   const us=data?.users||[]
   total+=us.length
   const hit=us.find(u=>(u.email||'').toLowerCase()==='nateroeder4@gmail.com')
   if(hit){found=hit;break}
   if(us.length<200)break
   page++
 }
 console.log('AUTH scanned:',total,'users; nate user:',found?JSON.stringify({id:found.id,email:found.email,confirmed:found.email_confirmed_at,created:found.created_at}):'NONE')
})().catch(e=>{console.error(e);process.exit(1)})
