import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface FeatureCardProps {
  title: string;
  description: string;
  tags: string[];
  actionLabel: string;
  icon: LucideIcon;
  accent?: "blue" | "green";
  disabled?: boolean;
  onAction?: () => void;
}

export function FeatureCard({
  title,
  description,
  tags,
  actionLabel,
  icon: Icon,
  accent = "blue",
  disabled = false,
  onAction,
}: FeatureCardProps) {
  const isGreen = accent === "green";
  const actionClassName = isGreen ? "text-[#8FAE3D] hover:text-[#789633]" : "text-[#009BDF] hover:text-[#007DB5]";
  const iconColor = isGreen ? "text-[#8FAE3D]" : "text-[#009BDF]";
  const iconBackground = isGreen ? "bg-[#8FAE3D]/10" : "bg-[#4CC9F0]/12";
  const badgeClassName = isGreen
    ? "border-0 bg-[#8FAE3D]/10 px-3 py-1 text-[#637B28] hover:bg-[#8FAE3D]/15"
    : "border-0 bg-[#4CC9F0]/15 px-3 py-1 text-[#006FA8] hover:bg-[#4CC9F0]/20";

  return (
    <Card className="group h-full rounded-lg border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(11,31,58,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-[#4CC9F0]/70 hover:shadow-[0_18px_42px_rgba(11,31,58,0.14)]">
      <CardContent className="flex h-full flex-col p-6 sm:p-7">
        <div className="flex items-start gap-5">
          <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl ${iconBackground}`}>
            <Icon className={`h-9 w-9 ${iconColor}`} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 pt-1">
            <h2 className="text-2xl font-bold leading-tight text-[#0B1F3A]">{title}</h2>
            <p className="mt-2 max-w-[25rem] text-base leading-6 text-[#0B1F3A]/82">{description}</p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          {tags.map((tag) => (
            <Badge key={tag} className={badgeClassName}>
              {tag}
            </Badge>
          ))}
        </div>

        <div className="mt-7 border-t border-slate-200 pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={onAction}
            className={`h-auto w-full justify-between px-0 py-0 text-xl font-bold ${actionClassName} hover:bg-transparent disabled:cursor-default disabled:opacity-100`}
          >
            <span>{actionLabel}</span>
            {!disabled && <ArrowRight className="h-8 w-8 transition-transform duration-200 group-hover:translate-x-1" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
