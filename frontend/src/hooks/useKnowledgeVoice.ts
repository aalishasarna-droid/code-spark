import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../lib/api-config';

export type KnowledgeVoiceState = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'error';

export function useKnowledgeVoice() {
  const [voiceState, setVoiceState] = useState<KnowledgeVoiceState>('disconnected');
  const [transcript, setTranscript] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    setVoiceState('speaking');

    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0; 
    }

    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
      if (activeSourcesRef.current.length === 0) {
        setVoiceState('listening');
      }
    };

    if (nextPlayTimeRef.current < ctx.currentTime) {
      nextPlayTimeRef.current = ctx.currentTime + 0.1; 
    }
    const startTime = nextPlayTimeRef.current;
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
  }, []);

  const stopAudio = useCallback(() => {
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
    setVoiceState('listening');
  }, []);

  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const startMicrophone = useCallback(async () => {
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      const ctx = audioContextRef.current!;
      const source = ctx.createMediaStreamSource(mediaStreamRef.current);
      
      processorRef.current = ctx.createScriptProcessor(4096, 1, 1);
      
      const dummyGain = ctx.createGain();
      dummyGain.gain.value = 0;
      
      source.connect(processorRef.current);
      processorRef.current.connect(dummyGain);
      dummyGain.connect(ctx.destination);

      processorRef.current.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        // MUTE MICROPHONE WHILE AI IS SPEAKING
        if (activeSourcesRef.current.length > 0) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Buffer = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(pcm16Buffer);
        
        wsRef.current.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: base64Audio
        }));
      };
      setVoiceState('listening');
    } catch (err) {
      console.error('Microphone Error:', err);
      setVoiceState('error');
    }
  }, []);

  const startVoice = useCallback((projectId: string) => {
    if (voiceState !== 'disconnected' && voiceState !== 'error') return;
    
    setVoiceState('connecting');
    initAudio();
    
    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/api/v1/knowledge/ws`;
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = async () => {
      if (wsRef.current) {
        console.log('📤 Sending context update to Knowledge Voice');
        wsRef.current.send(JSON.stringify({
          type: 'context_update',
          context: { projectId }
        }));
      }
      await startMicrophone();
    };

    let currentMessage = "";

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "response.output_audio.delta") {
          playAudioChunk(data.delta);
        } 
        else if (data.type === "response.output_audio_transcript.delta") {
          currentMessage += data.delta;
          setTranscript(currentMessage);
        } 
        else if (data.type === "response.output_audio_transcript.done") {
          currentMessage = ""; 
          setTimeout(() => {
              if (currentMessage === "") {
                  setTranscript("");
              }
          }, 3000);
        } 
        else if (data.type === "input_audio_buffer.speech_started") {
          stopAudio();
          currentMessage = "";
          setTranscript("");
        }
      } catch (e) {
        console.error('WebSocket message parsing error:', e);
      }
    };
    
    wsRef.current.onclose = () => {
      setVoiceState('disconnected');
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };

    wsRef.current.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setVoiceState('error');
    };
  }, [voiceState, initAudio, startMicrophone, playAudioChunk, stopAudio]);

  const stopVoice = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopAudio();
    setVoiceState('disconnected');
    setTranscript('');
  }, [stopAudio]);

  useEffect(() => {
    return () => stopVoice();
  }, [stopVoice]);

  return {
    voiceState,
    transcript,
    startVoice,
    stopVoice
  };
}
