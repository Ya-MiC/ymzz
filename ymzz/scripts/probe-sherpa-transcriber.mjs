// MIT. Real unchanged DSH source + original/derived native library, NOT a fake model.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL}from'node:url';import {stripTypeScriptTypes}from'node:module';
const args=process.argv.slice(2);
if(args[0]==='--prepare-wave'){fs.writeFileSync(args[2],stripTypeScriptTypes(fs.readFileSync(args[1],'utf8')))}else{
 const [consumer,assets,output]=args;const {createTranscriber}=await import(pathToFileURL(path.join(consumer,'inference.ts')).href);
 const transcribe=createTranscriber({model:path.join(assets,'model.int8.onnx'),tokens:path.join(assets,'tokens.txt'),vad:path.join(assets,'silero_vad.onnx'),threads:2,vadThreshold:0.5,minSilenceSeconds:0.2,minSpeechSeconds:0.1,segmentSeconds:15,maxAudioBytes:10*1024*1024,vadOnsetPaddingSeconds:0.12});
 const transcripts=['zh.wav','en.wav'].map(file=>({file,...transcribe(new Uint8Array(fs.readFileSync(path.join(assets,file))),'auto')}));
 for(const r of transcripts){assert(r.text.trim().length>=2,'Actual native VAD/SenseVoice must recognize real fixture, not return an empty success');assert(r.audioSeconds>0);assert(r.inferenceSeconds>0)}
 fs.writeFileSync(output,JSON.stringify({scope:'Unchanged actual DSH createTranscriber + real pinned CPU SenseVoice int8/Silero, no LLM/network inference',transcripts},null,2)+'\n');
}
