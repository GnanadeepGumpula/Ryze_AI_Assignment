export const EXPLAINER_PROMPT = `
Review the following UI Plan and User Intent.
Explain in 2-3 sentences why these specific components and layout were chosen to solve the user's problem.
Refer to the component choices explicitly.

User Intent: "{{user_query}}"
UI Plan: {{ui_plan}}
`;