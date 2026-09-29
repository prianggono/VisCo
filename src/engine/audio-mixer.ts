import type { MasterAudioMix } from "../domain/audio.js";
export interface AudioMixerFrame { readonly samples: Float32Array; readonly channels: number; readonly sampleRate: number; }
export function mixAudioFrame(frame: AudioMixerFrame, mix: MasterAudioMix): AudioMixerFrame {
  if(frame.channels<1||frame.sampleRate<8000) throw new Error("Invalid audio frame.");
  const gain=mix.sources.reduce((sum,source)=>sum+Math.max(0,Math.min(1,source.gain)),0);
  if(gain<=0) return { ...frame, samples: new Float32Array(frame.samples.length) };
  const scale=1/Math.max(1,gain);
  const samples=new Float32Array(frame.samples.length);
  for(let i=0;i<frame.samples.length;i++) samples[i]=Math.max(-1,Math.min(1,frame.samples[i]*scale*gain));
  return { ...frame, samples };
}
