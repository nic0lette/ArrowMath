<script lang="ts">
  import {
    getArrowCardAriaLabel,
    renderArrowCardSvg,
    type RenderArrowCardOptions,
  } from '../index';

  let {
    place,
    digit,
    theme = 'curriculum',
    tier,
    isGhost = false,
    opacity = 1,
    highlight = false,
    showZeroGhost = false,
    idPrefix,
    ariaLabel,
    className,
  }: RenderArrowCardOptions = $props();

  const markup = $derived(
    renderArrowCardSvg({
      place,
      digit,
      theme,
      tier,
      isGhost,
      opacity,
      highlight,
      showZeroGhost,
      idPrefix,
      ariaLabel: ariaLabel ?? getArrowCardAriaLabel(place, digit),
      className,
    })
  );
</script>

<span class="arrow-card" style="display:inline-block;line-height:0">
  {@html markup}
</span>
