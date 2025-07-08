import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export function TestSwitch() {
  const [isEnabled, setIsEnabled] = useState(false);
  
  return (
    <div className="flex items-center space-x-2 p-4 border rounded-lg">
      <Switch
        id="test-switch"
        checked={isEnabled}
        onCheckedChange={setIsEnabled}
      />
      <Label htmlFor="test-switch">
        Test Switch (Current: {isEnabled ? 'ON' : 'OFF'})
      </Label>
    </div>
  );
}