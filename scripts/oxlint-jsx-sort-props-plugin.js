/**
 * Oxlint JS plugin: sort JSX props alphabetically (case-insensitive).
 * Spread attributes reset the current sort group, matching eslint-plugin-react.
 */

function attributeName(attribute) {
  if (attribute.type !== "JSXAttribute") {
    return null;
  }

  const nameNode = attribute.name;
  if (nameNode.type === "JSXNamespacedName") {
    return `${nameNode.namespace.name}:${nameNode.name.name}`;
  }

  return nameNode.name;
}

function compareAttributes(left, right) {
  const leftName = attributeName(left) ?? "";
  const rightName = attributeName(right) ?? "";
  return leftName.localeCompare(rightName, "en", { sensitivity: "base" });
}

const plugin = {
  meta: {
    name: "local-jsx-sort-props",
  },
  rules: {
    "jsx-sort-props": {
      meta: {
        type: "layout",
        docs: {
          description: "Sort JSX props alphabetically",
        },
        fixable: "code",
        messages: {
          unsorted: "JSX props should be sorted alphabetically.",
        },
        schema: [],
      },
      create(context) {
        const sourceCode = context.sourceCode;

        function checkGroup(group) {
          if (group.length < 2) {
            return;
          }

          const sorted = [...group].sort(compareAttributes);
          const alreadySorted = group.every((attribute, index) => attribute === sorted[index]);
          if (alreadySorted) {
            return;
          }

          context.report({
            node: group[0],
            messageId: "unsorted",
            fix(fixer) {
              const separators = [];
              for (let index = 0; index < group.length - 1; index += 1) {
                separators.push(
                  sourceCode.text.slice(group[index].range[1], group[index + 1].range[0]),
                );
              }

              const nextText = sorted
                .map(
                  (attribute, index) => sourceCode.getText(attribute) + (separators[index] ?? ""),
                )
                .join("");

              return fixer.replaceTextRange(
                [group[0].range[0], group[group.length - 1].range[1]],
                nextText,
              );
            },
          });
        }

        return {
          JSXOpeningElement(node) {
            let group = [];
            for (const attribute of node.attributes) {
              if (attribute.type === "JSXSpreadAttribute") {
                checkGroup(group);
                group = [];
                continue;
              }
              if (attribute.type === "JSXAttribute") {
                group.push(attribute);
              }
            }
            checkGroup(group);
          },
        };
      },
    },
  },
};

export default plugin;
