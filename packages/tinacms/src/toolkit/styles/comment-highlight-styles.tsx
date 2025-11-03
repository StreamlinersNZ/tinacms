import * as React from 'react';

const STYLE_ELEMENT_ID = 'tina-comment-highlight-styles';

const styleContent = `
:root {
  --tina-comment-highlight-bg: hsla(217, 100%, 97%, 1);
  --tina-comment-highlight-border: hsla(217, 100%, 94%, 1);
  --tina-comment-highlight-border-strong: hsla(217, 91%, 80%, 1);
  --tina-comment-highlight-hover-bg: hsla(217, 100%, 96%, 1);
  --tina-comment-highlight-active-bg: hsla(217, 100%, 94%, 1);
  --tina-comment-highlight-overlap-border: hsla(217, 91%, 65%, 1);
  --tina-comment-highlight-draft-bg: hsla(260, 100%, 97%, 1);
  --tina-comment-highlight-draft-border: hsla(260, 100%, 92%, 1);
}

.tina-comment-leaf {
  position: relative;
  background-color: var(--tina-comment-highlight-bg);
  border-bottom: 1px solid var(--tina-comment-highlight-border);
  transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  border-radius: 3px;
}

.tina-comment-leaf--hover,
.tina-comment-leaf--active {
  background-color: var(--tina-comment-highlight-hover-bg);
  border-bottom-color: var(--tina-comment-highlight-border-strong);
}

.tina-comment-leaf--active {
  background-color: var(--tina-comment-highlight-active-bg);
  box-shadow: 0 0 0 2px var(--tina-comment-highlight-border-strong);
}

.tina-comment-leaf--overlap {
  border-bottom-color: var(--tina-comment-highlight-overlap-border);
  box-shadow: inset 0 -2px 0 0 hsla(217, 91%, 65%, 0.2);
}

.tina-comment-leaf--draft {
  background-color: var(--tina-comment-highlight-draft-bg);
  border-bottom-color: var(--tina-comment-highlight-draft-border);
}

.tina-comment-leaf[data-comment-overlap='true'].tina-comment-leaf--active {
  box-shadow: inset 0 -2px 0 0 hsla(217, 91%, 65%, 0.2),
    0 0 0 2px var(--tina-comment-highlight-border-strong);
}
`;

export function CommentHighlightStyles() {
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    let element = document.getElementById(STYLE_ELEMENT_ID) as
      | HTMLStyleElement
      | null;

    if (!element) {
      element = document.createElement('style');
      element.id = STYLE_ELEMENT_ID;
      element.textContent = styleContent;
      document.head.appendChild(element);
    }

    return () => {
      if (!document.getElementById(STYLE_ELEMENT_ID)) {
        return;
      }
    };
  }, []);

  return null;
}

