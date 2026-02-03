import {
  WelcomeStep,
  ChurchStep,
  DepartmentsStep,
  CalendarStep,
  AvailabilityStep,
  SectorsStep,
  NotificationsStep,
  ExportStep,
} from './steps';

interface StepContentProps {
  stepId: string;
}

export function StepContent({ stepId }: StepContentProps) {
  switch (stepId) {
    case 'welcome':
      return <WelcomeStep />;
    case 'church':
      return <ChurchStep />;
    case 'departments':
      return <DepartmentsStep />;
    case 'calendar':
      return <CalendarStep />;
    case 'availability':
      return <AvailabilityStep />;
    case 'sectors':
      return <SectorsStep />;
    case 'notifications':
      return <NotificationsStep />;
    case 'export':
      return <ExportStep />;
    default:
      return null;
  }
}
