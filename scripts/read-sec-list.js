// Read the inlined NEXT_PUBLIC_SECURITY_EMAILS from the deployed prod bundle.
const BASE='https://the-loop-eight.vercel.app'
;(async()=>{
 const html=await (await fetch(BASE+'/login')).text()
 const m=html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/)
 if(!m){console.log('no buildId found');return}
 const buildId=m[1]
 console.log('buildId:',buildId)
 const man=await (await fetch(`${BASE}/_next/static/${buildId}/_buildManifest.js`)).text()
 // collect chunk paths
 const chunks=[...new Set((man.match(/static\/chunks\/[^"']+\.js/g)||[]))]
 console.log('chunks in manifest:',chunks.length)
 // also grab app-build-manifest style app chunks
 let hits=[]
 for(const ch of chunks){
   try{
     const js=await (await fetch(`${BASE}/_next/${ch}`)).text()
     if(js.includes('jvillebrewloop.com')){
       // find email-list-looking literals
       const emails=[...new Set((js.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)||[]))]
       hits.push({ch,emails})
     }
   }catch(e){}
 }
 console.log(JSON.stringify(hits,null,2))
})().catch(e=>{console.error(e)})
