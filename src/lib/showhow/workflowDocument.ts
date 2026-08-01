export type WorkflowDocumentUpdate =
	| { type: "title"; title: string }
	| { type: "step"; index: number; label?: string; includeRevealedText?: boolean }
	| { type: "delete-step"; index: number };
