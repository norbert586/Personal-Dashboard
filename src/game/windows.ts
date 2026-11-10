/**
 * What's inside a feed building's window: the feed's own card from the Today panel, copied in when
 * you go in (feeds.ts), so the window and the panel can't disagree. A slot is any element with
 * data-cards="movies" (one or more card ids); the Today panel over the town is a slot for all of
 * them (data-cards="*").
 */
import type { FeedClient } from './feeds.ts';

/** Put the latest cards into every slot under `root`; when there are none, say why. */
export function fillCards(root: ParentNode, feeds: FeedClient): void {
  for (const slot of root.querySelectorAll<HTMLElement>('[data-cards]')) {
    // Leave a card alone while you're reading a link inside it.
    if (slot.contains(document.activeElement)) continue;
    // "*" is every card, in the Today panel's order.
    const wanted = slot.dataset.cards ?? '';
    const cards =
      wanted === '*'
        ? feeds.allCards()
        : wanted
            .split(' ')
            .map((id) => feeds.card(id))
            .filter((card) => card !== null);
    if (cards.length) slot.replaceChildren(...cards);
    else if (feeds.problem) {
      const note = document.createElement('p');
      note.className = 'feed-problem';
      note.textContent = feeds.problem;
      slot.replaceChildren(note);
    }
  }
}
