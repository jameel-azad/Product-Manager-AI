import { Inbox } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: EmptyStateAction;
}

export default function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-800/60 border border-slate-700 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-slate-500" />
      </div>

      <h3 className="text-base font-semibold text-slate-200 mb-1">{title}</h3>

      <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f172a]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
