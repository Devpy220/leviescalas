import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, MessageSquareText, Send, User as UserIcon,
  ArrowLeft, Check, Trash2, Bell, Users, CalendarDays, X,
} from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { SMART_SLOTS as FIXED_SLOTS } from '@/lib/fixedSlots';
import { createExtendedMemberColorMap, getMemberBackgroundStyle } from '@/lib/memberColors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface DeptMember { user_id: string; name: string }

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SuggestedSchedule {
  date: string;
  user_id: string;
  name: string;
  time_start: string;
  time_end: string;
  slotLabel: string;
  selected: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  onSchedulesCreated: () => void;
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: `Olá! Sou o **LEVI**, seu assistente de escalas. 👋

Me diga **quando** e **as condições** da escala. Exemplos:
- *"Escala só para o domingo dia 22"*
- *"Próxima semana, 2 pessoas por culto"*
- *"O mês inteiro de janeiro, evite escalar fulano com ciclano"*
- *"Esta sexta-feira à noite"*

Se você não disser uma data, usarei o **mês selecionado** abaixo. Bloqueios diários e disponibilidade semanal são respeitados automaticamente.`,
};

export default function AiAssistantDialog({ open, onOpenChange, departmentId, onSchedulesCreated }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<'chat' | 'review'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedSchedule[]>([]);
  const [reasoning, setReasoning] = useState('');
  const [resolvedRange, setResolvedRange] = useState<{ start: string; end: string } | null>(null);
  const [sendNotifications, setSendNotifications] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(() =>
    format(new Date(), 'yyyy-MM')
  );

  const [allMembers, setAllMembers] = useState<DeptMember[]>([]);
  const [memberFilter, setMemberFilter] = useState<string[]>([]);
  const [explicitDates, setExplicitDates] = useState<Date[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setStep('chat');
      setMessages([WELCOME]);
      setInput('');
      setSuggestions([]);
      setReasoning('');
      setMemberFilter([]);
      setExplicitDates([]);
      setTimeout(() => inputRef.current?.focus(), 100);
      supabase.rpc('get_department_member_profiles', { dept_id: departmentId }).then(({ data }) => {
        setAllMembers((data || []).map((m: any) => ({ user_id: m.id, name: m.name })));
      });
    }
  }, [open, departmentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, generating]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newHistory);
    setInput('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-schedule-assistant', {
        body: {
          department_id: departmentId,
          intent: 'chat',
          messages: newHistory,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages([...newHistory, { role: 'assistant', content: data.reply || '...' }]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no assistente', description: e?.message || 'Tente novamente.' });
      setMessages(newHistory); // keep user msg
    } finally {
      setSending(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

      const slots = FIXED_SLOTS.map(s => ({
        dayOfWeek: s.dayOfWeek,
        timeStart: s.timeStart,
        timeEnd: s.timeEnd,
        label: s.label,
        membersCount: s.defaultMembers,
      }));

      const { data, error } = await supabase.functions.invoke('ai-schedule-assistant', {
        body: {
          department_id: departmentId,
          intent: 'generate',
          messages,
          start_date: start,
          end_date: end,
          slots,
          member_ids_filter: memberFilter.length > 0 ? memberFilter : undefined,
          explicit_dates: explicitDates.length > 0
            ? explicitDates.map(d => format(d, 'yyyy-MM-dd'))
            : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: SuggestedSchedule[] = (data.schedules || []).map((s: any) => ({ ...s, selected: true }));
      if (list.length === 0) {
        toast({ variant: 'destructive', title: 'Nenhuma escala gerada', description: 'A IA não encontrou membros elegíveis. Verifique disponibilidades e bloqueios.' });
        return;
      }
      setSuggestions(list);
      setReasoning(data.reasoning || '');
      setResolvedRange(
        data.resolved_start_date && data.resolved_end_date
          ? { start: data.resolved_start_date, end: data.resolved_end_date }
          : null
      );
      setStep('review');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar', description: e?.message || 'Tente novamente.' });
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelection = (idx: number) =>
    setSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));

  const removeSlot = (idx: number) =>
    setSuggestions(prev => prev.filter((_, i) => i !== idx));

  const confirm = async () => {
    const selected = suggestions.filter(s => s.selected);
    if (selected.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhuma escala selecionada' });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const rows = selected.map(s => ({
        department_id: departmentId,
        user_id: s.user_id,
        date: s.date,
        time_start: s.time_start,
        time_end: s.time_end,
        created_by: user.id,
      }));
      const { data: inserted, error } = await supabase.from('schedules').insert(rows).select();
      if (error) throw error;

      if (sendNotifications && inserted) {
        const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const monthsShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const notifs = inserted.map((sch: any) => {
          const d = new Date(sch.date + 'T12:00:00');
          const shortDate = `${weekdays[d.getDay()]}, ${d.getDate()}/${monthsShort[d.getMonth()]}`;
          return {
            user_id: sch.user_id,
            department_id: departmentId,
            schedule_id: sch.id,
            type: 'schedule_assigned',
            message: `${shortDate} das ${sch.time_start.slice(0, 5)} às ${sch.time_end.slice(0, 5)}`,
            status: 'pending' as const,
          };
        });
        await supabase.from('notifications').insert(notifs);
      }

      toast({ title: 'Escalas criadas!', description: `${selected.length} escalas salvas com sucesso.` });
      onSchedulesCreated();
      onOpenChange(false);
    } catch (e: any) {
      const conflict = e?.message?.includes('Conflito');
      toast({
        variant: 'destructive',
        title: conflict ? 'Conflito de horário' : 'Erro ao salvar',
        description: e?.message || 'Não foi possível salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const memberColorMap = useMemo(() => {
    const unique = suggestions.reduce((acc, s) => {
      if (!acc.find(m => m.user_id === s.user_id)) acc.push({ id: s.user_id, user_id: s.user_id, profile: { name: s.name } });
      return acc;
    }, [] as any[]);
    return createExtendedMemberColorMap(unique);
  }, [suggestions]);

  const groupedByDate = suggestions.reduce((acc, s, idx) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push({ ...s, idx } as any);
    return acc;
  }, {} as Record<string, any[]>);

  const monthOptions = Array.from({ length: 5 }, (_, i) => {
    const d = addMonths(new Date(), i - 1);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: ptBR }) };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'review' ? (
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2" onClick={() => setStep('chat')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            ) : (
              <MessageSquareText className="w-5 h-5 text-primary" />
            )}
            {step === 'chat' ? 'Assistente de Escala IA' : 'Revisar Proposta'}
          </DialogTitle>
          <DialogDescription>
            {step === 'chat'
              ? 'Converse com a IA e clique em "Gerar escala" quando estiver pronto.'
              : 'Revise cada escala. Desmarque ou remova as que não quiser, depois confirme.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'chat' ? (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarFallback className={m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent'}>
                      {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <img src="/levi-icon.svg" className="w-4 h-4 rounded-sm animate-pulse" alt="LEVI" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_strong]:font-semibold">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-2">
                  <Avatar className="w-7 h-7"><AvatarFallback className="bg-accent"><img src="/levi-icon.svg" className="w-4 h-4 rounded-sm animate-pulse" alt="LEVI" /></AvatarFallback></Avatar>
                  <div className="bg-muted rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> pensando…
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Diga suas condições para a escala…"
                  rows={2}
                  className="resize-none"
                  disabled={sending || generating}
                />
                <Button onClick={send} size="icon" disabled={sending || generating || !input.trim()}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Members picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start gap-2 h-9 font-normal">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="truncate text-xs">
                        {memberFilter.length === 0
                          ? 'Todos os voluntários'
                          : `${memberFilter.length} selecionado(s)`}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <div className="p-2 border-b flex items-center justify-between">
                      <span className="text-xs font-medium">Filtrar voluntários</span>
                      {memberFilter.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setMemberFilter([])}>
                          Limpar
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="max-h-64">
                      <div className="p-2 space-y-1">
                        {allMembers.map(m => {
                          const checked = memberFilter.includes(m.user_id);
                          return (
                            <label key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  setMemberFilter(prev =>
                                    v ? [...prev, m.user_id] : prev.filter(x => x !== m.user_id)
                                  );
                                }}
                              />
                              <span className="text-sm">{m.name}</span>
                            </label>
                          );
                        })}
                        {allMembers.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">Sem voluntários</p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                {/* Calendar */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start gap-2 h-9 font-normal">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <span className="truncate text-xs">
                        {explicitDates.length === 0
                          ? 'Datas (opcional)'
                          : `${explicitDates.length} dia(s)`}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-2 border-b flex items-center justify-between">
                      <span className="text-xs font-medium">Escolher datas</span>
                      {explicitDates.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setExplicitDates([])}>
                          Limpar
                        </Button>
                      )}
                    </div>
                    <Calendar
                      mode="multiple"
                      selected={explicitDates}
                      onSelect={(d) => setExplicitDates(d || [])}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {(memberFilter.length > 0 || explicitDates.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {memberFilter.map(id => {
                    const m = allMembers.find(x => x.user_id === id);
                    if (!m) return null;
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 text-xs">
                        {m.name}
                        <button onClick={() => setMemberFilter(prev => prev.filter(x => x !== id))}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                  {explicitDates.map((d, i) => (
                    <Badge key={i} variant="outline" className="gap-1 text-xs">
                      {format(d, "dd/MM", { locale: ptBR })}
                      <button onClick={() => setExplicitDates(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}


              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">Mês padrão (usado se você não especificar datas no chat)</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={generating}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(o => (
                        <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={generate}
                  disabled={generating || sending}
                  className="sm:self-end gap-2"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src="/levi-icon.svg" className="w-4 h-4 rounded-sm" alt="LEVI" />}
                  Gerar escala
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
              {resolvedRange && (
                <Card className="p-3 bg-primary/5 text-xs">
                  <div className="font-semibold text-foreground">Período gerado</div>
                  <div className="text-muted-foreground capitalize">
                    {format(new Date(resolvedRange.start + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                    {resolvedRange.start !== resolvedRange.end && (
                      <> — {format(new Date(resolvedRange.end + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}</>
                    )}
                  </div>
                </Card>
              )}
              {reasoning && (
                <Card className="p-3 bg-muted/40 text-xs text-muted-foreground">
                  <div className="font-semibold mb-1 flex items-center gap-1 text-foreground">
                    <img src="/levi-icon.svg" className="w-3 h-3 rounded-sm" alt="LEVI" /> Raciocínio da IA
                  </div>
                  {reasoning}
                </Card>
              )}

              {Object.entries(groupedByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, items]) => {
                  const d = new Date(date + 'T12:00:00');
                  return (
                    <Card key={date} className="p-3">
                      <div className="font-semibold text-sm mb-2 capitalize">
                        {format(d, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </div>
                      <div className="space-y-1.5">
                        {items.map((s: any) => (
                          <div
                            key={s.idx}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-opacity ${
                              s.selected ? '' : 'opacity-40'
                            }`}
                            style={s.selected ? getMemberBackgroundStyle(memberColorMap, s.user_id) : undefined}
                          >
                            <Avatar className="w-7 h-7"><AvatarFallback className="text-xs">{initials(s.name)}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{s.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {s.slotLabel} • {s.time_start.slice(0, 5)}–{s.time_end.slice(0, 5)}
                              </div>
                            </div>
                            <Switch checked={s.selected} onCheckedChange={() => toggleSelection(s.idx)} />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSlot(s.idx)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2 sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="ai-notify" className="text-xs">Notificar WhatsApp</Label>
                <Switch id="ai-notify" checked={sendNotifications} onCheckedChange={setSendNotifications} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('chat')} disabled={saving}>Voltar</Button>
                <Button onClick={confirm} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmar {suggestions.filter(s => s.selected).length} escalas
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
