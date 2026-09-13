
const express=require('express');
const sdk=require('microsoft-cognitiveservices-speech-sdk');
const fs=require('fs'),os=require('os'),path=require('path');
require('dotenv').config();
const app=express();
app.use(express.json({limit:'100mb'}));
app.use(express.static(path.join(__dirname,'public')));
const key=()=>process.env.AZURE_SPEECH_KEY||'';
const region=()=>process.env.AZURE_SPEECH_REGION||'';
const voices={
  us_female:{locale:'en-US',voice:'en-US-Ava:DragonHDLatestNeural',label:'American · Ava',gender:'Female'},
  us_male:{locale:'en-US',voice:'en-US-Andrew:DragonHDLatestNeural',label:'American · Andrew',gender:'Male'},
  uk_female:{locale:'en-GB',voice:'en-GB-SoniaNeural',label:'British · Sonia',gender:'Female'},
  uk_male:{locale:'en-GB',voice:'en-GB-RyanNeural',label:'British · Ryan',gender:'Male'}
};
app.get('/api/status',(req,res)=>res.json({configured:Boolean(key()&&region()),provider:'Microsoft Azure Speech',voices}));
function speechConfig(locale='en-US'){
  const c=sdk.SpeechConfig.fromSubscription(key(),region());
  c.speechRecognitionLanguage=locale;
  c.outputFormat=sdk.OutputFormat.Detailed;
  return c;
}
app.post('/api/tts',(req,res)=>{
  if(!key()||!region())return res.status(503).json({error:'Azure Speech 尚未配置'});
  const id=String(req.body?.voiceId||'us_female');
  const v=voices[id]||voices.us_female;
  const text=String(req.body?.text||'').trim();
  const slow=Boolean(req.body?.slow);
  if(!text)return res.status(400).json({error:'缺少文本'});
  try{
    const c=sdk.SpeechConfig.fromSubscription(key(),region());
    c.speechSynthesisLanguage=v.locale;
    c.speechSynthesisVoiceName=v.voice;
    c.setSpeechSynthesisOutputFormat(sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3);
    const syn=new sdk.SpeechSynthesizer(c);
    const esc=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const rate=slow?'-15%':'0%';
    const ssml=`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.locale}"><voice name="${v.voice}"><prosody rate="${rate}">${esc}</prosody></voice></speak>`;
    syn.speakSsmlAsync(ssml,r=>{
      syn.close();
      if(r.reason===sdk.ResultReason.SynthesizingAudioCompleted){
        res.set('Content-Type','audio/mpeg');res.send(Buffer.from(r.audioData));
      }else res.status(500).json({error:r.errorDetails||'TTS failed'});
    },e=>{syn.close();res.status(500).json({error:String(e)})});
  }catch(e){res.status(500).json({error:e.message})}
});
function words(s){return String(s||'').toLowerCase().replace(/[^a-z0-9'\s]/g,' ').split(/\s+/).filter(Boolean)}
function lev(a,b){const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
function weighted(items,k){const a=items.filter(x=>Number.isFinite(x[k]));const den=a.reduce((s,x)=>s+(x.weight||1),0);return den?a.reduce((s,x)=>s+x[k]*(x.weight||1),0)/den:0}
app.post('/api/assess',(req,res)=>{
  if(!key()||!region())return res.status(503).json({error:'Azure Speech 尚未配置'});
  const reference=String(req.body?.referenceText||'').trim();
  const audio=String(req.body?.audioBase64||'');
  const accent=req.body?.accent==='uk'?'uk':'us';
  const locale=accent==='uk'?'en-GB':'en-US';
  const prosodySupported=locale==='en-US';
  if(!reference||!audio)return res.status(400).json({error:'缺少参考文本或录音'});
  const tmp=path.join(os.tmpdir(),`showroom-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  fs.writeFileSync(tmp,Buffer.from(audio,'base64'));
  try{
    const c=speechConfig(locale);
    const ac=sdk.AudioConfig.fromWavFileInput(fs.readFileSync(tmp));
    const rec=new sdk.SpeechRecognizer(c,ac);
    const pa=new sdk.PronunciationAssessmentConfig(reference,sdk.PronunciationAssessmentGradingSystem.HundredMark,sdk.PronunciationAssessmentGranularity.Phoneme,false);
    if(prosodySupported)pa.enableProsodyAssessment=true;
    pa.applyTo(rec);
    const seg=[],texts=[],details=[];let done=false;
    const finish=(obj,code=200)=>{if(done)return;done=true;try{rec.stopContinuousRecognitionAsync(()=>rec.close(),()=>rec.close())}catch{}try{fs.unlinkSync(tmp)}catch{}res.status(code).json(obj)};
    rec.recognized=(s,e)=>{
      if(e.result.reason!==sdk.ResultReason.RecognizedSpeech)return;
      texts.push(e.result.text||'');
      let paRes;try{paRes=sdk.PronunciationAssessmentResult.fromResult(e.result)}catch{}
      let j={};try{j=JSON.parse(e.result.json)}catch{}
      const nb=j.NBest?.[0]||{}, p=nb.PronunciationAssessment||{};
      const ws=(nb.Words||[]).map(w=>({word:w.Word,accuracy:Number(w.PronunciationAssessment?.AccuracyScore??0),errorType:w.PronunciationAssessment?.ErrorType||'None',phonemes:(w.Phonemes||[]).map(ph=>({phoneme:ph.Phoneme,accuracy:Number(ph.PronunciationAssessment?.AccuracyScore??0)}))}));
      details.push(...ws);
      seg.push({accuracy:Number(paRes?.accuracyScore??p.AccuracyScore??0),fluency:Number(paRes?.fluencyScore??p.FluencyScore??0),prosody:prosodySupported?Number(paRes?.prosodyScore??p.ProsodyScore??0):null,weight:Math.max(1,ws.length)});
    };
    rec.canceled=(s,e)=>{if(e.reason===sdk.CancellationReason.Error)finish({error:e.errorDetails||'Azure Speech 评测失败'},500)};
    rec.sessionStopped=()=>{
      const recognized=texts.join(' ').trim(),rw=words(reference),hw=words(recognized);
      const completeness=Math.max(0,Math.min(100,100*(1-lev(rw,hw)/Math.max(1,rw.length))));
      const accuracy=weighted(seg,'accuracy'), fluency=weighted(seg,'fluency'), prosody=prosodySupported?weighted(seg,'prosody'):null;
      const total=prosodySupported
        ? accuracy*.35+fluency*.25+prosody*.25+completeness*.15
        : accuracy*.45+fluency*.35+completeness*.20;
      const issues=details.filter(w=>w.accuracy<75||w.errorType!=='None').sort((a,b)=>a.accuracy-b.accuracy).slice(0,24);
      finish({provider:'Microsoft Azure Speech',locale,accent,prosodySupported,total:Math.round(total),accuracy:Math.round(accuracy),fluency:Math.round(fluency),prosody:prosody===null?null:Math.round(prosody),completeness:Math.round(completeness),recognizedText:recognized,issues,segments:seg.length});
    };
    rec.startContinuousRecognitionAsync(()=>{},e=>finish({error:String(e)},500));
  }catch(e){try{fs.unlinkSync(tmp)}catch{}res.status(500).json({error:e.message})}
});
app.listen(process.env.PORT||3000,()=>console.log(`Showroom AI Coach V6 PRO: http://localhost:${process.env.PORT||3000}`));
