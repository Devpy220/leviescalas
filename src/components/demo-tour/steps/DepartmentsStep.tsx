import { Users, Crown } from 'lucide-react';
import { mockDepartments } from '../tourSteps';

export function DepartmentsStep() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {mockDepartments.map((dept, i) => (
        <div 
          key={i}
          className={`p-4 rounded-xl bg-gradient-to-br ${
            dept.color === 'violet' 
              ? 'from-violet-500/10 to-violet-600/5 border-violet-500/20' 
              : 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20'
          } border`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              dept.color === 'violet' ? 'icon-violet' : 'icon-emerald'
            }`}>
              <Users className="w-4 h-4" />
            </div>
            {dept.isLeader && <Crown className="w-4 h-4 text-primary" />}
          </div>
          <p className="font-medium text-sm">{dept.name}</p>
          <p className="text-xs text-muted-foreground">{dept.members} membros</p>
        </div>
      ))}
    </div>
  );
}
