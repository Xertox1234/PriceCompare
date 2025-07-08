import React, { useState } from 'react';
import { useAccessibility } from '@/contexts/accessibility-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Accessibility, 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Eye, 
  Type, 
  Contrast, 
  Keyboard, 
  Zap, 
  Target,
  Bell,
  HelpCircle,
  Settings
} from 'lucide-react';

export function AccessibilityPanel() {
  const { 
    settings, 
    updateSettings, 
    announce, 
    isListening, 
    startVoiceNavigation, 
    stopVoiceNavigation,
    speakText,
    stopSpeaking
  } = useAccessibility();

  const [isOpen, setIsOpen] = useState(false);

  const handleVoiceToggle = (enabled: boolean) => {
    updateSettings({ voiceNavigation: enabled });
    if (enabled) {
      startVoiceNavigation();
      announce('Voice navigation enabled', 'assertive');
    } else {
      stopVoiceNavigation();
      announce('Voice navigation disabled', 'polite');
    }
  };

  const handleScreenReaderToggle = (enabled: boolean) => {
    updateSettings({ screenReaderMode: enabled });
    announce(enabled ? 'Screen reader mode enabled' : 'Screen reader mode disabled', 'assertive');
  };

  const handleSettingChange = (setting: keyof typeof settings, value: boolean) => {
    updateSettings({ [setting]: value });
    announce(`${setting.replace(/([A-Z])/g, ' $1').toLowerCase()} ${value ? 'enabled' : 'disabled'}`, 'polite');
  };

  const testVoiceCommand = () => {
    speakText('This is a test of the text-to-speech functionality. Voice navigation is working correctly.');
  };

  const showVoiceCommands = () => {
    const commands = `Available voice commands: 
      Navigation commands: "go to home", "go to products", "go to forum", "advanced search"
      Search commands: "search for" followed by your search term
      Interaction commands: "click" or "activate" to interact with focused element
      Navigation commands: "next" or "tab" to move forward, "previous" or "back" to move backward
      Control commands: "stop listening" to disable voice navigation, "help" for this list`;
    
    speakText(commands);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
          aria-label="Open accessibility settings"
        >
          <Accessibility className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Accessibility className="h-5 w-5" />
            Accessibility Settings
          </DialogTitle>
          <DialogDescription>
            Configure accessibility features including voice navigation, screen reader optimization, and visual enhancements to improve your experience.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">

          {/* Voice Navigation Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Voice Navigation
                {isListening && <Badge variant="secondary" className="ml-2">Listening</Badge>}
              </CardTitle>
              <CardDescription>
                Control the application using voice commands and text-to-speech
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="voice-navigation">Enable Voice Navigation</Label>
                  <p className="text-sm text-muted-foreground">
                    Navigate and interact using voice commands
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="voice-navigation"
                    checked={settings.voiceNavigation}
                    onCheckedChange={handleVoiceToggle}
                  />
                </div>
              </div>
              
              {settings.voiceNavigation && (
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    {isListening ? (
                      <Mic className="h-4 w-4 text-green-600" />
                    ) : (
                      <MicOff className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      Voice Recognition: {isListening ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant={isListening ? "destructive" : "default"}
                      size="sm"
                      onClick={isListening ? stopVoiceNavigation : startVoiceNavigation}
                      className="flex items-center gap-2"
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isListening ? 'Stop Listening' : 'Start Voice Commands'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testVoiceCommand}
                      className="flex items-center gap-2"
                    >
                      <Volume2 className="h-4 w-4" />
                      Test Voice
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={showVoiceCommands}
                      className="flex items-center gap-2"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Voice Commands
                    </Button>
                  </div>
                  
                  {isListening && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-800 mb-2">🎤 Listening for Voice Commands:</p>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Say "Go to products" to navigate to products page</li>
                        <li>• Say "Search for [item]" to search for products</li>
                        <li>• Say "Help" to get voice command help</li>
                        <li>• Say "Home" to go to home page</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Screen Reader Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Screen Reader Optimization
              </CardTitle>
              <CardDescription>
                Enhanced compatibility with screen reader software
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="screen-reader">Screen Reader Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Optimize interface for screen reader users
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="screen-reader"
                    checked={settings.screenReaderMode}
                    onCheckedChange={handleScreenReaderToggle}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="announcements">Live Announcements</Label>
                  <p className="text-sm text-muted-foreground">
                    Announce page changes and status updates
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="announcements"
                    checked={settings.announcements}
                    onCheckedChange={(checked) => handleSettingChange('announcements', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual Accessibility Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Contrast className="h-5 w-5" />
                Visual Accessibility
              </CardTitle>
              <CardDescription>
                Visual enhancements for better readability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="high-contrast">High Contrast Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Increase contrast for better visibility
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="high-contrast"
                    checked={settings.highContrast}
                    onCheckedChange={(checked) => handleSettingChange('highContrast', checked)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="large-text">Large Text</Label>
                  <p className="text-sm text-muted-foreground">
                    Increase text size for better readability
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="large-text"
                    checked={settings.largeText}
                    onCheckedChange={(checked) => handleSettingChange('largeText', checked)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="focus-indicators">Enhanced Focus Indicators</Label>
                  <p className="text-sm text-muted-foreground">
                    Show clear focus outlines for keyboard navigation
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="focus-indicators"
                    checked={settings.focusIndicators}
                    onCheckedChange={(checked) => handleSettingChange('focusIndicators', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Motion and Interaction Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Motion and Interaction
              </CardTitle>
              <CardDescription>
                Control animations and interaction preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="reduced-motion">Reduced Motion</Label>
                  <p className="text-sm text-muted-foreground">
                    Minimize animations and transitions
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="reduced-motion"
                    checked={settings.reducedMotion}
                    onCheckedChange={(checked) => handleSettingChange('reducedMotion', checked)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="keyboard-navigation">Keyboard Navigation</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable enhanced keyboard navigation support
                  </p>
                </div>
                <div className="ml-4">
                  <Switch
                    id="keyboard-navigation"
                    checked={settings.keyboardNavigation}
                    onCheckedChange={(checked) => handleSettingChange('keyboardNavigation', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Navigation</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><kbd className="px-2 py-1 bg-muted rounded">Tab</kbd> - Next element</li>
                    <li><kbd className="px-2 py-1 bg-muted rounded">Shift + Tab</kbd> - Previous element</li>
                    <li><kbd className="px-2 py-1 bg-muted rounded">Enter</kbd> - Activate element</li>
                    <li><kbd className="px-2 py-1 bg-muted rounded">Space</kbd> - Toggle checkboxes</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Search</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><kbd className="px-2 py-1 bg-muted rounded">Ctrl + K</kbd> - Focus search</li>
                    <li><kbd className="px-2 py-1 bg-muted rounded">Esc</kbd> - Close dialogs</li>
                    <li><kbd className="px-2 py-1 bg-muted rounded">Arrow keys</kbd> - Navigate suggestions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}