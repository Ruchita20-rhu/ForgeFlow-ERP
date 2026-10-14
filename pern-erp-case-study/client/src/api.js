const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export async function request(path, options={}) {
  const token=localStorage.getItem('forgeflow_token');
  const response=await fetch(`${API}${path}`,{
    ...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(options.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Request failed');
  return data;
}
