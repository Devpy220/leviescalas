import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { slugify } from '@/lib/slugify';

export default function DepartmentBySlug() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading before making any decisions
    if (authLoading) return;
    
    // Give a small delay to ensure session is fully established
    const timeoutId = setTimeout(() => {
      if (!user) {
        navigate('/auth');
        return;
      }
      findDepartmentBySlug();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [slug, user, authLoading]);

  const findDepartmentBySlug = async () => {
    if (!user || !slug) return;

    try {
      // First check if user is leader of any department matching the slug
      const { data: leaderDepts } = await supabase
        .from('departments')
        .select('id, name')
        .eq('leader_id', user.id);

      if (leaderDepts) {
        const match = leaderDepts.find(d => slugify(d.name) === slug);
        if (match) {
          navigate(`/departments/${match.id}`, { replace: true });
          return;
        }
      }

      // Check member departments using RPC
      const { data: memberRelations } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', user.id);

      if (memberRelations) {
        for (const relation of memberRelations) {
          const { data: deptData } = await supabase
            .rpc('get_department_basic', { dept_id: relation.department_id });

          if (deptData && deptData.length > 0 && slugify(deptData[0].name) === slug) {
            navigate(`/departments/${relation.department_id}`, { replace: true });
            return;
          }
        }
      }

      // Not found, go to dashboard
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error finding department:', error);
      navigate('/dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return null;
}
