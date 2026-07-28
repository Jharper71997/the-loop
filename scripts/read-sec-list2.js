const BASE='https://the-loop-eight.vercel.app'
;(async()=>{
 const res=await fetch(BASE+'/login',{redirect:'manual'})
 console.log('status',res.status)
 const html=await res.text()
 const srcs=[...new Set((html.match(/\/_next\/static\/[^"'\ )]+/g)||[]))]
 console.log('static refs:',srcs.length)
 srcs.slice(0,40).forEach(s=>console.log(' ',s))
 const bid=(html.match(/\/_next\/static\/([^/"]+)\/_(ssg|build)Manifest/)||[])[1]
   || (srcs.find(s=>/\/_next\/static\/[^/]+\//.test(s)&&!s.includes('/chunks/')&&!s.includes('/css/'))||'').split('/')[3]
 console.log('guessed buildId:',bid)
}).call().catch?0:0
