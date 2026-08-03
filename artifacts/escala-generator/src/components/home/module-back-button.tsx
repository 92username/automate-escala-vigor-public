import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModuleBackButtonProps {
  onBackHome: () => void;
  label?: string;
  className?: string;
}

export function ModuleBackButton({
  onBackHome,
  label = "Voltar ao painel",
  className = "",
}: ModuleBackButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={onBackHome}
      className={`w-fit px-0 text-[#009BDF] hover:bg-transparent hover:text-[#007DB5] ${className}`}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
