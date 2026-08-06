import {
  Bot,
  Rocket,
  Wrench,
  AlertTriangle,
} from "lucide-react";

type FeedType =
  | "robot"
  | "release"
  | "fix"
  | "incident";

interface FeedCardProps {
  type: FeedType;
  title: string;
  description: string;
  robot: string;
  environment: string;
  publishedAt: string;
}

const config = {
  robot: {
    icon: Bot,
    color: "bg-blue-500/15 text-blue-400",
    badge: "Novo Robô",
  },

  release: {
    icon: Rocket,
    color: "bg-green-500/15 text-green-400",
    badge: "Nova Versão",
  },

  fix: {
    icon: Wrench,
    color: "bg-yellow-500/15 text-yellow-400",
    badge: "Correção",
  },

  incident: {
    icon: AlertTriangle,
    color: "bg-red-500/15 text-red-400",
    badge: "Incidente",
  },
};

export default function FeedCard({
  type,
  title,
  description,
  robot,
  environment,
  publishedAt,
}: FeedCardProps) {
  const item = config[type];
  const Icon = item.icon;

  return (
    <article className="rounded-xl border border-slate-700 bg-slate-800 p-6 transition hover:border-blue-500">

      <div className="mb-5 flex items-center gap-4">

        <div
          className={`rounded-xl p-3 ${item.color}`}
        >
          <Icon size={22} />
        </div>

        <div>

          <span className="text-sm text-slate-400">

            {item.badge}

          </span>

          <h3 className="text-xl font-semibold text-white">

            {title}

          </h3>

        </div>

      </div>

      <p className="mb-6 text-slate-300">

        {description}

      </p>

      <div className="flex gap-10 text-sm">

        <div>

          <div className="text-slate-500">

            Robô

          </div>

          <div className="text-white">

            {robot}

          </div>

        </div>

        <div>

          <div className="text-slate-500">

            Ambiente

          </div>

          <div className="text-white">

            {environment}

          </div>

        </div>

        <div>

          <div className="text-slate-500">

            Publicado

          </div>

          <div className="text-white">

            {publishedAt}

          </div>

        </div>

      </div>

    </article>
  );
}