import { useEffect, useRef, useState } from 'react';

export default function useWeddingAudio(config) {
  const [playing,setPlaying]=useState(false),[error,setError]=useState('');
  const track=useRef(null),ambience=useRef(null);
  const url=config?.musicEnabled?config.musicUrl:'';
  const volume=config?.musicVolume??.35;
  useEffect(()=>{
    setPlaying(false);setError('');
    if(!url)return;
    const audio=new Audio(url);audio.loop=true;audio.preload='metadata';audio.volume=volume;track.current=audio;
    const started=()=>setPlaying(true),paused=()=>setPlaying(false);
    const failed=()=>{setPlaying(false);setError('เล่นเพลงไม่ได้ กรุณาตรวจสอบไฟล์เพลงหรือลองเปิดเสียงอีกครั้ง');};
    audio.addEventListener('play',started);audio.addEventListener('pause',paused);audio.addEventListener('error',failed);
    return()=>{audio.pause();audio.removeEventListener('play',started);audio.removeEventListener('pause',paused);audio.removeEventListener('error',failed);audio.removeAttribute('src');audio.load();track.current=null;};
  },[url]);
  useEffect(()=>{if(track.current)track.current.volume=volume;},[volume]);
  useEffect(()=>()=>{ambience.current?.close();},[]);
  async function toggle(){
    setError('');
    if(url){
      const audio=track.current;if(!audio)return;
      if(!audio.paused){audio.pause();return;}
      try{if(audio.error)audio.load();await audio.play();}catch{setPlaying(false);setError('กรุณากดเปิดเสียงอีกครั้ง หรือให้ผู้ดูแลตรวจสอบเพลง');}
      return;
    }
    // Keep the existing gentle ambience when no custom song has been selected.
    if(ambience.current?.state==='running'){await ambience.current.suspend();setPlaying(false);return;}
    try{
      if(!ambience.current){
        const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
        const ctx=new AudioContext();ambience.current=ctx;
        const gain=ctx.createGain();gain.gain.value=.035;gain.connect(ctx.destination);
        [261.63,329.63,392,523.25].forEach((frequency,i)=>{
          const oscillator=ctx.createOscillator();oscillator.type='sine';oscillator.frequency.value=frequency;
          const level=ctx.createGain();level.gain.value=.15;
          const lfo=ctx.createOscillator();lfo.frequency.value=.08+i*.025;
          const depth=ctx.createGain();depth.gain.value=.1;lfo.connect(depth);depth.connect(level.gain);
          oscillator.connect(level);level.connect(gain);oscillator.start();lfo.start();
        });
      }
      await ambience.current.resume();setPlaying(true);
    }catch{setPlaying(false);setError('อุปกรณ์นี้ไม่สามารถเปิดเสียงได้');}
  }
  return {playing,toggle,error,clearError:()=>setError('')};
}
