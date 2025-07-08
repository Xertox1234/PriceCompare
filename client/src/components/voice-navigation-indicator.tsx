import { useAccessibility } from '@/contexts/accessibility-context';
import { Mic, MicOff } from 'lucide-react';

export function VoiceNavigationIndicator() {
  const { isListening, settings } = useAccessibility();

  if (!settings.voiceNavigation) return null;

  return (
    <div className="voice-listening-indicator">
      {isListening ? (
        <Mic className="h-4 w-4" />
      ) : (
        <MicOff className="h-4 w-4" />
      )}
      <span>{isListening ? 'Listening' : 'Voice Ready'}</span>
    </div>
  );
}