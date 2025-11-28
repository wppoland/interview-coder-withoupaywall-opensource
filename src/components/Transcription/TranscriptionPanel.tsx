// TranscriptionPanel.tsx
import { Button } from "../ui/button"
import { Mic, MicOff, Square, Trash2 } from "lucide-react"

interface TranscriptionPanelProps {
  transcript: string
  isListening: boolean
  onStart: () => void
  onStop: () => void
  onClear: () => void
  onSelectLanguage: () => void
  language: "pl-PL" | "en-US"
}

export function TranscriptionPanel({
  transcript,
  isListening,
  onStart,
  onStop,
  onClear,
  onSelectLanguage,
  language
}: TranscriptionPanelProps) {
  return (
    <div className="bg-black border-l border-white/10 h-full flex flex-col">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-sm text-white/80 font-medium">
            Transkrypt {language === "pl-PL" ? "(Polski)" : "(English)"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isListening ? (
            <Button
              onClick={onStop}
              size="sm"
              className="h-7 px-2 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
              title="Zatrzymaj sesję"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={onStart}
              size="sm"
              className="h-7 px-2 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
              title="Rozpocznij sesję"
            >
              <Mic className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          <Button
            onClick={onClear}
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10"
            title="Wyczyść transkrypt"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">
        {transcript ? (
          <div className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
            {transcript}
          </div>
        ) : (
          <div className="text-sm text-white/40 italic text-center mt-8">
            {isListening 
              ? "Słuchanie... Mów teraz." 
              : "Kliknij 'Start' aby rozpocząć transkrypcję"}
          </div>
        )}
      </div>
      
      {transcript && (
        <div className="p-2 border-t border-white/10 text-xs text-white/50 text-center">
          {transcript.split(/\s+/).length} słów
        </div>
      )}
    </div>
  )
}

