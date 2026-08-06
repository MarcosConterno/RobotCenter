import { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: "blue" | "green" | "yellow" | "red";
  subtitle?: string;
}

const colors = {
  blue: {
    border: "border-blue-500/20",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  green: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  yellow: {
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
  },
  red: {
    border: "border-red-500/20",
    bg: "bg-red-500/10",
    text: "text-red-400",
  },
};

export default function StatCard({
  title,
  value,
  icon,
  subtitle,
  color = "blue",
}: StatCardProps) {
  const style = colors[color];

  return (
    <div
      className={`
        group
        rounded-2xl
        border
        ${style.border}
        bg-[#151924]
        p-5
        transition-all
        duration-300
        hover:-translate-y-1
        hover:shadow-xl
      `}
    >
      <div className="flex items-start justify-between">
        <div
          className={`
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-xl
            ${style.bg}
            ${style.text}
          `}
        >
          {icon}
        </div>

        <ArrowUpRight
          size={18}
          className="text-slate-500 transition group-hover:text-white"
        />
      </div>

      <div className="mt-6">
        <p className="text-sm text-slate-400">{title}</p>

        <h2 className="mt-2 text-3xl font-bold text-white">
          {value}
        </h2>

        {subtitle && (
          <p className="mt-2 text-xs text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}