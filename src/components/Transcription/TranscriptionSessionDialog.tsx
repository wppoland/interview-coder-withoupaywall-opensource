// TranscriptionSessionDialog.tsx
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog"
import { Button } from "../ui/button"
import { useToast } from "../../contexts/toast"

interface TranscriptionSessionDialogProps {
  open: boolean
  onStartSession: (language: "pl-PL" | "en-US") => void
  onClose: () => void
}

export function TranscriptionSessionDialog({
  open,
  onStartSession,
  onClose
}: TranscriptionSessionDialogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<"pl-PL" | "en-US">("pl-PL")
  const { showToast } = useToast()

  const handleStart = () => {
    console.log('TranscriptionSessionDialog: Starting session with language:', selectedLanguage)
    onStartSession(selectedLanguage)
    // Don't show toast here - it will be shown when listening actually starts
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-black border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Rozpocznij sesję transkrypcji</DialogTitle>
          <DialogDescription className="text-white/70">
            Wybierz język transkrypcji przed rozpoczęciem sesji
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              Język transkrypcji
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as "pl-PL" | "en-US")}
              className="w-full bg-black/50 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="pl-PL">Polski (pl-PL)</option>
              <option value="en-US">English (en-US)</option>
            </select>
          </div>

          <div className="bg-black/30 border border-white/10 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">ℹ️ Informacje:</p>
            <ul className="text-xs text-white/60 space-y-1 list-disc list-inside">
              <li>Transkrypt będzie widoczny podczas sesji</li>
              <li>Naciśnij Cmd+Shift+M aby odpowiedzieć na pytanie</li>
              <li>Upewnij się, że mikrofon ma uprawnienia</li>
            </ul>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/10 hover:bg-white/5 text-white"
            >
              Anuluj
            </Button>
            <Button
              onClick={handleStart}
              className="px-4 py-2 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            >
              Rozpocznij sesję
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

