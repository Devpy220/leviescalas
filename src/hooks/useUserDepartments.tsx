import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserDepartment {
  id: string;
  name: string;
  role: 'leader' | 'coleader' | 'member' | 'coordinator';
  church_name?: string | null;
  church_logo_url?: string | null;
  avatar_url?: string | null;
}

export function useUserDepartments() {
  const { user, session, loading: authLoading } = useAuth();
  const currentUser = user ?? session?.user ?? null;
  const [departments, setDepartments] = useState<UserDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userWhatsapp, setUserWhatsapp] = useState('');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email, avatar_url, whatsapp')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profile) {
          setUserName(profile.name || '');
          setUserEmail(profile.email || '');
          setUserWhatsapp(profile.whatsapp || '');
          setUserAvatarUrl(profile.avatar_url);
        }

        // Fetch member relations with department info
        const { data: memberData } = await supabase
          .from('members')
          .select('department_id, role, departments(id, name, avatar_url, church_id)')
          .eq('user_id', currentUser.id);

        // Note: don't early return if memberData is empty — user may be coordinator only
        const memberRows = memberData || [];

        // Also check leader departments (direct ownership)
        const { data: leaderDepts } = await supabase
          .from('departments')
          .select('id, name, avatar_url, church_id')
          .eq('leader_id', currentUser.id);

        // Coordinator departments
        const { data: coordRows } = await (supabase as any)
          .from('department_coordinators')
          .select('department_id')
          .eq('user_id', currentUser.id);

        const coordDeptIds = ((coordRows || []) as Array<{ department_id: string }>).map(r => r.department_id);
        let coordDepts: Array<{ id: string; name: string; avatar_url: string | null; church_id: string | null }> = [];
        if (coordDeptIds.length > 0) {
          const { data: cd } = await supabase
            .from('departments')
            .select('id, name, avatar_url, church_id')
            .in('id', coordDeptIds);
          coordDepts = (cd || []) as any;
        }

        // Gather all church IDs
        const allChurchIds = new Set<string>();
        memberRows.forEach(m => {
          const dept = m.departments as any;
          if (dept?.church_id) allChurchIds.add(dept.church_id);
        });
        (leaderDepts || []).forEach(d => {
          if (d.church_id) allChurchIds.add(d.church_id);
        });
        coordDepts.forEach(d => {
          if (d.church_id) allChurchIds.add(d.church_id);
        });

        const churchMap: Record<string, { name: string; logo_url: string | null }> = {};
        if (allChurchIds.size > 0) {
          const { data: churches } = await supabase
            .from('churches')
            .select('id, name, logo_url')
            .in('id', Array.from(allChurchIds));
          
          churches?.forEach(c => {
            churchMap[c.id] = { name: c.name, logo_url: c.logo_url };
          });
        }

        // Build departments list
        const deptMap = new Map<string, UserDepartment>();

        // Leader departments first
        (leaderDepts || []).forEach(d => {
          deptMap.set(d.id, {
            id: d.id,
            name: d.name,
            role: 'leader',
            avatar_url: d.avatar_url,
            church_name: d.church_id ? churchMap[d.church_id]?.name : null,
            church_logo_url: d.church_id ? churchMap[d.church_id]?.logo_url : null,
          });
        });

        // Member departments (don't override leader role)
        memberRows.forEach(m => {
          const dept = m.departments as any;
          if (!dept) return;
          if (deptMap.has(dept.id)) {
            if (m.role === 'leader') {
              const existing = deptMap.get(dept.id)!;
              existing.role = 'leader';
            }
            return;
          }
          deptMap.set(dept.id, {
            id: dept.id,
            name: dept.name,
            role: m.role as 'leader' | 'coleader' | 'member',
            avatar_url: dept.avatar_url,
            church_name: dept.church_id ? churchMap[dept.church_id]?.name : null,
            church_logo_url: dept.church_id ? churchMap[dept.church_id]?.logo_url : null,
          });
        });

        // Coordinator departments (lowest priority — don't override leader/member)
        coordDepts.forEach(d => {
          if (deptMap.has(d.id)) return;
          deptMap.set(d.id, {
            id: d.id,
            name: d.name,
            role: 'coordinator',
            avatar_url: d.avatar_url,
            church_name: d.church_id ? churchMap[d.church_id]?.name : null,
            church_logo_url: d.church_id ? churchMap[d.church_id]?.logo_url : null,
          });
        });

        setDepartments(Array.from(deptMap.values()));
      } catch (error) {
        console.error('Error fetching user departments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser?.id, authLoading]);

  const leaderDepartments = departments.filter(d => d.role === 'leader');
  const isLeader = leaderDepartments.length > 0;

  return {
    departments,
    leaderDepartments,
    isLeader,
    loading,
    userName,
    userEmail,
    userWhatsapp,
    userAvatarUrl,
    currentUser,
  };
}
