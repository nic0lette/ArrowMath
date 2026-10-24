import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowCardData, CardGroupData, ColorTheme } from './types/math';
import {
  createCard,
  decomposeNumber,
  getCardWidth,
  CARD_HEIGHT,
  snapPosition,
  snapToGrid,
} from './utils/mathHelpers';
import { sound } from './utils/audio';
import { ArrowCardItem } from './components/ArrowCardItem';
import { CardGroupItem } from './components/CardGroupItem';
import { CardBank } from './components/CardBank';
import { Toolbar } from './components/Toolbar';
import { PedagogyHelpModal } from './components/PedagogyHelpModal';
import { ArrowCardSvg } from './components/ArrowCardSvg';
import { Move } from 'lucide-react';

interface DraggingBankCard {
  place: 1000 | 100 | 10 | 1;
  digit: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isDragging: boolean;
}

// 2D bounding box intersection: strictly detects physical overlap
function getBoxOverlap(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): { isOverlapping: boolean; overlapX: number; overlapY: number } {
  const overlapX = Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2);
  const overlapY = Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2);
  const isOverlapping = overlapX >= 10 && overlapY >= 10;
  return {
    isOverlapping,
    overlapX: Math.max(0, overlapX),
    overlapY: Math.max(0, overlapY),
  };
}

// Calculate bounce destination away from target when same place value cards collide
function calculateBouncePosition(
  x1: number,
  y1: number,
  w1: number,
  targetX: number,
  targetY: number,
  targetW: number,
  containerW: number,
  containerH: number
): { bounceX: number; bounceY: number } {
  const cx1 = x1 + w1 / 2;
  const cy1 = y1 + CARD_HEIGHT / 2;
  const cx2 = targetX + targetW / 2;
  const cy2 = targetY + CARD_HEIGHT / 2;

  const dx = cx1 - cx2;
  const dy = cy1 - cy2;

  let bounceX = x1;
  let bounceY = y1;

  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy >= 0) {
      bounceY = targetY + CARD_HEIGHT + 28;
    } else {
      bounceY = targetY - CARD_HEIGHT - 28;
    }
    if (Math.abs(dx) < 15) {
      bounceX = x1 + (dx >= 0 ? 30 : -30);
    }
  } else {
    if (dx >= 0) {
      bounceX = targetX + targetW + 28;
    } else {
      bounceX = targetX - w1 - 28;
    }
    if (Math.abs(dy) < 15) {
      bounceY = y1 + (dy >= 0 ? 30 : -30);
    }
  }

  // Clamping and boundary checks so card stays visible and avoids bouncing back onto target
  if (bounceY < 20) {
    bounceY = targetY + CARD_HEIGHT + 28;
  } else if (bounceY > containerH - CARD_HEIGHT - 20) {
    bounceY = Math.max(20, targetY - CARD_HEIGHT - 28);
  }

  if (bounceX < 20) {
    bounceX = targetX + targetW + 28;
  } else if (bounceX > containerW - w1 - 20) {
    bounceX = Math.max(20, targetX - w1 - 28);
  }

  return {
    bounceX: Math.max(20, Math.min(containerW - w1 - 20, Math.round(bounceX))),
    bounceY: Math.max(20, Math.min(containerH - CARD_HEIGHT - 20, Math.round(bounceY))),
  };
}

export default function App() {
  const [cards, setCards] = useState<ArrowCardData[]>([]);
  const [groups, setGroups] = useState<CardGroupData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ColorTheme>('curriculum');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isGridSnapEnabled, setIsGridSnapEnabled] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [snapCandidateId, setSnapCandidateId] = useState<string | null>(null);
  const [bounceCandidateId, setBounceCandidateId] = useState<string | null>(null);
  const [draggingBankCard, setDraggingBankCard] = useState<DraggingBankCard | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Snap a coordinate / position to the workbench grid when enabled.
  const snapCoord = useCallback(
    (value: number) => (isGridSnapEnabled ? snapToGrid(value) : value),
    [isGridSnapEnabled]
  );

  const snapPoint = useCallback(
    (x: number, y: number) =>
      isGridSnapEnabled ? snapPosition(x, y) : { x, y },
    [isGridSnapEnabled]
  );

  // Initialize with initial pedagogical example (e.g. 3000, 400, 20, 5)
  useEffect(() => {
    const c1 = createCard(1000, 3, snapToGrid(100), snapToGrid(160));
    const c2 = createCard(100, 4, snapToGrid(390), snapToGrid(160));
    const c3 = createCard(10, 2, snapToGrid(620), snapToGrid(160));
    const c4 = createCard(1, 5, snapToGrid(790), snapToGrid(160));
    setCards([c1, c2, c3, c4]);
    setSelectedId(c1.id);
  }, []);

  // Update sound mute state
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sound.setMuted(next);
  };

  // Toggle grid snapping on/off
  const handleToggleGridSnap = () => {
    setIsGridSnapEnabled((prev) => !prev);
  };

  // Add individual card from bank (on click)
  const handleAddCard = (place: 1000 | 100 | 10 | 1, digit: number) => {
    sound.playPickUp();
    const startX = snapCoord(120 + Math.random() * 140);
    const startY = snapCoord(140 + Math.random() * 100);
    const newCard = createCard(place, digit, startX, startY);
    setCards((prev) => [...prev, newCard]);
    setSelectedId(newCard.id);
  };

  // Build full number
  const handleBuildFullNumber = (num: number, asStacked: boolean) => {
    const { thousands, hundreds, tens, ones } = decomposeNumber(num);
    const created: ArrowCardData[] = [];

    const baseX = snapCoord(120 + Math.random() * 80);
    const baseY = snapCoord(160 + Math.random() * 80);

    let currentX = baseX;
    if (thousands > 0) {
      const c = createCard(1000, thousands, snapCoord(currentX), baseY);
      created.push(c);
      currentX += getCardWidth(1000) + 20;
    }
    if (hundreds > 0) {
      const c = createCard(100, hundreds, snapCoord(currentX), baseY);
      created.push(c);
      currentX += getCardWidth(100) + 20;
    }
    if (tens > 0) {
      const c = createCard(10, tens, snapCoord(currentX), baseY);
      created.push(c);
      currentX += getCardWidth(10) + 20;
    }
    if (ones > 0) {
      const c = createCard(1, ones, snapCoord(currentX), baseY);
      created.push(c);
      currentX += getCardWidth(1) + 20;
    }

    if (created.length === 0) return;

    if (asStacked && created.length > 1) {
      const newGroup: CardGroupData = {
        id: `group-${Date.now()}`,
        cards: created,
        x: baseX,
        y: baseY,
        zIndex: 100,
        isExpanded: false,
        showXRay: false,
      };
      setGroups((prev) => [...prev, newGroup]);
      setSelectedId(newGroup.id);
    } else {
      setCards((prev) => [...prev, ...created]);
      setSelectedId(created[0].id);
    }
  };

  // Clear workbench
  const handleClearCanvas = () => {
    setCards([]);
    setGroups([]);
    setSelectedId(null);
  };

  // Auto-snap matching cards into numbers
  const handleAutoSnapAll = () => {
    if (cards.length === 0) return;

    const remaining = [...cards];
    const newGroups: CardGroupData[] = [];

    let groupIndex = 0;
    while (remaining.length > 0) {
      const currentStack: ArrowCardData[] = [];
      const usedPlaces = new Set<number>();

      for (let i = 0; i < remaining.length; i++) {
        const c = remaining[i];
        if (!usedPlaces.has(c.place)) {
          usedPlaces.add(c.place);
          currentStack.push(c);
          remaining.splice(i, 1);
          i--;
        }
      }

      if (currentStack.length > 1) {
        const groupX = snapCoord(100 + (groupIndex % 2) * 440);
        const groupY = snapCoord(140 + Math.floor(groupIndex / 2) * 110);
        newGroups.push({
          id: `group-autosnap-${Date.now()}-${groupIndex}`,
          cards: currentStack,
          x: groupX,
          y: groupY,
          zIndex: 80,
          isExpanded: false,
          showXRay: false,
        });
        groupIndex++;
      } else if (currentStack.length === 1) {
        remaining.push(currentStack[0]);
        break;
      }
    }

    if (newGroups.length > 0) {
      sound.playSnap();
      setCards(remaining);
      setGroups((prev) => [...prev, ...newGroups]);
      setSelectedId(newGroups[0].id);
    }
  };

  // Check physical overlap for snapping or bouncing during dragging
  const checkProximity = useCallback(
    (
      cardPlace: 1000 | 100 | 10 | 1,
      currentX: number,
      currentY: number,
      excludeCardId?: string
    ): { snapTargetId: string | null; bounceTargetId: string | null } => {
      const cardWidth = getCardWidth(cardPlace);
      const { x: snappedX, y: snappedY } = snapPoint(currentX, currentY);

      // Check standalone cards for strictly physical overlap
      for (const other of cards) {
        if (other.id === excludeCardId) continue;
        const otherWidth = getCardWidth(other.place);
        const { isOverlapping } = getBoxOverlap(
          snappedX,
          snappedY,
          cardWidth,
          CARD_HEIGHT,
          other.x,
          other.y,
          otherWidth,
          CARD_HEIGHT
        );

        if (isOverlapping) {
          if (other.place === cardPlace) {
            // Same place value: warn that it will bounce away!
            return { snapTargetId: null, bounceTargetId: other.id };
          } else {
            // Different place value: ready to snap!
            return { snapTargetId: other.id, bounceTargetId: null };
          }
        }
      }

      // Check existing groups for strictly physical overlap
      for (const g of groups) {
        const maxGroupWidth = Math.max(...g.cards.map((c) => getCardWidth(c.place)));
        const { isOverlapping } = getBoxOverlap(
          snappedX,
          snappedY,
          cardWidth,
          CARD_HEIGHT,
          g.x,
          g.y,
          maxGroupWidth,
          CARD_HEIGHT
        );

        if (isOverlapping) {
          const hasSamePlace = g.cards.some((c) => c.place === cardPlace);
          if (hasSamePlace) {
            return { snapTargetId: null, bounceTargetId: g.id };
          } else {
            return { snapTargetId: g.id, bounceTargetId: null };
          }
        }
      }

      return { snapTargetId: null, bounceTargetId: null };
    },
    [cards, groups, snapPoint]
  );

  // Dragging individual card: proximity checking (ONLY triggers when starting to overlap!)
  const handleCardDrag = (
    card: ArrowCardData,
    currentX: number,
    currentY: number
  ) => {
    const { snapTargetId, bounceTargetId } = checkProximity(
      card.place,
      currentX,
      currentY,
      card.id
    );
    setSnapCandidateId(snapTargetId);
    setBounceCandidateId(bounceTargetId);
  };

  // Drag end for an EXISTING card on the workbench
  const handleCardDragEnd = (
    card: ArrowCardData,
    rawX: number,
    rawY: number
  ) => {
    setSnapCandidateId(null);
    setBounceCandidateId(null);
    const { x: finalX, y: finalY } = snapPoint(rawX, rawY);
    const cardWidth = getCardWidth(card.place);
    const cardRightX = finalX + cardWidth;

    const containerW = containerRef.current?.clientWidth ?? 1100;
    const containerH = containerRef.current?.clientHeight ?? 650;

    // 1. Check physical overlap against standalone cards
    for (let i = 0; i < cards.length; i++) {
      const other = cards[i];
      if (other.id === card.id) continue;

      const otherWidth = getCardWidth(other.place);
      const otherRightX = other.x + otherWidth;

      const { isOverlapping, overlapX } = getBoxOverlap(
        finalX,
        finalY,
        cardWidth,
        CARD_HEIGHT,
        other.x,
        other.y,
        otherWidth,
        CARD_HEIGHT
      );

      // ONLY snap or bounce when they actually overlap!
      if (isOverlapping) {
        // CASE A: SAME PLACE VALUE (e.g. 4 on top of 8) -> BOUNCE OUT!
        if (other.place === card.place) {
          sound.playBounce();
          const bounce = calculateBouncePosition(
            finalX,
            finalY,
            cardWidth,
            other.x,
            other.y,
            otherWidth,
            containerW,
            containerH
          );
          const { x: bounceX, y: bounceY } = snapPoint(bounce.bounceX, bounce.bounceY);

          // Bounce the dragged card away; stationary card 'other' stays untouched!
          setCards((prev) =>
            prev.map((c) => (c.id === card.id ? { ...c, x: bounceX, y: bounceY } : c))
          );
          setSelectedId(card.id);
          return;
        }

        // CASE B: DIFFERENT PLACE VALUE -> SNAP!
        sound.playSnap();
        const mergedCards = [card, other];

        const maxPlace = Math.max(card.place, other.place) as 1000 | 100 | 10 | 1;
        const groupWidth = getCardWidth(maxPlace);

        // Substantial overlap => stack flush; edge overlap => horizontal side-by-side
        const isStackMatch = overlapX >= 28 || overlapX / Math.min(cardWidth, otherWidth) > 0.35;

        let anchorX = other.x;
        const anchorY = other.y;

        if (isStackMatch) {
          anchorX = otherRightX - groupWidth;
        } else if (finalX < other.x) {
          anchorX = other.x - cardWidth - 32;
        }

        const newGroup: CardGroupData = {
          id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          cards: mergedCards,
          x: Math.max(20, anchorX),
          y: Math.max(20, anchorY),
          zIndex: 90,
          isExpanded: !isStackMatch,
          showXRay: false,
        };

        setCards((prev) => prev.filter((c) => c.id !== card.id && c.id !== other.id));
        setGroups((prev) => [...prev, newGroup]);
        setSelectedId(newGroup.id);
        return;
      }
    }

    // 2. Check physical overlap against existing groups
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const maxGroupWidth = Math.max(...g.cards.map((c) => getCardWidth(c.place)));
      const groupRightX = g.x + maxGroupWidth;

      const { isOverlapping, overlapX } = getBoxOverlap(
        finalX,
        finalY,
        cardWidth,
        CARD_HEIGHT,
        g.x,
        g.y,
        maxGroupWidth,
        CARD_HEIGHT
      );

      if (isOverlapping) {
        const hasSamePlace = g.cards.some((c) => c.place === card.place);

        // CASE A: GROUP ALREADY HAS THIS PLACE VALUE -> BOUNCE OUT!
        if (hasSamePlace) {
          sound.playBounce();
          const bounce = calculateBouncePosition(
            finalX,
            finalY,
            cardWidth,
            g.x,
            g.y,
            maxGroupWidth,
            containerW,
            containerH
          );
          const { x: bounceX, y: bounceY } = snapPoint(bounce.bounceX, bounce.bounceY);

          // Bounce the dragged card away; group stays untouched!
          setCards((prev) =>
            prev.map((c) => (c.id === card.id ? { ...c, x: bounceX, y: bounceY } : c))
          );
          setSelectedId(card.id);
          return;
        }

        // CASE B: NO CONFLICT -> SNAP INTO GROUP!
        sound.playSnap();
        const newCards = [...g.cards, card];
        const newMaxPlace = Math.max(...newCards.map((c) => c.place)) as 1000 | 100 | 10 | 1;
        const newMaxWidth = getCardWidth(newMaxPlace);
        const adjustedX = !g.isExpanded ? groupRightX - newMaxWidth : g.x;

        const updatedGroup: CardGroupData = {
          ...g,
          cards: newCards,
          x: Math.max(20, adjustedX),
        };

        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setGroups((prev) => prev.map((grp) => (grp.id === g.id ? updatedGroup : grp)));
        setSelectedId(g.id);
        return;
      }
    }

    // 3. No physical overlap: simply update standalone card position
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, x: finalX, y: finalY } : c))
    );
  };

  // Dropping a BRAND NEW card dragged from Card Bank onto the workbench
  const handleDropNewCard = (
    place: 1000 | 100 | 10 | 1,
    digit: number,
    clientX: number,
    clientY: number
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cardWidth = getCardWidth(place);

    const containerW = containerRef.current.clientWidth ?? 1100;
    const containerH = containerRef.current.clientHeight ?? 650;

    // Compute coordinate relative to the workbench canvas
    const rawX = clientX - rect.left + containerRef.current.scrollLeft;
    const rawY = clientY - rect.top + containerRef.current.scrollTop;

    // Center card under pointer, snap to the grid, and clamp within visible bounds
    const { x: dropX, y: dropY } = snapPoint(
      Math.max(20, Math.min(rect.width - cardWidth - 20, rawX - cardWidth / 2)),
      Math.max(20, Math.min(rect.height - CARD_HEIGHT - 20, rawY - CARD_HEIGHT / 2))
    );

    const newCard = createCard(place, digit, dropX, dropY);
    const cardRightX = dropX + cardWidth;

    // 1. Check physical overlap against standalone cards
    for (let i = 0; i < cards.length; i++) {
      const other = cards[i];
      const otherWidth = getCardWidth(other.place);
      const otherRightX = other.x + otherWidth;

      const { isOverlapping, overlapX } = getBoxOverlap(
        dropX,
        dropY,
        cardWidth,
        CARD_HEIGHT,
        other.x,
        other.y,
        otherWidth,
        CARD_HEIGHT
      );

      if (isOverlapping) {
        // SAME PLACE VALUE -> BOUNCE OUT!
        if (other.place === newCard.place) {
          sound.playBounce();
          const bounce = calculateBouncePosition(
            dropX,
            dropY,
            cardWidth,
            other.x,
            other.y,
            otherWidth,
            containerW,
            containerH
          );
          const { x: bounceX, y: bounceY } = snapPoint(bounce.bounceX, bounce.bounceY);

          const bouncedCard = createCard(place, digit, bounceX, bounceY);
          setCards((prev) => [...prev, bouncedCard]);
          setSelectedId(bouncedCard.id);
          return;
        }

        // DIFFERENT PLACE VALUE -> SNAP!
        sound.playSnap();
        const maxPlace = Math.max(newCard.place, other.place) as 1000 | 100 | 10 | 1;
        const groupWidth = getCardWidth(maxPlace);

        const isStackMatch = overlapX >= 28 || overlapX / Math.min(cardWidth, otherWidth) > 0.35;

        let anchorX = other.x;
        const anchorY = other.y;

        if (isStackMatch) {
          anchorX = otherRightX - groupWidth;
        } else if (dropX < other.x) {
          anchorX = other.x - cardWidth - 32;
        }

        const newGroup: CardGroupData = {
          id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          cards: [newCard, other],
          x: Math.max(20, anchorX),
          y: Math.max(20, anchorY),
          zIndex: 90,
          isExpanded: !isStackMatch,
          showXRay: false,
        };

        setCards((prev) => prev.filter((c) => c.id !== other.id));
        setGroups((prev) => [...prev, newGroup]);
        setSelectedId(newGroup.id);
        return;
      }
    }

    // 2. Check physical overlap against existing groups
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const maxGroupWidth = Math.max(...g.cards.map((c) => getCardWidth(c.place)));
      const groupRightX = g.x + maxGroupWidth;

      const { isOverlapping } = getBoxOverlap(
        dropX,
        dropY,
        cardWidth,
        CARD_HEIGHT,
        g.x,
        g.y,
        maxGroupWidth,
        CARD_HEIGHT
      );

      if (isOverlapping) {
        const hasSamePlace = g.cards.some((c) => c.place === newCard.place);

        // SAME PLACE VALUE IN GROUP -> BOUNCE OUT!
        if (hasSamePlace) {
          sound.playBounce();
          const bounce = calculateBouncePosition(
            dropX,
            dropY,
            cardWidth,
            g.x,
            g.y,
            maxGroupWidth,
            containerW,
            containerH
          );
          const { x: bounceX, y: bounceY } = snapPoint(bounce.bounceX, bounce.bounceY);

          const bouncedCard = createCard(place, digit, bounceX, bounceY);
          setCards((prev) => [...prev, bouncedCard]);
          setSelectedId(bouncedCard.id);
          return;
        }

        // DIFFERENT PLACE VALUE -> SNAP INTO GROUP!
        sound.playSnap();
        const newCards = [...g.cards, newCard];
        const newMaxPlace = Math.max(...newCards.map((c) => c.place)) as 1000 | 100 | 10 | 1;
        const newMaxWidth = getCardWidth(newMaxPlace);
        const adjustedX = !g.isExpanded ? groupRightX - newMaxWidth : g.x;

        const updatedGroup: CardGroupData = {
          ...g,
          cards: newCards,
          x: Math.max(20, adjustedX),
        };

        setGroups((prev) => prev.map((grp) => (grp.id === g.id ? updatedGroup : grp)));
        setSelectedId(g.id);
        return;
      }
    }

    // 3. No physical overlap: ADD DIRECTLY TO CARDS!
    sound.playPickUp();
    setCards((prev) => [...prev, newCard]);
    setSelectedId(newCard.id);
  };

  // Duplicate card
  const handleDuplicateCard = (card: ArrowCardData) => {
    sound.playPickUp();
    const copy = createCard(
      card.place,
      card.digit,
      snapCoord(card.x + 30),
      snapCoord(card.y + 30)
    );
    setCards((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  // Delete card
  const handleDeleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (selectedId === cardId) setSelectedId(null);
  };

  // Drag group: proximity checking against standalone cards & other groups
  const handleGroupDrag = (
    group: CardGroupData,
    currentX: number,
    currentY: number
  ) => {
    const groupWidth = Math.max(...group.cards.map((c) => getCardWidth(c.place)));
    const { x: snappedX, y: snappedY } = snapPoint(currentX, currentY);

    // 1. Check against standalone cards (e.g. dragging 25 over 400)
    for (const other of cards) {
      const otherWidth = getCardWidth(other.place);
      const { isOverlapping } = getBoxOverlap(
        snappedX,
        snappedY,
        groupWidth,
        CARD_HEIGHT,
        other.x,
        other.y,
        otherWidth,
        CARD_HEIGHT
      );

      if (isOverlapping) {
        const hasConflict = group.cards.some((c) => c.place === other.place);
        if (hasConflict) {
          setSnapCandidateId(null);
          setBounceCandidateId(other.id);
        } else {
          setSnapCandidateId(other.id);
          setBounceCandidateId(null);
        }
        return;
      }
    }

    // 2. Check against other groups
    for (const other of groups) {
      if (other.id === group.id) continue;
      const otherWidth = Math.max(...other.cards.map((c) => getCardWidth(c.place)));
      const { isOverlapping } = getBoxOverlap(
        snappedX,
        snappedY,
        groupWidth,
        CARD_HEIGHT,
        other.x,
        other.y,
        otherWidth,
        CARD_HEIGHT
      );

      if (isOverlapping) {
        const hasConflict = group.cards.some((c1) =>
          other.cards.some((c2) => c2.place === c1.place)
        );
        if (hasConflict) {
          setSnapCandidateId(null);
          setBounceCandidateId(other.id);
        } else {
          setSnapCandidateId(other.id);
          setBounceCandidateId(null);
        }
        return;
      }
    }

    setSnapCandidateId(null);
    setBounceCandidateId(null);
  };

  // Drag group end
  const handleGroupDragEnd = (
    group: CardGroupData,
    rawX: number,
    rawY: number
  ) => {
    setSnapCandidateId(null);
    setBounceCandidateId(null);

    const { x: finalX, y: finalY } = snapPoint(rawX, rawY);
    const groupWidth = Math.max(...group.cards.map((c) => getCardWidth(c.place)));
    const containerW = containerRef.current?.clientWidth ?? 1100;
    const containerH = containerRef.current?.clientHeight ?? 650;

    // 1. Check physical overlap against standalone cards (e.g. dragging 25 onto 400!)
    for (let i = 0; i < cards.length; i++) {
      const other = cards[i];
      const otherWidth = getCardWidth(other.place);

      const { isOverlapping, overlapX } = getBoxOverlap(
        finalX,
        finalY,
        groupWidth,
        CARD_HEIGHT,
        other.x,
        other.y,
        otherWidth,
        CARD_HEIGHT
      );

      if (isOverlapping) {
        const hasConflict = group.cards.some((c) => c.place === other.place);

        if (hasConflict) {
          // SAME PLACE VALUE COLLISION -> BOUNCE GROUP AWAY!
          sound.playBounce();
          const bounce = calculateBouncePosition(
            finalX,
            finalY,
            groupWidth,
            other.x,
            other.y,
            otherWidth,
            containerW,
            containerH
          );
          const { x: bounceX, y: bounceY } = snapPoint(bounce.bounceX, bounce.bounceY);

          setGroups((prev) =>
            prev.map((g) => (g.id === group.id ? { ...g, x: bounceX, y: bounceY } : g))
          );
          setSelectedId(group.id);
          return;
        }

        // NO CONFLICT -> SNAP TOGETHER!
        sound.playSnap();
        const newCards = [...group.cards, other];
        const newMaxPlace = Math.max(...newCards.map((c) => c.place)) as 1000 | 100 | 10 | 1;
        const newMaxWidth = getCardWidth(newMaxPlace);

        const isStackMatch = overlapX >= 28 || overlapX / Math.min(groupWidth, otherWidth) > 0.35;

        let anchorX = other.x;
        const anchorY = other.y;

        if (isStackMatch) {
          if (other.place === newMaxPlace) {
            anchorX = other.x;
          } else {
            const otherRightX = other.x + otherWidth;
            anchorX = otherRightX - newMaxWidth;
          }
        } else if (finalX < other.x) {
          anchorX = other.x - groupWidth - 32;
        }

        // Remove stationary card 'other' from cards
        setCards((prev) => prev.filter((c) => c.id !== other.id));

        // Update group with new combined cards and anchored position
        setGroups((prev) =>
          prev.map((g) =>
            g.id === group.id
              ? {
                  ...g,
                  cards: newCards,
                  x: Math.max(20, anchorX),
                  y: Math.max(20, anchorY),
                  isExpanded: !isStackMatch,
                }
              : g
          )
        );
        setSelectedId(group.id);
        return;
      }
    }

    // 2. Check physical overlap against other groups (e.g. dragging 25 onto 3400!)
    for (const other of groups) {
      if (other.id === group.id) continue;
      const otherWidth = Math.max(...other.cards.map((c) => getCardWidth(c.place)));

      const { isOverlapping } = getBoxOverlap(
        finalX,
        finalY,
        groupWidth,
        CARD_HEIGHT,
        other.x,
        other.y,
        otherWidth,
        CARD_HEIGHT
      );

      if (isOverlapping) {
        const sharesPlace = group.cards.some((c1) =>
          other.cards.some((c2) => c2.place === c1.place)
        );

        if (sharesPlace) {
          sound.playBounce();
          const bounce = calculateBouncePosition(
            finalX,
            finalY,
            groupWidth,
            other.x,
            other.y,
            otherWidth,
            containerW,
            containerH
          );
          const { x: bounceX, y: bounceY } = snapPoint(bounce.bounceX, bounce.bounceY);

          setGroups((prev) =>
            prev.map((g) => (g.id === group.id ? { ...g, x: bounceX, y: bounceY } : g))
          );
          setSelectedId(group.id);
          return;
        }

        // Snap and merge groups
        sound.playSnap();
        const mergedGroup: CardGroupData = {
          ...other,
          cards: [...other.cards, ...group.cards],
          x: other.x,
          y: other.y,
        };
        setGroups((prev) =>
          prev.filter((g) => g.id !== group.id).map((g) => (g.id === other.id ? mergedGroup : g))
        );
        setSelectedId(other.id);
        return;
      }
    }

    setGroups((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, x: finalX, y: finalY } : g))
    );
  };

  // Toggle expanded / stacked on group
  const handleToggleExpandGroup = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g))
    );
  };

  // Toggle X-Ray on group
  const handleToggleXRayGroup = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, showXRay: !g.showXRay } : g))
    );
  };

  // Ungroup
  const handleUngroup = (groupId: string) => {
    const target = groups.find((g) => g.id === groupId);
    if (!target) return;

    const sorted = [...target.cards].sort((a, b) => b.place - a.place);
    let runningX = target.x;
    const newCards: ArrowCardData[] = sorted.map((c) => {
      const cardX = runningX;
      runningX += getCardWidth(c.place) + 24;
      return {
        ...c,
        id: `card-${c.place}-${c.digit}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        x: cardX,
        y: target.y,
        groupId: undefined,
      };
    });

    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setCards((prev) => [...prev, ...newCards]);
    setSelectedId(newCards[0]?.id ?? null);
  };

  // Duplicate group
  const handleDuplicateGroup = (group: CardGroupData) => {
    sound.playPickUp();
    const newGroup: CardGroupData = {
      ...group,
      id: `group-copy-${Date.now()}`,
      x: snapCoord(group.x + 40),
      y: snapCoord(group.y + 40),
      cards: group.cards.map((c) => ({
        ...c,
        id: `card-copy-${c.place}-${c.digit}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      })),
    };
    setGroups((prev) => [...prev, newGroup]);
    setSelectedId(newGroup.id);
  };

  // Delete group
  const handleDeleteGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (selectedId === groupId) setSelectedId(null);
  };

  // Pointer down in CardBank to start dragging directly onto workbench
  const handleStartDragFromBank = (
    place: 1000 | 100 | 10 | 1,
    digit: number,
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    sound.playPickUp();
    setDraggingBankCard({
      place,
      digit,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    });
  };

  // Global pointer move & pointer up when dragging card from bank
  useEffect(() => {
    if (!draggingBankCard) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - draggingBankCard.startX,
        e.clientY - draggingBankCard.startY
      );
      const isDraggingNow = draggingBankCard.isDragging || dist > 8;

      setDraggingBankCard((prev) =>
        prev
          ? {
              ...prev,
              x: e.clientX,
              y: e.clientY,
              isDragging: isDraggingNow,
            }
          : null
      );

      // Check proximity ONLY when starting to overlap over container
      if (isDraggingNow && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const cardWidth = getCardWidth(draggingBankCard.place);
        const canvasX = e.clientX - rect.left + containerRef.current.scrollLeft - cardWidth / 2;
        const canvasY = e.clientY - rect.top + containerRef.current.scrollTop - CARD_HEIGHT / 2;

        const { snapTargetId, bounceTargetId } = checkProximity(
          draggingBankCard.place,
          canvasX,
          canvasY
        );
        setSnapCandidateId(snapTargetId);
        setBounceCandidateId(bounceTargetId);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const wasDragging = draggingBankCard.isDragging;
      const { place, digit } = draggingBankCard;

      if (wasDragging) {
        // Dragged onto workbench: drop at exact coordinates (or snap / bounce!)
        handleDropNewCard(place, digit, e.clientX, e.clientY);
      } else {
        // Clicked/tapped without moving: add card cleanly once!
        handleAddCard(place, digit);
      }

      setDraggingBankCard(null);
      setSnapCandidateId(null);
      setBounceCandidateId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingBankCard, checkProximity]);

  const totalCardsCount =
    cards.length + groups.reduce((acc, g) => acc + g.cards.length, 0);

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8fafc] text-slate-800 overflow-hidden font-sans">
      {/* Top Application Bar */}
      <Toolbar
        theme={theme}
        onThemeChange={setTheme}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isGridSnapEnabled={isGridSnapEnabled}
        onToggleGridSnap={handleToggleGridSnap}
        onClearCanvas={handleClearCanvas}
        onAutoSnapAll={handleAutoSnapAll}
        onOpenHelp={() => setShowHelp(true)}
        totalCardsCount={totalCardsCount}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Canvas Area */}
        <div
          ref={containerRef}
          onClick={() => setSelectedId(null)}
          className={`flex-1 relative overflow-auto select-none [background-size:24px_24px] ${
            isGridSnapEnabled
              ? 'bg-[linear-gradient(to_right,#e8eef5_1px,transparent_1px),linear-gradient(to_bottom,#e8eef5_1px,transparent_1px)]'
              : 'bg-[radial-gradient(#e2e8f0_1px,transparent_1px)]'
          }`}
          style={{ minHeight: 450 }}
        >
          {/* Helpful interactive prompt banner */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-xs px-3.5 py-1.5 rounded-xl shadow-xs border border-slate-200 text-xs text-slate-600 pointer-events-none">
            <Move className="w-3.5 h-3.5 text-blue-600" />
            <span>
              <strong>Tip:</strong> Cards line up on the grid. Drag one onto another to snap them together!
            </span>
          </div>

          {/* Render Standalone Draggable Cards */}
          {cards.map((card) => (
            <ArrowCardItem
              key={card.id}
              card={card}
              theme={theme}
              isSelected={selectedId === card.id}
              isSnapTarget={snapCandidateId === card.id}
              isBounceTarget={bounceCandidateId === card.id}
              onSelect={(id) => setSelectedId(id)}
              onDragStart={() => setSelectedId(card.id)}
              onDrag={handleCardDrag}
              onDragEnd={handleCardDragEnd}
              onDuplicate={handleDuplicateCard}
              onDelete={handleDeleteCard}
            />
          ))}

          {/* Render Snapped Composite Groups */}
          {groups.map((group) => (
            <CardGroupItem
              key={group.id}
              group={group}
              theme={theme}
              isSelected={selectedId === group.id}
              isSnapTarget={snapCandidateId === group.id}
              isBounceTarget={bounceCandidateId === group.id}
              onSelect={(id) => setSelectedId(id)}
              onDragStart={() => setSelectedId(group.id)}
              onDrag={handleGroupDrag}
              onDragEnd={handleGroupDragEnd}
              onToggleExpand={handleToggleExpandGroup}
              onToggleXRay={handleToggleXRayGroup}
              onUngroup={handleUngroup}
              onDuplicate={handleDuplicateGroup}
              onDelete={handleDeleteGroup}
            />
          ))}

          {/* Empty state illustration */}
          {cards.length === 0 && groups.length === 0 && !draggingBankCard && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-500 flex items-center justify-center mb-3">
                <Move className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">
                Workbench is Empty
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Drag cards from the bank below onto the board or click "Make" to build numbers!
              </p>
              <button
                type="button"
                onClick={() => handleBuildFullNumber(4325, false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                Spawn Example (4,325)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Ghost when dragging card from CardBank onto workbench */}
      {draggingBankCard?.isDragging && (
        <div
          style={{
            position: 'fixed',
            left: snapCoord(draggingBankCard.x - getCardWidth(draggingBankCard.place) / 2),
            top: snapCoord(draggingBankCard.y - CARD_HEIGHT / 2),
            zIndex: 9999,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.25))',
            transform: 'rotate(-2deg) scale(1.04)',
          }}
        >
          <ArrowCardSvg
            place={draggingBankCard.place}
            digit={draggingBankCard.digit}
            theme={theme}
            highlight
          />
        </div>
      )}

      {/* Bottom Card Bank Tray */}
      <CardBank
        theme={theme}
        onStartDragCard={handleStartDragFromBank}
        onBuildFullNumber={handleBuildFullNumber}
      />

      {/* Pedagogy / How It Works Modal */}
      <PedagogyHelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}
