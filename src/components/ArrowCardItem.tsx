import React from 'react';
import { motion } from 'motion/react';
import { ArrowCardData, ColorTheme } from '../types/math';
import { ArrowCardSvg } from './ArrowCardSvg';
import { sound } from '../utils/audio';
import { Copy, Trash2, Sparkles, AlertTriangle } from 'lucide-react';

interface ArrowCardItemProps {
  card: ArrowCardData;
  theme: ColorTheme;
  isSelected: boolean;
  isSnapTarget?: boolean;
  isBounceTarget?: boolean;
  onSelect: (cardId: string) => void;
  onDragStart: (card: ArrowCardData) => void;
  onDrag: (card: ArrowCardData, currentX: number, currentY: number) => void;
  onDragEnd: (card: ArrowCardData, finalX: number, finalY: number) => void;
  onDuplicate: (card: ArrowCardData) => void;
  onDelete: (cardId: string) => void;
}

export const ArrowCardItem: React.FC<ArrowCardItemProps> = ({
  card,
  theme,
  isSelected,
  isSnapTarget = false,
  isBounceTarget = false,
  onSelect,
  onDragStart,
  onDrag,
  onDragEnd,
  onDuplicate,
  onDelete,
}) => {
  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={false}
      animate={{ scale: 1, opacity: 1, x: card.x, y: card.y }}
      transition={{ type: 'spring', damping: 26, stiffness: 350 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: isSelected ? 100 : card.zIndex,
        cursor: 'grab',
      }}
      whileDrag={{
        scale: 1.04,
        rotate: -1.5,
        cursor: 'grabbing',
        zIndex: 999,
        transition: { duration: 0.1 },
      }}
      onPointerDown={() => {
        sound.playPickUp();
        onSelect(card.id);
      }}
      onDragStart={() => onDragStart(card)}
      onDrag={(_event, info) => {
        onDrag(card, card.x + info.offset.x, card.y + info.offset.y);
      }}
      onDragEnd={(_event, info) => {
        onDragEnd(card, card.x + info.offset.x, card.y + info.offset.y);
      }}
      className="group touch-none"
    >
      <div className="relative">
        {/* Snap Target Halo */}
        {isSnapTarget && (
          <div className="absolute -inset-2 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-500/10 animate-pulse pointer-events-none z-40 flex items-start justify-center -top-7">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Snap Together
            </span>
          </div>
        )}

        {/* Bounce Target Warning Halo */}
        {isBounceTarget && (
          <div className="absolute -inset-2 rounded-2xl border-2 border-dashed border-amber-500 bg-amber-500/10 animate-pulse pointer-events-none z-40 flex items-start justify-center -top-7">
            <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Same Place (Bounces)
            </span>
          </div>
        )}

        <ArrowCardSvg
          place={card.place}
          digit={card.digit}
          theme={theme}
          highlight={isSelected || isSnapTarget}
        />

        {/* Quick action buttons on hover / selected */}
        <div
          className={`absolute -top-7 right-0 flex items-center gap-1 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded-md shadow-sm border border-slate-200 transition-opacity duration-150 ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            type="button"
            title="Duplicate Card"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(card);
            }}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Remove Card"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
