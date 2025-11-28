// useTranscription.ts
import { useEffect, useRef, useState, useCallback } from 'react'

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function useTranscription(transcriptionLanguage: 'pl-PL' | 'en-US' = 'en-US') {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      console.warn('Speech recognition API not available')
      return
    }

    const recognition = new SpeechRecognition()
    
    // Configure for continuous listening with selected language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = transcriptionLanguage
    
    console.log(`Speech recognition configured for language: ${transcriptionLanguage}`)

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
      console.log('Speech recognition started')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      // Update transcript with final results
      if (finalTranscript) {
        setTranscript((prev) => {
          const updated = prev + finalTranscript
          // Send to main process
          if (window.electronAPI?.appendTranscript) {
            window.electronAPI.appendTranscript(finalTranscript.trim()).catch((err: Error) => {
              console.error("Failed to append transcript:", err)
            })
          }
          return updated
        })
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setError(`Speech recognition error: ${event.error}`)
      
      // Auto-restart on certain errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        // These are recoverable - restart after a short delay
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognition.start()
            } catch (e) {
              console.error('Failed to restart recognition:', e)
            }
          }
        }, 1000)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      console.log('Speech recognition ended')
      
      // Auto-restart to keep listening continuously
      // Only restart if we haven't explicitly stopped
      setTimeout(() => {
        if (recognitionRef.current) {
          try {
            recognition.start()
          } catch (e) {
            // Ignore errors when restarting - might already be starting
            console.log('Recognition restart attempt:', e)
          }
        }
      }, 100)
    }

    recognitionRef.current = recognition

    // Start listening automatically
    try {
      recognition.start()
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
      setError('Failed to start speech recognition')
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        try {
          recognition.stop()
          recognition.abort()
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      recognitionRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.error('Failed to start listening:', e)
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        console.error('Failed to stop listening:', e)
      }
    }
  }, [isListening])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    if (window.electronAPI?.clearTranscript) {
      window.electronAPI.clearTranscript().catch((err: Error) => {
        console.error("Failed to clear transcript:", err)
      })
    }
  }, [])

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript
  }
}

