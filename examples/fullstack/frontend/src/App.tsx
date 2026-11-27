import { useState } from "react";
import { CompanyForm } from "./CompanyForm.tsx";
import type { Lang } from "./messages.ts";
import { SignUpForm } from "./SignUpForm.tsx";
import { StepForm } from "./StepForm.tsx";

export function App() {
  const [lang, setLang] = useState<Lang>("sr");
  return (
    <main>
      <h1>xoe-validator: fullstack example</h1>
      <p>
        Language of the messages:{" "}
        <button onClick={() => setLang("sr")} disabled={lang === "sr"}>sr</button>{" "}
        <button onClick={() => setLang("en")} disabled={lang === "en"}>en</button>
        {" · "}
        <a href="/api/openapi.json" target="_blank" rel="noreferrer">OpenAPI</a>
      </p>
      <SignUpForm lang={lang} />
      <CompanyForm lang={lang} />
      <StepForm lang={lang} />
    </main>
  );
}
