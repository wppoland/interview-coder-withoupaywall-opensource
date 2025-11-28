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
    console.log('Transcription language changed to:', transcriptionLanguage)
    languageRef.current = transcriptionLanguage
    if (recognitionRef.current) {
      recognitionRef.current.lang = transcriptionLanguage
      console.log('Updated recognition language to:', transcriptionLanguage)
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
      console.error('Speech recognition error:', event.error, event.message)
      setError(`Speech recognition error: ${event.error}`)
      
      // Don't stop on certain recoverable errors
      if (event.error === 'no-speech') {
        console.log('No speech detected, continuing...')
        return // Don't set error for no-speech
      }
      
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
  }, [autoStart]) // Remove isListening from dependencies to prevent re-initialization

  const startListening = useCallback(() => {
    console.log('startListening called, recognitionRef.current:', !!recognitionRef.current, 'isListening:', isListening, 'language:', languageRef.current)
    
    if (!recognitionRef.current) {
      console.error('Speech recognition not initialized - waiting and retrying...')
      // Retry after a short delay if recognition is not ready
      setTimeout(() => {
        if (recognitionRef.current) {
          console.log('Retrying startListening after delay')
          startListening()
        } else {
          setError('Speech recognition not initialized. Please wait a moment and try again.')
        }
      }, 500)
      return
    }
    
    if (isListening) {
      console.log('Already listening, skipping start')
      return
    }
    
    try {
      shouldRestartRef.current = true
      // Ensure language is set before starting
      recognitionRef.current.lang = languageRef.current
      console.log(`Starting speech recognition with language: ${languageRef.current}`)
      recognitionRef.current.start()
      console.log('recognition.start() called successfully')
    } catch (e) {
      console.error('Failed to start listening:', e)
      const errorMessage = e instanceof Error ? e.message : 'Failed to start listening'
      setError(`Failed to start listening: ${errorMessage}`)
      
      // If error is about already started, try to stop and restart
      if (errorMessage.includes('already') || errorMessage.includes('started')) {
        console.log('Recognition may already be started, trying to restart...')
        try {
          if (recognitionRef.current) {
            recognitionRef.current.stop()
            recognitionRef.current.abort()
            setTimeout(() => {
              if (recognitionRef.current && !isListening) {
                recognitionRef.current.start()
              }
            }, 200)
          }
        } catch (retryError) {
          console.error('Failed to restart recognition:', retryError)
        }
      }
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

