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
  const autoStartRef = useRef(autoStart)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update refs
  useEffect(() => {
    languageRef.current = transcriptionLanguage
    if (recognitionRef.current) {
      recognitionRef.current.lang = transcriptionLanguage
    }
  }, [transcriptionLanguage])

  useEffect(() => {
    autoStartRef.current = autoStart

    // If autoStart turns off, stop listening
    if (!autoStart && isListening && recognitionRef.current) {
      recognitionRef.current.stop()
    }

    // If autoStart turns on and we're not listening, start listening
    if (autoStart && !isListening && recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.error('Failed to auto-start:', e)
      }
    }
  }, [autoStart, isListening])

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = languageRef.current

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
      console.log('Speech recognition started')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' '
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => {
          const updated = prev + finalTranscript
          if (window.electronAPI?.appendTranscript) {
            window.electronAPI.appendTranscript(finalTranscript.trim()).catch(console.error)
          }
          return updated
        })
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied')
        autoStartRef.current = false // Stop trying if permission denied
      } else {
        setError(`Error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      console.log('Speech recognition ended')

      // Auto-restart logic
      if (autoStartRef.current) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current)

        // Increase delay to 200ms to prevent rapid jitter
        restartTimeoutRef.current = setTimeout(() => {
          if (autoStartRef.current && recognitionRef.current) {
            try {
              console.log('Auto-restarting speech recognition...')
              recognitionRef.current.start()
            } catch (e) {
              console.error('Failed to restart:', e)
            }
          }
        }, 200)
      }
    }

    recognitionRef.current = recognition

    // Initial start if autoStart is true
    if (autoStart) {
      try {
        recognition.start()
      } catch (e) {
        console.error('Failed to initial start:', e)
      }
    }

    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
          recognitionRef.current.abort()
        } catch (e) {
          // ignore
        }
      }
      recognitionRef.current = null
    }
  }, []) // Run once on mount

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.error('Manual start failed:', e)
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      autoStartRef.current = false // Disable auto-restart
      try {
        recognitionRef.current.stop()
      } catch (e) {
        console.error('Manual stop failed:', e)
      }
    }
  }, [isListening])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    if (window.electronAPI?.clearTranscript) {
      window.electronAPI.clearTranscript().catch(console.error)
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

