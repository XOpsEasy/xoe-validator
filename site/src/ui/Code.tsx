import { useState } from "react";
import type { SourceFile } from "../lib/content.ts";

/** Highlighted source files, one tab per file. */
export const Code = ({ files }: { files: readonly SourceFile[] }) => {
  const [active, setActive] = useState(0);
  const file = files[Math.min(active, files.length - 1)];
  return (
    <div className="code">
      <div className="code-tabs" role="tablist" aria-label="Source files">
        {files.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={index === active}
            className="code-tab"
            onClick={() => setActive(index)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div
        className="code-body"
        role="tabpanel"
        tabIndex={0}
        // Built from this repository's own files by plugins/content.ts.
        dangerouslySetInnerHTML={{ __html: file.html }}
      />
    </div>
  );
};
