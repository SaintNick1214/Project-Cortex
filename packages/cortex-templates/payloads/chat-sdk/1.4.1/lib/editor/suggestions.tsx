import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import {
  type Decoration,
  DecorationSet,
  type EditorView,
} from "prosemirror-view";
import { createRoot } from "react-dom/client";
import type { ArtifactKind } from "@/components/artifact";
import { Suggestion as PreviewSuggestion } from "@/components/suggestion";
import type { Suggestion } from "@/lib/types";

export interface UISuggestion extends Suggestion {
  selectionEnd: number;
  selectionStart: number;
}

type Position = {
  start: number;
  end: number;
};

function findPositionsInDoc(doc: Node, searchText: string): Position | null {
  let positions: { start: number; end: number } | null = null;

  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (node.isText && node.text) {
      const index = node.text.indexOf(searchText);

      if (index !== -1) {
        positions = {
          end: pos + index + searchText.length,
          start: pos + index,
        };

        return false;
      }
    }

    return true;
  });

  return positions;
}

export function projectWithPositions(
  doc: Node,
  suggestions: Suggestion[]
): UISuggestion[] {
  return suggestions.map((suggestion) => {
    const positions = findPositionsInDoc(doc, suggestion.originalText);

    if (!positions) {
      return {
        ...suggestion,
        selectionEnd: 0,
        selectionStart: 0,
      };
    }

    return {
      ...suggestion,
      selectionEnd: positions.end,
      selectionStart: positions.start,
    };
  });
}

export function createSuggestionWidget(
  suggestion: UISuggestion,
  view: EditorView,
  artifactKind: ArtifactKind = "text"
): { dom: HTMLElement; destroy: () => void } {
  const dom = document.createElement("span");
  const root = createRoot(dom);

  dom.addEventListener("mousedown", (event) => {
    event.preventDefault();
    view.dom.blur();
  });

  const onApply = () => {
    const { state, dispatch } = view;

    const decorationTransaction = state.tr;
    const currentState = suggestionsPluginKey.getState(state);
    const currentDecorations = currentState?.decorations;

    if (currentDecorations) {
      const newDecorations = DecorationSet.create(
        state.doc,
        currentDecorations
          .find()
          .filter(
            (decoration: Decoration) =>
              decoration.spec.suggestionId !== suggestion.id
          )
      );

      decorationTransaction.setMeta(suggestionsPluginKey, {
        decorations: newDecorations,
        selected: null,
      });
      dispatch(decorationTransaction);
    }

    const textTransaction = view.state.tr.replaceWith(
      suggestion.selectionStart,
      suggestion.selectionEnd,
      state.schema.text(suggestion.suggestedText)
    );

    textTransaction.setMeta("no-debounce", true);

    dispatch(textTransaction);
  };

  root.render(
    <PreviewSuggestion
      artifactKind={artifactKind}
      onApply={onApply}
      suggestion={suggestion}
    />
  );

  return {
    destroy: () => {
      // Wrapping unmount in setTimeout to avoid synchronous unmounting during render
      setTimeout(() => {
        root.unmount();
      }, 0);
    },
    dom,
  };
}

export const suggestionsPluginKey = new PluginKey("suggestions");
export const suggestionsPlugin = new Plugin({
  key: suggestionsPluginKey,
  props: {
    decorations(state) {
      return this.getState(state)?.decorations ?? DecorationSet.empty;
    },
  },
  state: {
    apply(tr, state) {
      const newDecorations = tr.getMeta(suggestionsPluginKey);
      if (newDecorations) {
        return newDecorations;
      }

      return {
        decorations: state.decorations.map(tr.mapping, tr.doc),
        selected: state.selected,
      };
    },
    init() {
      return { decorations: DecorationSet.empty, selected: null };
    },
  },
});
