import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Crown, 
  MoreVertical, 
  UserMinus, 
  Mail, 
  Phone,
  UserPlus,
  Shield,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createMemberColorMap, getMemberHexColor } from '@/lib/memberColors';

interface Member {
  id: string;
  user_id: string;
  role: 'leader' | 'member';
  joined_at: string;
  profile: {
    name: string;
    email: string;
    whatsapp: string;
    avatar_url: string | null;
  };
}

interface MemberContactInfo {
  [userId: string]: {
    email: string;
    whatsapp: string;
  };
}

interface MemberListProps {
  members: Member[];
  isLeader: boolean;
  currentUserId: string;
  departmentId: string;
  onMemberRemoved: () => void;
  onInviteMember: () => void;
}

export default function MemberList({
  members,
  isLeader,
  currentUserId,
  departmentId,
  onMemberRemoved,
  onInviteMember
}: MemberListProps) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [contactInfo, setContactInfo] = useState<MemberContactInfo>({});
  const { toast } = useToast();

  // Create color map once when members change
  const colorMap = useMemo(() => createMemberColorMap(members), [members]);

  // Get member color using centralized palette
  const getMemberColor = (userId: string): string => {
    return getMemberHexColor(colorMap, userId);
  };

  // Leaders can fetch contact info for members
  const fetchContactInfo = useCallback(async (userId: string) => {
    if (!isLeader || contactInfo[userId]) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_member_full_profile', { 
          member_user_id: userId, 
          dept_id: departmentId 
        });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setContactInfo(prev => ({
          ...prev,
          [userId]: {
            email: data[0].email,
            whatsapp: data[0].whatsapp
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching contact info:', error);
    }
  }, [isLeader, departmentId, contactInfo]);

  // Pre-fetch contact info for all members if leader
  useEffect(() => {
    if (isLeader && members.length > 0) {
      members.forEach(member => {
        if (!contactInfo[member.user_id]) {
          fetchContactInfo(member.user_id);
        }
      });
    }
  }, [isLeader, members, fetchContactInfo, contactInfo]);

  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === 'leader' && b.role !== 'leader') return -1;
    if (a.role !== 'leader' && b.role === 'leader') return 1;
    return a.profile.name.localeCompare(b.profile.name);
  });

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    
    setRemoving(true);
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', selectedMember.id);

      if (error) throw error;

      // Update subscription quantity after member removal
      try {
        await supabase.functions.invoke('update-subscription-quantity', {
          body: { departmentId },
        });
      } catch (subError) {
        console.error('Error updating subscription:', subError);
      }

      toast({
        title: 'Membro removido',
        description: `${selectedMember.profile.name} foi removido do departamento.`,
      });
      
      onMemberRemoved();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: 'Não foi possível remover o membro.',
      });
    } finally {
      setRemoving(false);
      setShowRemoveDialog(false);
      setSelectedMember(null);
    }
  };

  const handleContactWhatsApp = (whatsapp: string, name: string) => {
    const cleanNumber = whatsapp.replace(/\D/g, '');
    const url = `https://wa.me/${cleanNumber}?text=Olá ${name}!`;
    window.open(url, '_blank');
  };

  const handleContactEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Membros do Departamento
          </h2>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? 'membro' : 'membros'} no total
          </p>
        </div>
        {isLeader && (
          <Button onClick={onInviteMember} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Convidar
          </Button>
        )}
      </div>

      {/* Member Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedMembers.map((member) => {
          const isCurrentUser = member.user_id === currentUserId;
          const isMemberLeader = member.role === 'leader';
          const initials = member.profile.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          
          // Get contact info (only available for leaders)
          const memberContact = contactInfo[member.user_id];
          const hasContactAccess = isLeader && memberContact;

          return (
            <div
              key={member.id}
              className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors animate-fade-in"
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-12 h-12 border-2" style={{ borderColor: `${getMemberColor(member.user_id)}40` }}>
                  <AvatarFallback 
                    className="text-white font-medium"
                    style={{ backgroundColor: getMemberColor(member.user_id) }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">
                      {member.profile.name}
                    </h3>
                    {isMemberLeader && (
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-3 h-3 text-primary" />
                      </div>
                    )}
                    {isCurrentUser && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                        Você
                      </span>
                    )}
                  </div>
                  {hasContactAccess ? (
                    <p className="text-sm text-muted-foreground truncate">
                      {memberContact.email}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Contato protegido</span>
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span>{isMemberLeader ? 'Líder' : 'Membro'}</span>
                  </div>
                </div>

                {/* Actions Dropdown - Only show contact options if leader */}
                {isLeader && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {hasContactAccess && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleContactWhatsApp(memberContact.whatsapp, member.profile.name)}
                          >
                            <Phone className="w-4 h-4 mr-2" />
                            WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleContactEmail(memberContact.email)}
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Email
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {!isMemberLeader && !isCurrentUser && (
                        <>
                          {hasContactAccess && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setSelectedMember(member);
                              setShowRemoveDialog(true);
                            }}
                          >
                            <UserMinus className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Entrou em {new Date(member.joined_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {members.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            Nenhum membro ainda
          </h3>
          <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
            Convide pessoas para participar do seu departamento.
          </p>
          {isLeader && (
            <Button onClick={onInviteMember}>
              <UserPlus className="w-4 h-4 mr-2" />
              Convidar Membros
            </Button>
          )}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{selectedMember?.profile.name}</strong>{' '}
              do departamento? Esta pessoa perderá acesso às escalas e precisará de um novo convite para entrar novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
