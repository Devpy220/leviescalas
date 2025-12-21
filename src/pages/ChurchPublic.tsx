import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Church, 
  MapPin, 
  Users, 
  Calendar as CalendarIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
  LogIn,
  UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChurchData {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface DepartmentData {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
}

interface ScheduleData {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  department_name: string;
  department_avatar: string | null;
}

export default function ChurchPublic() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [church, setChurch] = useState<ChurchData | null>(null);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  useEffect(() => {
    if (slug) {
      fetchChurch();
    }
  }, [slug]);

  useEffect(() => {
    if (church?.id) {
      fetchSchedules();
    }
  }, [church?.id, currentMonth]);

  const fetchChurch = async () => {
    if (!slug) return;
    
    try {
      const { data: churchData, error: churchError } = await supabase
        .rpc('get_church_public', { p_slug: slug });

      if (churchError) throw churchError;
      
      if (!churchData || churchData.length === 0) {
        setNotFound(true);
        return;
      }

      setChurch(churchData[0]);

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .rpc('get_church_departments_public', { p_church_id: churchData[0].id });

      if (deptError) throw deptError;
      setDepartments(deptData || []);
    } catch (error) {
      console.error('Error fetching church:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    if (!church?.id) return;

    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .rpc('get_church_schedules_public', {
          p_church_id: church.id,
          p_start_date: startDate,
          p_end_date: endDate,
        });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: church?.name,
          text: `Confira a página da ${church?.name}`,
          url,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: 'Link copiado!',
        description: 'Compartilhe com quem desejar.',
      });
    }
  };

  // Calendar helpers
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfMonth = startOfMonth(currentMonth);
  const startingDayIndex = firstDayOfMonth.getDay();
  const emptyDays = Array.from({ length: startingDayIndex }, (_, i) => i);

  const getSchedulesForDay = (date: Date) => {
    return schedules.filter(s => isSameDay(new Date(s.date), date));
  };

  const selectedDaySchedules = selectedDate ? getSchedulesForDay(selectedDate) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !church) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Church className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Igreja não encontrada</h1>
        <p className="text-muted-foreground mb-6">O endereço informado não corresponde a nenhuma igreja cadastrada.</p>
        <Link to="/">
          <Button>Voltar ao início</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">LEVI</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
            <ThemeToggle />
            
            {/* Auth buttons */}
            {session ? (
              <Button onClick={() => navigate('/dashboard')} className="gradient-vibrant text-white">
                Meu Painel
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to={`/auth?church=${slug}`}>
                  <Button variant="outline" size="sm">
                    <LogIn className="w-4 h-4 mr-1" />
                    Entrar
                  </Button>
                </Link>
                <Link to={`/auth?tab=register&church=${slug}`}>
                  <Button size="sm" className="gradient-vibrant text-white">
                    <UserPlus className="w-4 h-4 mr-1" />
                    Criar Conta
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Church Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            {church.logo_url ? (
              <img 
                src={church.logo_url} 
                alt={church.name}
                className="w-24 h-24 rounded-2xl object-cover shadow-glow border-2 border-primary/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                <Church className="w-12 h-12 text-primary-foreground" />
              </div>
            )}
          </div>
          
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            {church.name}
          </h1>
          
          {(church.city || church.state) && (
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-4">
              <MapPin className="w-4 h-4" />
              <span>{[church.city, church.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
          
          {church.description && (
            <p className="text-muted-foreground max-w-xl mx-auto">
              {church.description}
            </p>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="departments" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 max-w-md mx-auto">
            <TabsTrigger value="departments" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Departamentos
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Calendário
            </TabsTrigger>
          </TabsList>

          {/* Departments Tab */}
          <TabsContent value="departments">
            {departments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum departamento cadastrado
                </h3>
                <p className="text-muted-foreground">
                  Os departamentos da igreja aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <Card key={dept.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={dept.avatar_url || undefined} alt={dept.name} />
                          <AvatarFallback className="gradient-primary text-primary-foreground">
                            {dept.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {dept.name}
                          </h3>
                          {dept.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {dept.description}
                            </p>
                          )}
                          <Badge variant="secondary" className="mt-1">
                            <Users className="w-3 h-3 mr-1" />
                            {dept.member_count} membro{dept.member_count !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* CTA to create account or department */}
            <div className="mt-8 text-center">
              {session ? (
                <>
                  <p className="text-muted-foreground mb-4">
                    Quer criar um departamento nesta igreja?
                  </p>
                  <Link to={`/criar-departamento?church=${slug}`}>
                    <Button className="gradient-primary text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Departamento
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">
                    Crie uma conta para participar dos departamentos desta igreja
                  </p>
                  <Link to={`/auth?tab=register&church=${slug}`}>
                    <Button className="gradient-vibrant text-white">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Criar Conta
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <CardTitle className="capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {emptyDays.map((_, index) => (
                    <div key={`empty-${index}`} className="aspect-square" />
                  ))}
                  {days.map((day) => {
                    const daySchedules = getSchedulesForDay(day);
                    const hasSchedules = daySchedules.length > 0;
                    const isSelected = selectedDate && isSameDay(day, selectedDate);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(isSelected ? null : day)}
                        className={`
                          aspect-square p-1 text-sm rounded-lg transition-colors relative
                          ${isToday(day) ? 'border-2 border-primary' : ''}
                          ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
                          ${!isSameMonth(day, currentMonth) ? 'text-muted-foreground/50' : ''}
                        `}
                      >
                        {format(day, 'd')}
                        {hasSchedules && !isSelected && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected day schedules */}
                {selectedDate && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="font-medium text-foreground mb-3">
                      {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                    </h4>
                    {selectedDaySchedules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma escala para este dia.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDaySchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={schedule.department_avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {schedule.department_name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {schedule.department_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
