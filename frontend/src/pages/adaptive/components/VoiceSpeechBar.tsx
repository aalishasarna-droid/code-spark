import React, { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Languages, Radio } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SupportedLanguage } from '../types'
import { SUPPORTED_LANGUAGES } from '../mockData'

interface VoiceSpeechBarProps {
  currentLanguage: SupportedLanguage
  onLanguageChange: (lang: SupportedLanguage) => void
  onVoiceTranscript?: (text: string) => void
  activeConceptTitle?: string
  ttsText?: string
}

export const VoiceSpeechBar: React.FC<VoiceSpeechBarProps> = ({
  currentLanguage,
  onLanguageChange,
  onVoiceTranscript,
  activeConceptTitle = 'Negative Integers & Sign Rules',
  ttsText = 'ऋणात्मक संख्याओं के जोड़ और घटाव में बराबर चिह्न के पार जाने पर चिह्न बदल जाता है।'
}) => {
  const [isListening, setIsListening] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  // Speech recognition initialization with fallback
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true

        const langCodes: Record<SupportedLanguage, string> = {
          en: 'en-IN',
          hi: 'hi-IN',
          kn: 'kn-IN',
          ta: 'ta-IN',
          te: 'te-IN',
        }
        recognition.lang = langCodes[currentLanguage] || 'en-IN'

        recognition.onresult = (event: any) => {
          let interim = ''
          let final = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript
            } else {
              interim += event.results[i][0].transcript
            }
          }
          if (final) {
            setTranscript(final)
            setInterimTranscript('')
            setIsListening(false)
            onVoiceTranscript?.(final)
          } else {
            setInterimTranscript(interim)
          }
        }

        recognition.onerror = () => {
          // Graceful fallback to simulated voice input if permissions or mic unavailable
          simulateVoiceInput()
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      } catch {
        recognitionRef.current = null
      }
    }
  }, [currentLanguage, onVoiceTranscript])

  const simulateVoiceInput = () => {
    const simulatedQueries: Record<SupportedLanguage, string> = {
      en: 'Sir, why does minus 12 plus 7 become minus 5 instead of plus 5?',
      hi: 'गुरुजी, -12 में +7 जोड़ने पर -5 कैसे आया, कृपया फिर से समझाइए।',
      kn: 'ಗುರುಗಳೇ, -12 ಕ್ಕೆ +7 ಸೇರಿಸಿದರೆ -5 ಹೇಗೆ ಬರುತ್ತದೆ?',
      ta: 'ஐயா, -12 உடன் +7 கூட்டும்போது -5 எப்படி வருகிறது?',
      te: 'సార్, -12 కి +7 కూడితే -5 ఎలా వస్తుందో వివరించండి.',
    }
    const query = simulatedQueries[currentLanguage] || simulatedQueries.en
    setInterimTranscript('🎙️ Listening in Indic Voice Stream...')
    setTimeout(() => {
      setInterimTranscript(query.slice(0, 20) + '...')
    }, 600)
    setTimeout(() => {
      setTranscript(query)
      setInterimTranscript('')
      setIsListening(false)
      onVoiceTranscript?.(query)
    }, 1400)
  }

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop?.()
      setIsListening(false)
    } else {
      setTranscript('')
      setInterimTranscript('')
      setIsListening(true)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch {
          simulateVoiceInput()
        }
      } else {
        simulateVoiceInput()
      }
    }
  }

  const toggleTTS = () => {
    if (isPlayingAudio) {
      window.speechSynthesis?.cancel?.()
      setIsPlayingAudio(false)
      return
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(ttsText)
      const langCodes: Record<SupportedLanguage, string> = {
        en: 'en-IN',
        hi: 'hi-IN',
        kn: 'kn-IN',
        ta: 'ta-IN',
        te: 'te-IN',
      }
      utterance.lang = langCodes[currentLanguage] || 'hi-IN'
      utterance.rate = 0.95

      utterance.onstart = () => setIsPlayingAudio(true)
      utterance.onend = () => setIsPlayingAudio(false)
      utterance.onerror = () => {
        // Fallback simulated audio playback timer
        setIsPlayingAudio(true)
        setTimeout(() => setIsPlayingAudio(false), 4500)
      }

      window.speechSynthesis.speak(utterance)
    } else {
      setIsPlayingAudio(true)
      setTimeout(() => setIsPlayingAudio(false), 4000)
    }
  }

  const activeLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0]

  return (
    <div className="bg-card/90 backdrop-blur border border-border/80 rounded-2xl p-4 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Language Selection */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">
              Regional Language (क्षेत्रीय भाषा)
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => onLanguageChange(lang.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    currentLanguage === lang.code
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-secondary/60 hover:bg-secondary text-foreground/80'
                  }`}
                  title={lang.label}
                >
                  <span className="mr-1">{lang.flag}</span>
                  {lang.nativeName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Voice-first Actions (ASR Mic & TTS Player) */}
        <div className="flex items-center gap-3">
          {/* TTS Audio Button */}
          <button
            onClick={toggleTTS}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
              isPlayingAudio
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-secondary hover:bg-secondary/80 border-border text-foreground'
            }`}
            title="Read out explanation in selected regional language"
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Stop Audio</span>
                {/* Visualizer bars */}
                <span className="flex items-center gap-0.5 ml-1">
                  {[40, 90, 60, 100, 50].map((h, i) => (
                    <motion.span
                      key={i}
                      className="w-1 bg-amber-500 rounded-full"
                      animate={{ height: isPlayingAudio ? [4, h * 0.16, 4] : 4 }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                      style={{ height: 12 }}
                    />
                  ))}
                </span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Listen ({activeLang.nativeName})</span>
              </>
            )}
          </button>

          {/* Voice Input Mic Button */}
          <button
            onClick={toggleListening}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30 ring-2 ring-rose-500/30'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
            }`}
            title="Speak your doubt or answer in your mother tongue"
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Listening...</span>
                <Radio className="w-3.5 h-3.5 animate-ping" />
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Speak Query (बोलें)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Voice Transcript Output Banner */}
      <AnimatePresence>
        {(isListening || transcript || interimTranscript) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border/60 flex items-start gap-2.5 text-xs"
          >
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-foreground/90">
                {isListening ? 'Voice Input Stream (Live Indic ASR): ' : 'Recognized Voice Query: '}
              </span>
              <span className="text-muted-foreground italic">
                {interimTranscript || transcript || 'Speak into your microphone in your regional language...'}
              </span>
            </div>
            {transcript && (
              <button
                onClick={() => setTranscript('')}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded bg-secondary/70"
              >
                Clear
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
