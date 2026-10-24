import React from 'react';
import {
  getArrowCardAriaLabel,
  renderArrowCardSvg,
  type RenderArrowCardOptions,
} from './index';

export interface ArrowCardProps extends RenderArrowCardOptions {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * React adapter for the arrow cards. The card itself is plain SVG, so this
 * component works in React 18+ with or without a build step for the library.
 */
export const ArrowCard: React.FC<ArrowCardProps> = ({ className, style, ...options }) => {
  const reactId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ariaLabel = options.ariaLabel ?? getArrowCardAriaLabel(options.place, options.digit);
  const idPrefix = options.idPrefix ?? `arrow-${reactId}`;
  const markup = renderArrowCardSvg({ ...options, ariaLabel, idPrefix });

  return (
    <span
      className={className}
      style={{ display: 'inline-block', lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};
