export async function api(path, options={}) {
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');error.status=response.status;throw error;}
  return data;
}
export const dateLabel=(date,lang='en-GB',options={})=>new Date(date+'T12:00:00+07:00').toLocaleDateString(lang,{day:'numeric',month:'long',year:'numeric',...options});
