import { Fragment } from "react";

/** Text with `code` spans, so the example notes can stay plain strings. */
export const Prose = ({ text }: { text: string }) => (
  <>
    {text
      .split("`")
      .map((part, index) =>
        index % 2 === 1 ? (
          <code key={index}>{part}</code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
  </>
);
