// Verified against GitHub REST users and repository suggestedActors on 2026-09-25.
// Both services display "Copilot" in REST responses, so names are not identity.
export const IMPLEMENTER_ID = 198982749;
export const REVIEWER_ID = 175728472;
export const isImplementer = (user) => user?.type === "Bot" && user.id === IMPLEMENTER_ID;
export const isReviewer = (user) => user?.type === "Bot" && user.id === REVIEWER_ID;
