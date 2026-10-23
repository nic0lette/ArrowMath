import React from 'react';
import { motion } from 'motion/react';
import { CardGroupData, ColorTheme } from '../types/math';
import { ArrowCardSvg } from './ArrowCardSvg';
import { getCardWidth, numberToWords } from '../utils/mathHelpers';
import { sound } from '../utils/audio';
import {
  Maximize2,
  Minimize2,
  Unlink,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface CardGroupItemProps {
  group: CardGroupData;
  theme: ColorTheme;
  isSelected: boolean;
  isSnapTarget?: boolean;
  isBounceTarget?: boolean;
  onSelect: (groupId: string) => void;
  onDragStart: (group: CardGroupData) => void;
  onDrag: (group: CardGroupData, currentX: number, currentY: number) => void;
  onDragEnd: (group: CardGroupData, finalX: number, finalY: number) => void;
  onToggleExpand: (groupId: string) => void;
  onToggleXRay: (groupId: string) => void;
  onUngroup: (groupId: string) => void;
  onDuplicate: (group: CardGroupData) => void;
  onDelete: (groupId: string) => void;
}

export const CardGroupItem: React.FC<CardGroupItemProps> = ({
  group,
  theme,
  isSelected,
  isSnapTarget = false,
  isBounceTarget = false,
  onSelect,
  onDragStart,
  onDrag,
  onDragEnd,
  onToggleExpand,
  onToggleXRay,
  onUngroup,
  onDuplicate,
  onDelete,
}) => {
  // Sort cards descending by place value (1000 -> 100 -> 10 -> 1)
  const sortedCards = [...group.cards].sort((a, b) => b.place - a.place);

  // Total numerical value
  const totalValue = sortedCards.reduce((acc, c) => acc + c.value, 0);

  // Stacked geometry:
  // The largest card dictates the stack width (all cards align to the right arrow tip)
  const maxStackWidth = Math.max(...sortedCards.map((c) => getCardWidth(c.place)));

  // Calculate layout coordinates for expanded mode
  let runningX = 0;
  const expandedPositions: { cardX: number; plusX?: number; cardWidth: number }[] = [];

  sortedCards.forEach((c, idx) => {
    const w = getCardWidth(c.place);
    const cardX = runningX;
    runningX += w;

    let plusX: number | undefined = undefined;
    if (idx < sortedCards.length - 1) {
      plusX = runningX + 6;
      runningX += 32; // Gap for the plus operator
    }

    expandedPositions.push({ cardX, plusX, cardWidth: w });
  });

  const totalExpandedWidth = runningX;

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={false}
      animate={{ scale: 1, opacity: 1, x: group.x, y: group.y }}
      transition={{ type: 'spring', damping: 28, stiffness: 360 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: isSelected ? 120 : group.zIndex,
        cursor: 'grab',
      }}
      whileDrag={{
        scale: 1.02,
        rotate: -1,
        cursor: 'grabbing',
        zIndex: 999,
        transition: { duration: 0.1 },
      }}
      onPointerDown={() => {
        sound.playPickUp();
        onSelect(group.id);
      }}
      onDragStart={() => onDragStart(group)}
      onDrag={(_event, info) => {
        onDrag(group, group.x + info.offset.x, group.y + info.offset.y);
      }}
      onDragEnd={(_event, info) => {
        onDragEnd(group, group.x + info.offset.x, group.y + info.offset.y);
      }}
      className="group touch-none select-none"
    >
      <div className="relative">
        {/* Snap target glowing halo */}
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

        {/* Floating toolbar for the group */}
        <div
          className={`absolute -top-10 left-0 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-md border border-slate-200 transition-opacity duration-150 z-50 ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {/* Toggle Expand / Stack */}
          <button
            type="button"
            title={group.isExpanded ? 'Stack Cards (Combine)' : 'Expand Cards (Partition)'}
            onClick={(e) => {
              e.stopPropagation();
              if (group.isExpanded) {
                sound.playSnap();
              } else {
                sound.playExpand();
              }
              onToggleExpand(group.id);
            }}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer transition-colors"
          >
            {group.isExpanded ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span>Stack</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                <span>Expand</span>
              </>
            )}
          </button>

          {/* X-Ray Mode (reveals the hidden zeros in stacked mode) */}
          {!group.isExpanded && (
            <button
              type="button"
              title={group.showXRay ? 'Hide Underlying Zeros' : 'X-Ray Zeros (Peek underneath)'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleXRay(group.id);
              }}
              className={`p-1 rounded cursor-pointer transition-colors ${
                group.showXRay
                  ? 'text-amber-700 bg-amber-50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {group.showXRay ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Ungroup */}
          <button
            type="button"
            title="Separate Cards (Ungroup)"
            onClick={(e) => {
              e.stopPropagation();
              sound.playExpand();
              onUngroup(group.id);
            }}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate */}
          <button
            type="button"
            title="Duplicate Number"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(group);
            }}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            type="button"
            title="Remove Group"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(group.id);
            }}
            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Group Canvas Container */}
        <div
          style={{
            width: group.isExpanded ? totalExpandedWidth + 80 : maxStackWidth,
            height: 72,
            position: 'relative',
          }}
        >
          {sortedCards.map((card, idx) => {
            const cardWidth = getCardWidth(card.place);
            // In stacked mode: right edges align! cardX = maxStackWidth - cardWidth
            const stackedX = maxStackWidth - cardWidth;
            const expandedX = expandedPositions[idx]?.cardX ?? 0;
            const targetX = group.isExpanded ? expandedX : stackedX;

            // Z-index: lower place values (ones) sit on TOP of higher place values (thousands) in stacked mode
            const stackingZ =
              card.place === 1000 ? 1 : card.place === 100 ? 2 : card.place === 10 ? 3 : 4;

            // If X-Ray is active in stacked mode, top cards become slightly translucent
            const cardOpacity =
              !group.isExpanded && group.showXRay
                ? card.place === 1000
                  ? 1
                  : 0.88
                : 1;

            return (
              <motion.div
                key={card.id}
                initial={false}
                animate={{
                  x: targetX,
                  y: 0,
                  opacity: cardOpacity,
                }}
                transition={{
                  type: 'spring',
                  damping: 26,
                  stiffness: 300,
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: stackingZ,
                }}
              >
                <ArrowCardSvg
                  place={card.place}
                  digit={card.digit}
                  theme={theme}
                  highlight={isSelected || isSnapTarget}
                  showZeroGhost={!group.isExpanded && group.showXRay}
                />
              </motion.div>
            );
          })}

          {/* Plus signs in expanded mode */}
          {group.isExpanded &&
            expandedPositions.map((pos, idx) => {
              if (pos.plusX === undefined) return null;
              return (
                <motion.div
                  key={`plus-${idx}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, x: pos.plusX, y: 18 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 10,
                  }}
                  className="font-bold text-slate-400 text-2xl select-none"
                >
                  +
                </motion.div>
              );
            })}

          {/* Equals sign and total in expanded mode */}
          {group.isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: runningX + 6 }}
              animate={{ opacity: 1, x: runningX + 6, y: 16 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 10,
              }}
              className="flex items-center gap-2 select-none"
            >
              <span className="font-bold text-slate-400 text-2xl">=</span>
              <span className="font-bold text-slate-900 text-2xl font-mono tracking-tight bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {totalValue.toLocaleString()}
              </span>
            </motion.div>
          )}
        </div>

        {/* Small subtitle with number word under stacked group */}
        {!group.isExpanded && (
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
            <span className="font-mono text-slate-800 font-semibold">
              {totalValue.toLocaleString()}
            </span>
            <span className="text-slate-400 capitalize truncate max-w-[170px] text-right">
              {numberToWords(totalValue)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
