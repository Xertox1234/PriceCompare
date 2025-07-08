import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AccessibilitySettings {
  voiceNavigation: boolean;
  screenReaderMode: boolean;
  highContrast: boolean;
  largeText: boolean;
  keyboardNavigation: boolean;
  reducedMotion: boolean;
  focusIndicators: boolean;
  announcements: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  isListening: boolean;
  startVoiceNavigation: () => void;
  stopVoiceNavigation: () => void;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
}

const defaultSettings: AccessibilitySettings = {
  voiceNavigation: false,
  screenReaderMode: false,
  highContrast: false,
  largeText: false,
  keyboardNavigation: true,
  reducedMotion: false,
  focusIndicators: true,
  announcements: true,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const saved = localStorage.getItem('accessibility-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        setRecognition(recognition);
      }

      // Speech Synthesis
      if (window.speechSynthesis) {
        setSynthesis(window.speechSynthesis);
      }
    }
  }, []);

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast mode
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Large text mode
    if (settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Focus indicators
    if (settings.focusIndicators) {
      root.classList.add('enhanced-focus');
    } else {
      root.classList.remove('enhanced-focus');
    }

    // Screen reader mode
    if (settings.screenReaderMode) {
      root.classList.add('screen-reader-mode');
    } else {
      root.classList.remove('screen-reader-mode');
    }

    // Save settings to localStorage
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  // Update settings function
  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Announce messages to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.announcements) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [settings.announcements]);

  // Speech synthesis function
  const speakText = useCallback((text: string) => {
    if (!synthesis || !settings.voiceNavigation) return;

    synthesis.cancel(); // Stop any current speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    synthesis.speak(utterance);
  }, [synthesis, settings.voiceNavigation]);

  // Stop speaking function
  const stopSpeaking = useCallback(() => {
    if (synthesis) {
      synthesis.cancel();
    }
  }, [synthesis]);

  // Voice navigation functions
  const startVoiceNavigation = useCallback(async () => {
    if (!recognition || !settings.voiceNavigation) return;

    // Request microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately as we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      setIsListening(true);
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        handleVoiceCommand(command);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          announce('Microphone access was denied. Please allow microphone access in your browser settings.', 'assertive');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (settings.voiceNavigation && isListening) {
          // Restart recognition if voice navigation is still enabled
          setTimeout(() => {
            recognition.start();
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      announce('Voice navigation started. Say "help" for commands.', 'assertive');
    } catch (error) {
      console.error('Microphone permission error:', error);
      announce('Microphone access is required for voice navigation. Please allow microphone access.', 'assertive');
      setIsListening(false);
    }
  }, [recognition, settings.voiceNavigation, announce, isListening]);

  const stopVoiceNavigation = useCallback(() => {
    if (recognition) {
      recognition.stop();
    }
    setIsListening(false);
    announce('Voice navigation stopped.', 'polite');
  }, [recognition, announce]);

  // Handle voice commands
  const handleVoiceCommand = useCallback((command: string) => {
    announce(`Command received: ${command}`, 'polite');

    // Navigation commands
    if (command.includes('go to home') || command.includes('home page')) {
      window.location.href = '/';
      speakText('Navigating to home page');
    } else if (command.includes('go to products') || command.includes('products page')) {
      window.location.href = '/products';
      speakText('Navigating to products page');
    } else if (command.includes('go to forum') || command.includes('forum page')) {
      window.location.href = '/forum';
      speakText('Navigating to forum');
    } else if (command.includes('advanced search')) {
      window.location.href = '/search/advanced';
      speakText('Navigating to advanced search');
    }
    
    // Search commands
    else if (command.includes('search for')) {
      const searchTerm = command.replace('search for', '').trim();
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = searchTerm;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        speakText(`Searching for ${searchTerm}`);
      }
    }
    
    // Interaction commands
    else if (command.includes('click') || command.includes('activate')) {
      const focusedElement = document.activeElement as HTMLElement;
      if (focusedElement && focusedElement.tagName !== 'BODY') {
        focusedElement.click();
        speakText('Activating focused element');
      }
    } else if (command.includes('next') || command.includes('tab')) {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
      const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
      if (nextElement) {
        nextElement.focus();
        speakText(`Focused on ${nextElement.tagName.toLowerCase()}`);
      }
    } else if (command.includes('previous') || command.includes('back')) {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
      const previousElement = focusableElements[currentIndex - 1] as HTMLElement;
      if (previousElement) {
        previousElement.focus();
        speakText(`Focused on ${previousElement.tagName.toLowerCase()}`);
      }
    }
    
    // Help command
    else if (command.includes('help')) {
      const helpText = `Available voice commands: 
        Navigation: "go to home", "go to products", "go to forum", "advanced search"
        Search: "search for [item]"
        Interaction: "click", "activate", "next", "previous"
        Control: "stop listening", "help"`;
      speakText(helpText);
    }
    
    // Control commands
    else if (command.includes('stop listening') || command.includes('stop voice')) {
      updateSettings({ voiceNavigation: false });
      stopVoiceNavigation();
    }
    
    // Unknown command
    else {
      speakText('Command not recognized. Say "help" for available commands.');
    }
  }, [announce, speakText, updateSettings, stopVoiceNavigation]);

  const contextValue: AccessibilityContextType = {
    settings,
    updateSettings,
    announce,
    isListening,
    startVoiceNavigation,
    stopVoiceNavigation,
    speakText,
    stopSpeaking,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}