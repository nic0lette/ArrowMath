import React from 'react';
import { X, Check } from 'lucide-react';
import { ArrowCardSvg } from './ArrowCardSvg';

interface PedagogyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PedagogyHelpModal: React.FC<PedagogyHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Understanding Place Value Arrow Cards
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              How Arrow Cards make decimal numbers and partitioning intuitive
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
          {/* Section 1: The Core Idea */}
          <div>
            <h3 className="font-semibold text-slate-900 text-base mb-2">
              1. The "Right Arrow" Geometry
            </h3>
            <p className="text-slate-600 mb-3">
              Notice that every card ends in an arrow tip on the right. When you
              stack cards by aligning their right arrow points, the smaller place
              values physically cover up the trailing zeros of the larger place
              values:
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-500">
                  Expanded Form:
                </span>
                <span className="font-mono font-bold text-slate-800">
                  4,000 + 300 + 20 + 5
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-500">
                  Combined Stack:
                </span>
                <span className="font-mono font-bold text-blue-700 text-lg">
                  4,325
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Visual Card Demonstration */}
          <div>
            <h3 className="font-semibold text-slate-900 text-base mb-2">
              2. Place Value Card Hierarchy
            </h3>
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Thousands (4 slots + arrow)
                </span>
                <div className="transform scale-90 origin-right">
                  <ArrowCardSvg place={1000} digit={4} theme="curriculum" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Hundreds (3 slots + arrow)
                </span>
                <div className="transform scale-90 origin-right">
                  <ArrowCardSvg place={100} digit={3} theme="curriculum" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Tens (2 slots + arrow)
                </span>
                <div className="transform scale-90 origin-right">
                  <ArrowCardSvg place={10} digit={2} theme="curriculum" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Ones (1 slot + arrow)
                </span>
                <div className="transform scale-90 origin-right">
                  <ArrowCardSvg place={1} digit={5} theme="curriculum" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Key Interactions */}
          <div>
            <h3 className="font-semibold text-slate-900 text-base mb-2">
              3. Interactive Features on Workbench
            </h3>
            <ul className="space-y-2 text-slate-600 text-xs">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Overlap Snapping:</strong> Drag cards so they physically
                  overlap. Compatible place values snap together cleanly!
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Place Value Protection:</strong> Dropping cards of the
                  same place value on top of each other (like a 4 onto an 8)
                  bounces the card away, preventing duplicate columns!
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Expand / Stack Toggle:</strong> Click{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">
                    Expand
                  </code>{' '}
                  on any combined number to slide the cards apart into addition
                  form, or{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">
                    Stack
                  </code>{' '}
                  to assemble.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>X-Ray Mode:</strong> Click the eye icon on a stacked
                  number to reveal the zeros resting underneath each card!
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Drag from Bank:</strong> You can drag any card directly
                  from the bottom tray right onto the workbench canvas.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg cursor-pointer transition-colors"
          >
            Got it, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
};
