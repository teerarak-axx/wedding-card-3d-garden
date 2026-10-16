import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaults } from './defaults.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (password, salt) => scryptSync(password, salt, 64).toString('hex');
const dateValid = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const safeUrl = (value, local = false) => { try { if (local && /^\/(images|uploads)\/[\w.-]+$/.test(value)) return true; return new URL(value).protocol === 'https:'; } catch { return false; } };

export function createApp({ dbPath = resolve(root, 'data/garden.sqlite'), adminPassword = process.env.ADMIN_PASSWORD, uploadsPath = resolve(root, 'data/uploads') } = {}) {
  mkdirSync(dirname(dbPath), { recursive: true });
  mkdirSync(uploadsPath, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, attendance TEXT NOT NULL, count INTEGER NOT NULL, dietary TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);`);
  if (!db.prepare('SELECT id FROM settings').get()) db.prepare('INSERT INTO settings VALUES(1, ?)').run(JSON.stringify(defaults));
  if (!db.prepare('SELECT id FROM admins').get()) {
    if (!adminPassword || adminPassword.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');
    const salt = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO admins VALUES(1, ?, ?)').run(salt, hash(adminPassword, salt));
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '6mb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }); } catch { return res.status(403).json({ error: 'Invalid origin' }); }
    }
    next();
  });
  app.use('/uploads', express.static(uploadsPath, { maxAge: '1d' }));
  const attempts = new Map();
  function rateLimit(prefix, max, windowMs) {
    return (req, res, next) => {
      const now = Date.now(), key = prefix + req.ip;
      for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
      const item = attempts.get(key) || { count: 0, until: now + windowMs };
      item.count++; attempts.set(key, item);
      if (item.count > max) return res.status(429).json({ error: 'มีคำขอมากเกินไป กรุณาลองใหม่ในอีกสักครู่' });
      next();
    };
  }
  const tokenOf = req => (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('garden_session='))?.slice(15);
  function auth(req, res, next) {
    const session = db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(tokenOf(req) || '', Date.now());
    if (!session) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    next();
  }
  const settings = () => ({ ...defaults, ...JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value) });
  app.get('/api/config', (req, res) => res.json(settings()));
  app.post('/api/rsvp', rateLimit('rsvp', 15, 60 * 60 * 1000), (req, res) => {
    const b = { ...(req.body || {}), dietary: req.body?.dietary ?? '' };
    if (b.website) return res.status(400).json({ error: 'ไม่สามารถส่งข้อมูลได้' });
    if (typeof b.name !== 'string' || b.name.trim().length < 2 || b.name.length > 100 || !['yes','no'].includes(b.attendance) || !Number.isInteger(b.count) || b.count < 0 || b.count > 10 || (b.attendance === 'yes' && b.count < 1)) return res.status(400).json({ error: 'กรุณากรอกชื่อและจำนวนผู้ร่วมงานให้ถูกต้อง (1–10 ท่าน)' });
    for (const [key, max] of [['contact',120],['dietary',300],['message',1000]]) if (typeof b[key] !== 'string' || b[key].length > max) return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลที่กรอก' });
    const c = settings();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    if (today > c.rsvpDeadline) return res.status(400).json({ error: 'พ้นกำหนดตอบรับแล้ว กรุณาติดต่อบ่าวสาวโดยตรง' });
    const id = randomUUID();
    db.prepare('INSERT INTO guests VALUES(?,?,?,?,?,?,?,?)').run(id,b.name.trim(),b.contact.trim(),b.attendance,b.attendance==='yes'?b.count:0,b.dietary.trim(),b.message.trim(),new Date().toISOString());
    res.status(201).json({ id, message: 'บันทึกคำตอบรับแล้ว ขอบคุณที่เป็นส่วนหนึ่งในเรื่องราวของเรา' });
  });
  app.post('/api/admin/login', rateLimit('login', 10, 15 * 60 * 1000), (req,res) => {
    const { username, password } = req.body || {};
    const admin = db.prepare('SELECT * FROM admins WHERE id=1').get();
    const valid = typeof password === 'string' && password.length <= 256 && timingSafeEqual(Buffer.from(hash(password,admin.salt),'hex'), Buffer.from(admin.hash,'hex'));
    if (username !== 'admin' || !valid) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES(?,?)').run(token,Date.now()+12*60*60*1000);
    res.cookie('garden_session',token,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:12*60*60*1000,path:'/'}).json({ ok:true });
  });
  app.get('/api/admin/session', auth, (req,res)=>res.json({ username:'admin' }));
  app.post('/api/admin/logout', auth, (req,res)=>{
    db.prepare('DELETE FROM sessions WHERE token=?').run(tokenOf(req));
    res.clearCookie('garden_session',{path:'/'}).json({ok:true});
  });
  app.get('/api/admin/guests', auth, (req,res)=>res.json(db.prepare('SELECT * FROM guests ORDER BY created_at DESC').all()));
  app.delete('/api/admin/guests/:id', auth, (req,res)=>{
    const result = db.prepare('DELETE FROM guests WHERE id=?').run(req.params.id);
    if(!result.changes) return res.status(404).json({error:'ไม่พบข้อมูล'});
    res.json({ok:true});
  });
  app.get('/api/admin/export', auth, (req,res)=>{
    const rows = db.prepare('SELECT * FROM guests ORDER BY created_at DESC').all();
    const cell = v => {let s=String(v); if (/^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"';};
    const columns = ['name','contact','attendance','count','message','created_at'];
    res.set('Content-Type','text/csv; charset=utf-8').attachment('garden-path-rsvp.csv').send('\uFEFF'+[['ชื่อ','ติดต่อ','ตอบรับ','จำนวน','คำอวยพร','วันที่'],...rows.map(r=>columns.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n'));
  });
  app.put('/api/admin/config', auth, (req,res)=>{
    const existing=settings(), body=req.body || {};
    const next = {}, b = { ...body, musicUrl:body.musicUrl??existing.musicUrl, musicTitle:body.musicTitle??existing.musicTitle, musicEnabled:body.musicEnabled??existing.musicEnabled, musicVolume:body.musicVolume??existing.musicVolume };
    for (const key of Object.keys(defaults)) {
      if (['schedule','isDemo','musicEnabled','musicVolume'].includes(key)) continue;
      if (typeof b[key]!=='string' || b[key].length>2000 || (!b[key].trim() && !['intro','firstMetText','milestoneText','musicUrl','musicTitle'].includes(key))) return res.status(400).json({error:'กรุณาตรวจสอบข้อมูล: '+key});
      next[key] = b[key].trim();
    }
    for (const key of ['date','firstMetDate','milestoneDate','rsvpDeadline']) if (!dateValid(next[key])) return res.status(400).json({error:'รูปแบบวันที่ไม่ถูกต้อง'});
    if(next.rsvpDeadline>next.date) return res.status(400).json({error:'กำหนดตอบรับต้องไม่เกินวันงาน'});
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.time) || !safeUrl(next.mapsUrl) || !['firstPhoto','secondPhoto'].every(k=>safeUrl(next[k],true))) return res.status(400).json({error:'ลิงก์ต้องเป็น HTTPS และเวลาต้องถูกต้อง'});
    if (!Array.isArray(b.schedule) || !b.schedule.length || b.schedule.length>12 || !b.schedule.every(x=> x && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) && typeof x.title==='string' && x.title.trim().length>0 && x.title.length<=100 && typeof x.detail==='string' && x.detail.length<=300)) return res.status(400).json({error:'กรุณาตรวจสอบกำหนดการ'});
    if(typeof b.musicEnabled!=='boolean' || typeof b.musicVolume!=='number' || !Number.isFinite(b.musicVolume) || b.musicVolume<0 || b.musicVolume>1) return res.status(400).json({error:'กรุณาตรวจสอบการตั้งค่าเพลงและระดับเสียง'});
    if(next.musicUrl && !(/^\/uploads\/[a-f0-9-]+\.(mp3|wav|ogg|m4a)$/.test(next.musicUrl) || safeUrl(next.musicUrl))) return res.status(400).json({error:'ลิงก์เพลงต้องเป็นไฟล์ที่อัปโหลดหรือ HTTPS'});
    if(b.musicEnabled && !next.musicUrl) return res.status(400).json({error:'กรุณาอัปโหลดเพลงหรือใส่ลิงก์เพลงก่อนเปิดใช้งาน'});
    next.musicEnabled=b.musicEnabled;next.musicVolume=b.musicVolume;
    next.schedule=b.schedule.map(({time,title,detail})=>({time,title:title.trim(),detail:detail.trim()})); next.isDemo=b.isDemo!==false;
    db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(next));
    res.json(next);
  });
  app.post('/api/admin/upload', auth, (req,res)=>{
    const {data} = req.body || {};
    if(typeof data!=='string') return res.status(400).json({error:'ไม่พบรูปภาพ'});
    const match=data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if(!match) return res.status(400).json({error:'รองรับ JPG, PNG และ WebP เท่านั้น'});
    const bytes=Buffer.from(match[2],'base64');
    const valid=match[1]==='jpeg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255])):match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    if(!valid || bytes.length>4*1024*1024) return res.status(400).json({error:'ไฟล์รูปภาพไม่ถูกต้อง หรือใหญ่กว่า 4 MB'});
    const filename=randomUUID()+'.'+(match[1]==='jpeg'?'jpg':match[1]); writeFileSync(resolve(uploadsPath,filename),bytes);
    res.status(201).json({url:'/uploads/'+filename});
  });
  app.post('/api/admin/music', auth, express.raw({type:['audio/*','application/octet-stream'],limit:'20mb'}), (req,res)=>{
    const bytes=req.body;
    if(!Buffer.isBuffer(bytes) || bytes.length<44) return res.status(400).json({error:'กรุณาเลือกไฟล์เพลง MP3, M4A, OGG หรือ WAV'});
    let extension='';
    if(bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WAVE')extension='wav';
    else if(bytes.toString('ascii',0,3)==='ID3' || (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0))extension='mp3';
    else if(bytes.toString('ascii',0,4)==='OggS' && (bytes.subarray(0,256).includes(Buffer.from('OpusHead')) || bytes.subarray(0,256).includes(Buffer.from('vorbis'))))extension='ogg';
    else if(bytes.toString('ascii',4,8)==='ftyp' && ['M4A ','isom','mp42'].some(brand=>bytes.subarray(8,40).includes(Buffer.from(brand))))extension='m4a';
    if(!extension) return res.status(400).json({error:'ไฟล์นี้ไม่ใช่เพลงที่รองรับ กรุณาใช้ MP3, M4A, OGG หรือ WAV'});
    const filename=randomUUID()+'.'+extension;writeFileSync(resolve(uploadsPath,filename),bytes);
    res.status(201).json({url:'/uploads/'+filename,size:bytes.length});
  });
  app.put('/api/admin/password', auth, (req,res)=>{
    const {currentPassword,password} = req.body||{}, admin=db.prepare('SELECT * FROM admins WHERE id=1').get();
    if(typeof currentPassword!=='string' || currentPassword.length>256 || typeof password!=='string' || password.length<10 || password.length>256) return res.status(400).json({error:'รหัสผ่านใหม่ต้องมี 10–256 ตัวอักษร'});
    if(!timingSafeEqual(Buffer.from(hash(currentPassword,admin.salt),'hex'),Buffer.from(admin.hash,'hex'))) return res.status(400).json({error:'รหัสผ่านปัจจุบันไม่ถูกต้อง'});
    const salt=randomBytes(16).toString('hex'); db.prepare('UPDATE admins SET salt=?,hash=? WHERE id=1').run(salt,hash(password,salt));
    db.prepare('DELETE FROM sessions').run(); res.clearCookie('garden_session',{path:'/'}).json({ok:true});
  });
  app.use('/api', (req,res)=>res.status(404).json({error:'ไม่พบ API'}));
  app.use((err,req,res,next)=>{ if(err) res.status(err.status || 500).json({error:err.type==='entity.too.large'?'ไฟล์ใหญ่เกินไป':'ไม่สามารถดำเนินการได้ กรุณาลองใหม่'}); else next(); });
  app.locals.db=db;
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(resolve(root,'.env'))) {
    writeFileSync(resolve(root,'.env'), 'ADMIN_PASSWORD=garden-'+randomBytes(9).toString('base64url')+'\nPORT=4173\n',{mode:0o600});
    console.log('Created admin credentials in .env (username: admin).');
  }
  process.loadEnvFile(resolve(root,'.env'));
  const app=createApp();
  if(process.env.NODE_ENV==='production') {
    app.use(express.static(resolve(root,'dist')));
    app.get('/{*path}',(req,res)=>res.sendFile(resolve(root,'dist/index.html')));
  } else {
    const {createServer}=await import('vite');
    const vite=await createServer({server:{middlewareMode:true,allowedHosts:true},appType:'spa'});
    app.use(vite.middlewares);
  }
  const port=Number(process.env.PORT)||4173;
  app.listen(port,'0.0.0.0',()=>console.log(`The Garden Path → http://localhost:${port}\nAdmin → http://localhost:${port}/admin`));
}
