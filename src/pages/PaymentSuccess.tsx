import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowLeft } from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="max-w-md w-full border-2 border-green-500/30">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Obrigado pelo apoio!</h1>
            <p className="text-muted-foreground">
              Sua contribuição ajuda a manter o Levi Escalas gratuito para todos. Deus abençoe!
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
