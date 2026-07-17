import { Link, useNavigate } from "react-router-dom";
import { Calendar, Baby, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeviLogo } from "@/components/LeviLogo";

export default function ChooseApp() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><LeviLogo /></div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Onde você quer entrar?</h1>
          <p className="text-slate-600 mt-2">Você tem acesso ao LEVI Escalas e ao LeviKids.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <button onClick={() => navigate("/dashboard")} className="text-left group">
            <Card className="border-2 border-violet-200 hover:border-violet-500 transition-all rounded-3xl h-full">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center mb-4">
                  <Calendar className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">LEVI Escalas</h2>
                <p className="text-sm text-slate-600 mb-4">Escalas, departamentos, repertório e voluntários.</p>
                <span className="inline-flex items-center gap-1 text-violet-700 font-semibold text-sm">
                  Entrar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/kids")} className="text-left group">
            <Card className="border-2 border-amber-200 hover:border-amber-500 transition-all rounded-3xl h-full">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-4">
                  <Baby className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold mb-1"><LeviKidsWordmark /></h2>
                <p className="text-sm text-slate-600 mb-4">Ministério infantil: check-in por QR e retirada segura.</p>
                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-sm">
                  Entrar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </CardContent>
            </Card>
          </button>
        </div>

        <div className="text-center mt-6">
          <Button variant="ghost" asChild><Link to="/dashboard">Pular e ir para o Escalas</Link></Button>
        </div>
      </div>
    </div>
  );
}
