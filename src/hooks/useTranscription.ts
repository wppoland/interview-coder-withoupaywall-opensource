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

export function useTranscription(transcriptionLanguage: 'pl-PL' | 'en-US' = 'en-US', autoStart: boolean = false) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const languageRef = useRef(transcriptionLanguage)
  const shouldRestartRef = useRef(false)

  // Update language ref when it changes
  useEffect(() => {
    languageRef.current = transcriptionLanguage
    if (recognitionRef.current) {
      recognitionRef.current.lang = transcriptionLanguage
    }
  }, [transcriptionLanguage])

  // Initialize speech recognition (but don't start automatically)
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
    recognition.lang = languageRef.current
    
    console.log(`Speech recognition configured for language: ${languageRef.current}`)

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
      
      // Auto-restart on certain errors only if autoStart is enabled
      if (autoStart && (event.error === 'no-speech' || event.error === 'audio-capture')) {
        // These are recoverable - restart after a short delay
        setTimeout(() => {
          if (recognitionRef.current && isListening) {
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
      
      // Only auto-restart if autoStart is true and we should restart
      if (autoStart && shouldRestartRef.current) {
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
    }

    recognitionRef.current = recognition

    // Start listening automatically only if autoStart is true
    if (autoStart) {
      try {
        recognition.start()
      } catch (e) {
        console.error('Failed to start speech recognition:', e)
        setError('Failed to start speech recognition')
      }
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
  }, [autoStart, isListening])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        shouldRestartRef.current = true
        // Ensure language is set before starting
        recognitionRef.current.lang = languageRef.current
        console.log(`Starting speech recognition with language: ${languageRef.current}`)
        recognitionRef.current.start()
      } catch (e) {
        console.error('Failed to start listening:', e)
        setError('Failed to start listening')
      }
    } else if (!recognitionRef.current) {
      console.error('Speech recognition not initialized')
      setError('Speech recognition not initialized')
    } else if (isListening) {
      console.log('Already listening')
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        shouldRestartRef.current = false
        recognitionRef.current.stop()
        recognitionRef.current.abort()
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

