import { Children, Fragment, isValidElement, type CSSProperties, type ReactNode } from "react";

type Props = {
  as?: "h1" | "h2" | "h3";
  className: string;
  id?: string;
  children: ReactNode;
};

/**
 * A title whose words rise out of their own masks (see .split in motion.css).
 * Rendered on the server: every word is a .w mask with its index in --wi;
 * an element child (e.g. <Highlight>) stays one word. Screen readers get the
 * plain title from aria-label.
 */
export function SplitTitle({ as: Tag = "h2", className, id, children }: Props) {
  const words: ReactNode[] = [];
  let label = "";
  let wi = 0;

  const push = (node: ReactNode, key: string) => {
    if (words.length) words.push(" ");
    words.push(
      <span className="w" style={{ "--wi": wi++ } as CSSProperties} aria-hidden="true" key={key}>
        {node}
      </span>,
    );
  };

  Children.forEach(children, (child, i) => {
    if (typeof child === "string" || typeof child === "number") {
      const text = String(child);
      label += text;
      text
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word, j) => push(<span>{word}</span>, `${i}-${j}`));
    } else if (isValidElement<{ children?: ReactNode }>(child)) {
      label += textOf(child.props.children);
      push(child, `${i}`);
    }
  });

  return (
    <Tag className={`${className} split`} id={id} aria-label={label.replace(/\s+/g, " ").trim()}>
      {words.map((w, i) => (typeof w === "string" ? <Fragment key={`s${i}`}>{w}</Fragment> : w))}
    </Tag>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return ` ${node} `;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** The gold underline drawn under key words once the title is in view. */
export function Highlight({ children }: { children: ReactNode }) {
  return <span className="hl">{children}</span>;
}
