import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../lib/api-config';
import type { CodeEdit } from '../types/editor';

export type JarvisState = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'error';

interface UseJarvisOptions {
  onCodeEdit?: (edit: CodeEdit) => void;
}

export function useJarvis(options?: UseJarvisOptions) {
  const [jarvisState, setJarvisState] = useState<JarvisState>('disconnected');
  const [transcript, setTranscript] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);

  // Initialize and unlock audio playback on user gesture
  const initAudio = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.error);
      }
      // Play a short silent sample to immediately unlock browser audio autoplay
      const silentBuffer = ctx.createBuffer(1, 1, 24000);
      const silentSource = ctx.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(ctx.destination);
      silentSource.start(0);
    } catch (err) {
      console.warn('AudioContext init warning:', err);
    }
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    // Ensure AudioContext is actively running (browsers suspend it after idle intervals)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(console.error);
    }

    isSpeakingRef.current = true;
    setJarvisState('speaking');

    try {
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const numSamples = Math.floor(len / 2);
      if (numSamples === 0) return;

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Safe DataView conversion for PCM 16-bit little-endian
      const float32Array = new Float32Array(numSamples);
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, numSamples * 2);
      for (let i = 0; i < numSamples; i++) {
        float32Array[i] = dataView.getInt16(i * 2, true) / 32768.0; 
      }

      const audioBuffer = ctx.createBuffer(1, numSamples, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0) {
          isSpeakingRef.current = false;
          setJarvisState('listening');
        }
      };

      // Seamless streaming audio scheduling:
      // If nextPlayTime is behind current clock, catch up to now
      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) {
        nextPlayTimeRef.current = now; 
      }
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }, []);

  const stopJarvisAudio = useCallback(() => {
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    isSpeakingRef.current = false;
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
    setJarvisState('listening');
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
        // Prevent speaker echo feedback: do not stream mic while EDITH is speaking
        if (isSpeakingRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Buffer = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(pcm16Buffer);
        
        wsRef.current.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: base64Audio
        }));
      };
      setJarvisState('listening');
    } catch (err) {
      console.error('Microphone Error:', err);
      setJarvisState('error');
    }
  }, []);

  const startJarvis = useCallback((initialContext?: { code: string; filePath: string; output: string; error: string; projectId: string }) => {
    if (jarvisState !== 'disconnected' && jarvisState !== 'error') return;
    
    setJarvisState('connecting');
    initAudio();
    
    // Connect to WebSocket (update URL based on your env/host)
    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/api/v1/jarvis/ws`;
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = async () => {
      // Send initial context immediately after connection
      if (initialContext && wsRef.current) {
        console.log('📤 Sending initial context to Jarvis:', initialContext);
        wsRef.current.send(JSON.stringify({
          type: 'context_update',
          context: initialContext
        }));
      }
      await startMicrophone();
    };

    let currentMessage = "";

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "response.output_audio.delta" || data.type === "response.audio.delta") {
          if (data.delta) {
            playAudioChunk(data.delta);
          }
        } 
        else if (data.type === "code_edit" && data.edit) {
          // E D I T H triggered a code edit via voice command
          console.log('🤖 E D I T H: Received code edit via voice', data.edit);
          if (options?.onCodeEdit) {
            options.onCodeEdit(data.edit as CodeEdit);
          }
        }
        else if (data.type === "response.output_audio_transcript.delta" || data.type === "response.audio_transcript.delta") {
          currentMessage += data.delta;
          setTranscript(currentMessage);
        } 
        else if (data.type === "response.output_audio_transcript.done" || data.type === "response.audio_transcript.done") {
          currentMessage = ""; 
          // Keep the last transcript visible for a bit
          setTimeout(() => {
              if (currentMessage === "") {
                  setTranscript("");
              }
          }, 3000);
        } 
        else if (data.type === "input_audio_buffer.speech_started") {
          // If EDITH was speaking, user interrupted
          if (isSpeakingRef.current) {
            console.log('User speech detected, stopping EDITH playback');
            stopJarvisAudio();
          }
          currentMessage = "";
          setTranscript("");
        }
        else if (data.type === "clear_audio") {
          console.log("🔇 Backend requested audio mute");
          stopJarvisAudio();
        }
      } catch (e) {
        console.error('WebSocket message parsing error:', e);
      }
    };
    
    wsRef.current.onclose = () => {
      setJarvisState('disconnected');
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };

    wsRef.current.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setJarvisState('error');
    };
  }, [jarvisState, initAudio, startMicrophone, playAudioChunk, stopJarvisAudio]);

  const stopJarvis = useCallback(() => {
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
    stopJarvisAudio();
    setJarvisState('disconnected');
    setTranscript('');
  }, [stopJarvisAudio]);

  const updateContext = useCallback((context: { code: string; filePath: string; output: string; error: string; projectId: string }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'context_update',
        context
      }));
    }
  }, []);

  useEffect(() => {
    return () => {
      stopJarvis(); // Cleanup on unmount
    };
  }, [stopJarvis]);

  return {
    jarvisState,
    transcript,
    startJarvis,
    stopJarvis,
    updateContext
  };
}
