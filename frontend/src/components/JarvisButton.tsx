import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { JarvisState } from '../hooks/useJarvis';

interface JarvisButtonProps {
  jarvisState: JarvisState;
  onToggle: () => void;
  transcript: string;
}

export default function JarvisButton({ jarvisState, onToggle, transcript }: JarvisButtonProps) {
  const isActive = jarvisState === 'listening' || jarvisState === 'speaking';
  const isConnecting = jarvisState === 'connecting';

  return (
    <div className="flex items-center gap-3">
      {transcript && isActive && (
        <div className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-md max-w-[300px] truncate animate-pulse">
          E D I T H: {transcript}
        </div>
      )}
      
      <button
        onClick={onToggle}
        disabled={isConnecting}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300",
          isActive 
            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]" 
            : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
          isConnecting && "opacity-70 cursor-not-allowed"
        )}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isActive ? (
          <div className="relative">
            <Mic className="w-4 h-4" />
            {jarvisState === 'speaking' && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>
        ) : (
          <MicOff className="w-4 h-4" />
        )}
        
        <span>
          {isConnecting ? 'Connecting...' : isActive ? 'Disable E D I T H' : 'Enable E D I T H'}
        </span>
      </button>
    </div>
  );
}
