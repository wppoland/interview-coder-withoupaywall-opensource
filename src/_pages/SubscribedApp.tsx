// file: src/components/SubscribedApp.tsx
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import Queue from "../_pages/Queue"
import Solutions from "../_pages/Solutions"
import { useToast } from "../contexts/toast"
import { useTranscription } from "../hooks/useTranscription"
import { TranscriptionSessionDialog } from "../components/Transcription/TranscriptionSessionDialog"
import { TranscriptionPanel } from "../components/Transcription/TranscriptionPanel"

interface SubscribedAppProps {
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

const SubscribedApp: React.FC<SubscribedAppProps> = ({
  credits,
  currentLanguage,
  setLanguage
}) => {
  const queryClient = useQueryClient()
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue")
  const containerRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<"pl-PL" | "en-US">("pl-PL")
  const [showSessionDialog, setShowSessionDialog] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [hasShownInitialDialog, setHasShownInitialDialog] = useState(false)
  
  // Show language selection dialog on first mount if session is not active
  useEffect(() => {
    if (!hasShownInitialDialog && !sessionActive) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        setShowSessionDialog(true)
        setHasShownInitialDialog(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [hasShownInitialDialog, sessionActive])
  
  // Initialize transcription with selected language (but don't start automatically)
  const { 
    transcript, 
    error: transcriptionError, 
    isListening, 
    startListening, 
    stopListening, 
    clearTranscript 
  } = useTranscription(transcriptionLanguage, false)
  
  // Debug: log when transcription state changes
  useEffect(() => {
    console.log('Transcription state changed:', { isListening, transcriptionLanguage, error: transcriptionError })
  }, [isListening, transcriptionLanguage, transcriptionError])
  
  // Handle session start
  const handleStartSession = (language: "pl-PL" | "en-US") => {
    console.log('handleStartSession called with language:', language)
    setTranscriptionLanguage(language)
    setSessionActive(true)
    // Clear previous transcript
    clearTranscript()
    window.electronAPI.clearTranscript().catch(console.error)
    // Start listening after language is updated
    // Use a longer delay to ensure language is updated in the hook
    setTimeout(() => {
      console.log('Calling startListening after timeout')
      startListening()
    }, 800) // Increased delay to ensure hook is ready and language is updated
  }
  
  // Handle session stop
  const handleStopSession = () => {
    stopListening()
    setSessionActive(false)
    showToast("Sesja zakończona", "Transkrypcja została zatrzymana", "success")
  }
  
  // Show toast when transcription starts (only when session is active)
  const hasShownStartToast = useRef(false)
  useEffect(() => {
    if (isListening && sessionActive && !hasShownStartToast.current) {
      hasShownStartToast.current = true
      showToast(
        "Sesja rozpoczęta", 
        `Transkrypcja w języku ${transcriptionLanguage === "pl-PL" ? "polskim" : "angielskim"}. Naciśnij Cmd+Shift+M aby odpowiedzieć na pytania.`, 
        "success"
      )
    }
    if (!isListening) {
      hasShownStartToast.current = false
    }
  }, [isListening, transcriptionLanguage, sessionActive, showToast])
  
  // Listen for transcription reply
  useEffect(() => {
    const unsubscribeReply = window.electronAPI.onTranscriptionReply((data: { answer: string }) => {
      showToast("Answer Generated", data.answer.substring(0, 100) + "...", "success")
      console.log("Transcription reply:", data.answer)
    })
    
    const unsubscribeError = window.electronAPI.onTranscriptionReplyError((data: { error: string }) => {
      showToast("Error", data.error, "error")
    })
    
    return () => {
      unsubscribeReply()
      unsubscribeError()
    }
  }, [showToast])
  
  // Log transcription errors and show user-friendly messages
  useEffect(() => {
    if (transcriptionError) {
      console.warn("Transcription error:", transcriptionError)
      if (transcriptionError.includes("not supported")) {
        showToast(
          "Transcription Not Available", 
          "Speech recognition is not supported in this browser. Please use Chrome or Edge.", 
          "error"
        )
      } else if (transcriptionError.includes("permission") || transcriptionError.includes("microphone")) {
        showToast(
          "Microphone Permission Required", 
          "Please enable microphone access in System Settings > Privacy & Security > Microphone", 
          "error"
        )
      }
    }
  }, [transcriptionError, showToast])

  // Let's ensure we reset queries etc. if some electron signals happen
  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      queryClient.invalidateQueries({
        queryKey: ["screenshots"]
      })
      queryClient.invalidateQueries({
        queryKey: ["problem_statement"]
      })
      queryClient.invalidateQueries({
        queryKey: ["solution"]
      })
      queryClient.invalidateQueries({
        queryKey: ["new_solution"]
      })
      setView("queue")
    })

    return () => {
      cleanup()
    }
  }, [])

  // Dynamically update the window size
  useEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      if (!containerRef.current) return
      const height = containerRef.current.scrollHeight || 600
      const width = containerRef.current.scrollWidth || 800
      window.electronAPI?.updateContentDimensions({ width, height })
    }

    // Force initial dimension update immediately
    updateDimensions()
    
    // Set a fallback timer to ensure dimensions are set even if content isn't fully loaded
    const fallbackTimer = setTimeout(() => {
      window.electronAPI?.updateContentDimensions({ width: 800, height: 600 })
    }, 500)

    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(containerRef.current)

    // Also watch DOM changes
    const mutationObserver = new MutationObserver(updateDimensions)
    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    })

    // Do another update after a delay to catch any late-loading content
    const delayedUpdate = setTimeout(updateDimensions, 1000)

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      clearTimeout(fallbackTimer)
      clearTimeout(delayedUpdate)
    }
  }, [view])

  // Listen for events that might switch views or show errors
  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => {
        setView("solutions")
      }),
      window.electronAPI.onUnauthorized(() => {
        queryClient.removeQueries({
          queryKey: ["screenshots"]
        })
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["problem_statement"]
        })
        setView("queue")
      }),
      window.electronAPI.onResetView(() => {
        queryClient.removeQueries({
          queryKey: ["screenshots"]
        })
        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["problem_statement"]
        })
        setView("queue")
      }),
      window.electronAPI.onResetView(() => {
        queryClient.setQueryData(["problem_statement"], null)
      }),
      window.electronAPI.onProblemExtracted((data: any) => {
        if (view === "queue") {
          queryClient.invalidateQueries({
            queryKey: ["problem_statement"]
          })
          queryClient.setQueryData(["problem_statement"], data)
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Error", error, "error")
      })
    ]
    return () => cleanupFunctions.forEach((fn) => fn())
  }, [view])

  return (
    <>
      <TranscriptionSessionDialog
        open={showSessionDialog}
        onStartSession={handleStartSession}
        onClose={() => setShowSessionDialog(false)}
      />
      
      <div ref={containerRef} className="h-full flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 min-w-0 overflow-auto">
          {view === "queue" ? (
            <Queue
              setView={setView}
              credits={credits}
              currentLanguage={currentLanguage}
              setLanguage={setLanguage}
              onStartTranscriptionSession={() => setShowSessionDialog(true)}
            />
          ) : view === "solutions" ? (
            <Solutions
              setView={setView}
              credits={credits}
              currentLanguage={currentLanguage}
              setLanguage={setLanguage}
            />
          ) : null}
        </div>
        
        {/* Transcription panel - always visible, integrated into main window */}
        <div className="w-80 flex-shrink-0 border-l border-white/10 bg-black">
          <TranscriptionPanel
            transcript={transcript}
            isListening={isListening}
            onStart={() => {
              // If no session is active, show dialog to select language
              // Otherwise, just start listening
              if (!sessionActive) {
                setShowSessionDialog(true)
              } else {
                console.log('Starting listening directly')
                startListening()
              }
            }}
            onStop={handleStopSession}
            onClear={() => {
              clearTranscript()
              window.electronAPI.clearTranscript().catch(console.error)
            }}
            language={transcriptionLanguage}
          />
        </div>
      </div>
    </>
  )
}

export default SubscribedApp
