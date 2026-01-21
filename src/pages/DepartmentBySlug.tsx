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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading (ProtectedRoute ensures user exists)
    if (authLoading) return;
    
    if (user) {
      findDepartmentBySlug();
    }
  }, [slug, user, authLoading]);

  const findDepartmentBySlug = async () => {
    if (!user || !slug) {
      setError('Dados inválidos');
      setLoading(false);
      return;
    }

    try {
      // First check if user is leader of any department matching the slug
      const { data: leaderDepts, error: leaderError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('leader_id', user.id);

      if (leaderError) {
        console.error('Error fetching leader departments:', leaderError);
      }

      if (leaderDepts) {
        const match = leaderDepts.find(d => slugify(d.name) === slug);
        if (match) {
          navigate(`/departments/${match.id}`, { replace: true });
          return;
        }
      }

      // Check member departments
      const { data: memberRelations, error: memberError } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', user.id);

      if (memberError) {
        console.error('Error fetching member relations:', memberError);
      }

      if (memberRelations && memberRelations.length > 0) {
        for (const relation of memberRelations) {
          const { data: deptData, error: deptError } = await supabase
            .rpc('get_department_basic', { dept_id: relation.department_id });

          if (deptError) {
            console.error('Error fetching department:', deptError);
            continue;
          }

          if (deptData && deptData.length > 0 && slugify(deptData[0].name) === slug) {
            navigate(`/departments/${relation.department_id}`, { replace: true });
            return;
          }
        }
      }

      // Not found - show error instead of redirecting
      setError('Departamento não encontrado ou você não tem acesso.');
    } catch (error) {
      console.error('Error finding department:', error);
      setError('Erro ao buscar departamento.');
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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">{error}</p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-primary hover:underline"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  return null;
}
