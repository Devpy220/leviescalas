import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function SettingsButton() {
  const navigate = useNavigate();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigate('/security')}
        >
          <Settings className="w-5 h-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Configurações</TooltipContent>
    </Tooltip>
  );
}
