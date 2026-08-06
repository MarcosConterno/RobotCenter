import { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

export default function SectionCard({
  title,
  children,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151924] p-6">
      {title && (
        <h3 className="mb-5 text-lg font-semibold text-white">
          {title}
        </h3>
      )}

      {children}
    </div>
  );
}